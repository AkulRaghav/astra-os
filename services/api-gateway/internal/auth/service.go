package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"github.com/astra-os/api-gateway/internal/config"
	"github.com/astra-os/api-gateway/internal/database"
	redisclient "github.com/astra-os/api-gateway/internal/redis"
)

type Service struct {
	db     *database.DB
	redis  *redisclient.Client
	config *config.Config
}

type contextKey string

const UserContextKey contextKey = "user"

type UserClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

func NewService(db *database.DB, redis *redisclient.Client, cfg *config.Config) *Service {
	return &Service{
		db:     db,
		redis:  redis,
		config: cfg,
	}
}

// --- Request/Response types ---

type SignupRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	TOTPCode string `json:"totp_code,omitempty"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type Enable2FAResponse struct {
	Secret string `json:"secret"`
	QRCode string `json:"qr_code"`
}

type Verify2FARequest struct {
	Code string `json:"code"`
}

// --- Handlers ---

func (s *Service) HandleSignup(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "Email, password, and display name are required")
		return
	}

	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	userID := uuid.New().String()
	now := time.Now()

	// Insert user
	_, err = s.db.Pool.Exec(context.Background(),
		`INSERT INTO users (id, email, password_hash, display_name, role, plan, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'user', 'free', $5, $5)`,
		userID, req.Email, string(hashedPassword), req.DisplayName, now,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			writeError(w, http.StatusConflict, "Email already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Create default profile
	_, err = s.db.Pool.Exec(context.Background(),
		`INSERT INTO user_profiles (id, user_id, timezone, language, theme, notifications_enabled, created_at, updated_at)
		 VALUES ($1, $2, 'UTC', 'en', 'dark', true, $3, $3)`,
		uuid.New().String(), userID, now,
	)
	if err != nil {
		// Non-critical, log but continue
		fmt.Printf("Warning: failed to create user profile: %v\n", err)
	}

	// Generate tokens
	tokens, err := s.generateTokens(userID, req.Email, "user")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	// Store session
	s.createSession(userID, r)

	writeJSON(w, http.StatusCreated, tokens)
}

func (s *Service) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	// Look up user
	var userID, passwordHash, role string
	var twoFactorEnabled bool
	var twoFactorSecret *string

	err := s.db.Pool.QueryRow(context.Background(),
		`SELECT id, password_hash, role, two_factor_enabled, two_factor_secret FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &passwordHash, &role, &twoFactorEnabled, &twoFactorSecret)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Check 2FA
	if twoFactorEnabled && twoFactorSecret != nil {
		if req.TOTPCode == "" {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"requires_2fa": true,
				"message":      "Please provide your 2FA code",
			})
			return
		}
		if !totp.Validate(req.TOTPCode, *twoFactorSecret) {
			writeError(w, http.StatusUnauthorized, "Invalid 2FA code")
			return
		}
	}

	// Generate tokens
	tokens, err := s.generateTokens(userID, req.Email, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	// Store session
	s.createSession(userID, r)

	writeJSON(w, http.StatusOK, tokens)
}

func (s *Service) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate refresh token
	claims, err := s.validateToken(req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	// Check if token is blacklisted
	blacklisted, _ := s.redis.Get(context.Background(), "blacklist:"+req.RefreshToken).Result()
	if blacklisted != "" {
		writeError(w, http.StatusUnauthorized, "Token has been revoked")
		return
	}

	// Generate new tokens
	tokens, err := s.generateTokens(claims.UserID, claims.Email, claims.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	// Blacklist old refresh token
	s.redis.Set(context.Background(), "blacklist:"+req.RefreshToken, "1", 7*24*time.Hour)

	writeJSON(w, http.StatusOK, tokens)
}

func (s *Service) HandleLogout(w http.ResponseWriter, r *http.Request) {
	// Get token from header
	token := extractToken(r)
	if token != "" {
		// Blacklist the token
		s.redis.Set(context.Background(), "blacklist:"+token, "1", 24*time.Hour)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (s *Service) HandleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Generate reset token (in production, send via email)
	resetToken := uuid.New().String()
	s.redis.Set(context.Background(), "reset:"+resetToken, req.Email, 1*time.Hour)

	// Always return success to prevent email enumeration
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "If the email exists, a reset link has been sent",
	})
}

func (s *Service) HandleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate reset token
	email, err := s.redis.Get(context.Background(), "reset:"+req.Token).Result()
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid or expired reset token")
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to process password")
		return
	}

	// Update password
	_, err = s.db.Pool.Exec(context.Background(),
		`UPDATE users SET password_hash = $1, updated_at = $2 WHERE email = $3`,
		string(hashedPassword), time.Now(), email,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to reset password")
		return
	}

	// Delete reset token
	s.redis.Del(context.Background(), "reset:"+req.Token)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}

func (s *Service) HandleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	// Stub — in production, validate email verification token
	writeJSON(w, http.StatusOK, map[string]string{"message": "Email verified"})
}

func (s *Service) HandleOAuthRedirect(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")

	var authURL string
	switch provider {
	case "google":
		authURL = fmt.Sprintf(
			"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s/auth/oauth/google/callback&response_type=code&scope=openid+email+profile",
			s.config.GoogleClientID, s.config.BaseURL,
		)
	case "github":
		authURL = fmt.Sprintf(
			"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s/auth/oauth/github/callback&scope=user:email",
			s.config.GitHubClientID, s.config.BaseURL,
		)
	case "microsoft":
		authURL = fmt.Sprintf(
			"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=%s&redirect_uri=%s/auth/oauth/microsoft/callback&response_type=code&scope=openid+email+profile",
			s.config.MicrosoftClientID, s.config.BaseURL,
		)
	case "apple":
		authURL = fmt.Sprintf(
			"https://appleid.apple.com/auth/authorize?client_id=%s&redirect_uri=%s/auth/oauth/apple/callback&response_type=code&scope=name+email",
			s.config.AppleClientID, s.config.BaseURL,
		)
	default:
		writeError(w, http.StatusBadRequest, "Unsupported OAuth provider")
		return
	}

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (s *Service) HandleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	code := r.URL.Query().Get("code")

	if code == "" {
		writeError(w, http.StatusBadRequest, "Missing authorization code")
		return
	}

	var email, name, providerID string
	var err error

	switch provider {
	case "google":
		email, name, providerID, err = s.exchangeGoogleCode(code)
	default:
		writeError(w, http.StatusBadRequest, "Unsupported provider: "+provider)
		return
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, "OAuth failed: "+err.Error())
		return
	}

	// Find or create user
	var userID, role string
	err = s.db.Pool.QueryRow(context.Background(),
		`SELECT id, role FROM users WHERE email = $1`, email).Scan(&userID, &role)

	if err != nil {
		// User doesn't exist, create one
		userID = uuid.New().String()
		now := time.Now()
		_, err = s.db.Pool.Exec(context.Background(),
			`INSERT INTO users (id, email, display_name, role, plan, oauth_provider, oauth_provider_id, email_verified, created_at, updated_at)
			 VALUES ($1, $2, $3, 'user', 'free', $4, $5, true, $6, $6)`,
			userID, email, name, provider, providerID, now)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to create user")
			return
		}
		role = "user"

		// Create profile
		s.db.Pool.Exec(context.Background(),
			`INSERT INTO user_profiles (id, user_id, timezone, language, theme, notifications_enabled, created_at, updated_at)
			 VALUES ($1, $2, 'UTC', 'en', 'dark', true, $3, $3)`,
			uuid.New().String(), userID, now)
	}

	// Generate tokens
	tokens, err := s.generateTokens(userID, email, role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	s.createSession(userID, r)

	// Redirect to frontend with token
	redirectURL := fmt.Sprintf("%s/app?token=%s", s.config.FrontendURL, tokens.AccessToken)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// exchangeGoogleCode exchanges a Google auth code for user info.
func (s *Service) exchangeGoogleCode(code string) (email, name, providerID string, err error) {
	// Exchange code for tokens
	redirectURI := s.config.BaseURL + "/auth/oauth/google/callback"
	tokenResp, err := http.PostForm("https://oauth2.googleapis.com/token", map[string][]string{
		"code":          {code},
		"client_id":     {s.config.GoogleClientID},
		"client_secret": {s.config.GoogleClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return "", "", "", fmt.Errorf("token exchange failed: %w", err)
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil {
		return "", "", "", fmt.Errorf("failed to decode token response: %w", err)
	}
	if tokenData.Error != "" {
		return "", "", "", fmt.Errorf("google error: %s - %s (redirect_uri=%s)", tokenData.Error, tokenData.ErrorDesc, redirectURI)
	}

	// Get user info from Google
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+tokenData.AccessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	userResp, err := client.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("userinfo request failed: %w", err)
	}
	defer userResp.Body.Close()

	var userInfo struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&userInfo); err != nil {
		return "", "", "", fmt.Errorf("failed to decode userinfo: %w", err)
	}

	return userInfo.Email, userInfo.Name, userInfo.ID, nil
}

func (s *Service) HandleEnable2FA(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(UserContextKey).(*UserClaims)

	// Generate TOTP secret
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Astra",
		AccountName: claims.Email,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate 2FA secret")
		return
	}

	// Store secret temporarily (user must verify before it's activated)
	s.redis.Set(context.Background(), "2fa_pending:"+claims.UserID, key.Secret(), 10*time.Minute)

	writeJSON(w, http.StatusOK, Enable2FAResponse{
		Secret: key.Secret(),
		QRCode: key.URL(),
	})
}

func (s *Service) HandleVerify2FA(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(UserContextKey).(*UserClaims)

	var req Verify2FARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get pending secret
	secret, err := s.redis.Get(context.Background(), "2fa_pending:"+claims.UserID).Result()
	if err != nil {
		writeError(w, http.StatusBadRequest, "No pending 2FA setup. Please start the process again.")
		return
	}

	// Validate code
	if !totp.Validate(req.Code, secret) {
		writeError(w, http.StatusBadRequest, "Invalid 2FA code")
		return
	}

	// Activate 2FA
	_, err = s.db.Pool.Exec(context.Background(),
		`UPDATE users SET two_factor_enabled = true, two_factor_secret = $1, updated_at = $2 WHERE id = $3`,
		secret, time.Now(), claims.UserID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to enable 2FA")
		return
	}

	// Clean up pending key
	s.redis.Del(context.Background(), "2fa_pending:"+claims.UserID)

	writeJSON(w, http.StatusOK, map[string]string{"message": "2FA enabled successfully"})
}

func (s *Service) HandleDisable2FA(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(UserContextKey).(*UserClaims)

	_, err := s.db.Pool.Exec(context.Background(),
		`UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, updated_at = $1 WHERE id = $2`,
		time.Now(), claims.UserID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to disable 2FA")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "2FA disabled successfully"})
}

func (s *Service) HandleListSessions(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(UserContextKey).(*UserClaims)

	rows, err := s.db.Pool.Query(context.Background(),
		`SELECT id, device_name, ip_address, last_active, is_current FROM sessions WHERE user_id = $1 ORDER BY last_active DESC`,
		claims.UserID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch sessions")
		return
	}
	defer rows.Close()

	type SessionInfo struct {
		ID         string    `json:"id"`
		DeviceName string    `json:"device_name"`
		IPAddress  string    `json:"ip_address"`
		LastActive time.Time `json:"last_active"`
		IsCurrent  bool      `json:"is_current"`
	}

	var sessions []SessionInfo
	for rows.Next() {
		var session SessionInfo
		if err := rows.Scan(&session.ID, &session.DeviceName, &session.IPAddress, &session.LastActive, &session.IsCurrent); err != nil {
			continue
		}
		sessions = append(sessions, session)
	}

	writeJSON(w, http.StatusOK, sessions)
}

func (s *Service) HandleRevokeSession(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(UserContextKey).(*UserClaims)
	sessionID := chi.URLParam(r, "id")

	_, err := s.db.Pool.Exec(context.Background(),
		`DELETE FROM sessions WHERE id = $1 AND user_id = $2`,
		sessionID, claims.UserID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to revoke session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Session revoked"})
}

// --- Middleware ---

func (s *Service) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractToken(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "Missing authorization token")
			return
		}

		// Check blacklist
		blacklisted, _ := s.redis.Get(context.Background(), "blacklist:"+token).Result()
		if blacklisted != "" {
			writeError(w, http.StatusUnauthorized, "Token has been revoked")
			return
		}

		claims, err := s.validateToken(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- Internal helpers ---

func (s *Service) generateTokens(userID, email, role string) (*TokenResponse, error) {
	// Access token (15 minutes)
	accessClaims := jwt.MapClaims{
		"sub":   userID,
		"email": email,
		"role":  role,
		"type":  "access",
		"exp":   time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
		"jti":   uuid.New().String(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return nil, err
	}

	// Refresh token (7 days)
	refreshClaims := jwt.MapClaims{
		"sub":  userID,
		"email": email,
		"role": role,
		"type": "refresh",
		"exp":  time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
		"jti":  uuid.New().String(),
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
		ExpiresIn:    900, // 15 minutes in seconds
		TokenType:    "Bearer",
	}, nil
}

func (s *Service) validateToken(tokenStr string) (*UserClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.config.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return &UserClaims{
		UserID: claims["sub"].(string),
		Email:  claims["email"].(string),
		Role:   claims["role"].(string),
	}, nil
}

func (s *Service) createSession(userID string, r *http.Request) {
	sessionID := uuid.New().String()
	deviceName := r.UserAgent()
	if len(deviceName) > 100 {
		deviceName = deviceName[:100]
	}
	ipAddress := r.RemoteAddr

	s.db.Pool.Exec(context.Background(),
		`INSERT INTO sessions (id, user_id, device_name, ip_address, last_active, is_current, created_at)
		 VALUES ($1, $2, $3, $4, $5, true, $5)`,
		sessionID, userID, deviceName, ipAddress, time.Now(),
	)
}

// --- Utility functions ---

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}
	return parts[1]
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
