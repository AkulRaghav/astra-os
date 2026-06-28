package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SettingsService struct {
	db *pgxpool.Pool
}

func NewSettingsService(db *pgxpool.Pool) *SettingsService {
	return &SettingsService{db: db}
}

type UserWithProfile struct {
	ID               string  `json:"id"`
	Email            string  `json:"email"`
	DisplayName      string  `json:"display_name"`
	AvatarURL        *string `json:"avatar_url,omitempty"`
	Role             string  `json:"role"`
	Plan             string  `json:"plan"`
	TwoFactorEnabled bool    `json:"two_factor_enabled"`
	Bio              *string `json:"bio,omitempty"`
	Timezone         string  `json:"timezone"`
	Language         string  `json:"language"`
	Theme            string  `json:"theme"`
	NotificationsEnabled bool `json:"notifications_enabled"`
	EmailNotifications   bool `json:"email_notifications"`
	PushNotifications    bool `json:"push_notifications"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type UpdateProfileInput struct {
	DisplayName *string
	Bio         *string
	Timezone    *string
	Language    *string
}

type UpdateSettingsInput struct {
	Theme                *string
	Language             *string
	Timezone             *string
	NotificationsEnabled *bool
	EmailNotifications   *bool
	PushNotifications    *bool
}

func (s *SettingsService) GetMe(ctx context.Context, userID string) (*UserWithProfile, error) {
	var u UserWithProfile
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, u.plan, u.two_factor_enabled,
		        p.bio, p.timezone, p.language, p.theme, p.notifications_enabled, p.email_notifications, p.push_notifications,
		        u.created_at, u.updated_at
		 FROM users u
		 LEFT JOIN user_profiles p ON p.user_id = u.id
		 WHERE u.id = $1`, userID).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.AvatarURL, &u.Role, &u.Plan, &u.TwoFactorEnabled,
			&u.Bio, &u.Timezone, &u.Language, &u.Theme, &u.NotificationsEnabled, &u.EmailNotifications, &u.PushNotifications,
			&u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

func (s *SettingsService) UpdateProfile(ctx context.Context, userID string, input UpdateProfileInput) (*UserWithProfile, error) {
	now := time.Now()

	if input.DisplayName != nil {
		_, err := s.db.Exec(ctx,
			`UPDATE users SET display_name = $1, updated_at = $2 WHERE id = $3`,
			*input.DisplayName, now, userID)
		if err != nil {
			return nil, fmt.Errorf("update user name: %w", err)
		}
	}

	// Update profile fields
	if input.Bio != nil || input.Timezone != nil || input.Language != nil {
		sets := "updated_at = $1"
		args := []interface{}{now}
		argIdx := 2

		if input.Bio != nil {
			sets += fmt.Sprintf(", bio = $%d", argIdx)
			args = append(args, *input.Bio)
			argIdx++
		}
		if input.Timezone != nil {
			sets += fmt.Sprintf(", timezone = $%d", argIdx)
			args = append(args, *input.Timezone)
			argIdx++
		}
		if input.Language != nil {
			sets += fmt.Sprintf(", language = $%d", argIdx)
			args = append(args, *input.Language)
			argIdx++
		}

		args = append(args, userID)
		query := fmt.Sprintf("UPDATE user_profiles SET %s WHERE user_id = $%d", sets, argIdx)
		s.db.Exec(ctx, query, args...)
	}

	return s.GetMe(ctx, userID)
}

func (s *SettingsService) UpdateAvatar(ctx context.Context, userID string, url string) (*UserWithProfile, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3`,
		url, time.Now(), userID)
	if err != nil {
		return nil, fmt.Errorf("update avatar: %w", err)
	}
	return s.GetMe(ctx, userID)
}

func (s *SettingsService) UpdateSettings(ctx context.Context, userID string, input UpdateSettingsInput) (*UserWithProfile, error) {
	now := time.Now()
	sets := "updated_at = $1"
	args := []interface{}{now}
	argIdx := 2

	if input.Theme != nil {
		sets += fmt.Sprintf(", theme = $%d", argIdx)
		args = append(args, *input.Theme)
		argIdx++
	}
	if input.Language != nil {
		sets += fmt.Sprintf(", language = $%d", argIdx)
		args = append(args, *input.Language)
		argIdx++
	}
	if input.Timezone != nil {
		sets += fmt.Sprintf(", timezone = $%d", argIdx)
		args = append(args, *input.Timezone)
		argIdx++
	}
	if input.NotificationsEnabled != nil {
		sets += fmt.Sprintf(", notifications_enabled = $%d", argIdx)
		args = append(args, *input.NotificationsEnabled)
		argIdx++
	}
	if input.EmailNotifications != nil {
		sets += fmt.Sprintf(", email_notifications = $%d", argIdx)
		args = append(args, *input.EmailNotifications)
		argIdx++
	}
	if input.PushNotifications != nil {
		sets += fmt.Sprintf(", push_notifications = $%d", argIdx)
		args = append(args, *input.PushNotifications)
		argIdx++
	}

	args = append(args, userID)
	query := fmt.Sprintf("UPDATE user_profiles SET %s WHERE user_id = $%d", sets, argIdx)
	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update settings: %w", err)
	}

	return s.GetMe(ctx, userID)
}

// --- Billing ---

type BillingInfo struct {
	ID                   string    `json:"id"`
	UserID               string    `json:"user_id"`
	StripeCustomerID     *string   `json:"stripe_customer_id,omitempty"`
	StripeSubscriptionID *string   `json:"stripe_subscription_id,omitempty"`
	PlanID               *string   `json:"plan_id,omitempty"`
	Status               string    `json:"status"`
	CurrentPeriodStart   *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd     *time.Time `json:"current_period_end,omitempty"`
	Plan                 *BillingPlan `json:"plan,omitempty"`
}

type BillingPlan struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Tier         string   `json:"tier"`
	PriceMonthly float64  `json:"price_monthly"`
	PriceYearly  float64  `json:"price_yearly"`
	Features     []string `json:"features"`
}

type Invoice struct {
	ID        string    `json:"id"`
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	Status    string    `json:"status"`
	PDFURL    *string   `json:"pdf_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *SettingsService) GetBillingInfo(ctx context.Context, userID string) (*BillingInfo, error) {
	var b BillingInfo
	err := s.db.QueryRow(ctx,
		`SELECT bi.id, bi.user_id, bi.stripe_customer_id, bi.stripe_subscription_id, bi.plan_id, bi.status, bi.current_period_start, bi.current_period_end
		 FROM billing_info bi WHERE bi.user_id = $1`, userID).
		Scan(&b.ID, &b.UserID, &b.StripeCustomerID, &b.StripeSubscriptionID, &b.PlanID, &b.Status, &b.CurrentPeriodStart, &b.CurrentPeriodEnd)
	if err != nil {
		// No billing record yet — return free plan defaults
		return &BillingInfo{
			UserID: userID,
			Status: "active",
			Plan: &BillingPlan{
				Name:         "Free",
				Tier:         "free",
				PriceMonthly: 0,
				PriceYearly:  0,
				Features:     []string{"5GB Storage", "50 AI requests/day"},
			},
		}, nil
	}

	// Load plan details
	if b.PlanID != nil {
		var plan BillingPlan
		err = s.db.QueryRow(ctx,
			`SELECT id, name, tier, price_monthly, price_yearly, features FROM billing_plans WHERE id = $1`, *b.PlanID).
			Scan(&plan.ID, &plan.Name, &plan.Tier, &plan.PriceMonthly, &plan.PriceYearly, &plan.Features)
		if err == nil {
			b.Plan = &plan
		}
	}

	return &b, nil
}

func (s *SettingsService) ListPlans(ctx context.Context) ([]BillingPlan, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, tier, price_monthly, price_yearly, features FROM billing_plans WHERE is_active = true ORDER BY price_monthly ASC`)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []BillingPlan
	for rows.Next() {
		var p BillingPlan
		if err := rows.Scan(&p.ID, &p.Name, &p.Tier, &p.PriceMonthly, &p.PriceYearly, &p.Features); err != nil {
			return nil, err
		}
		plans = append(plans, p)
	}
	if plans == nil {
		plans = []BillingPlan{}
	}
	return plans, nil
}

func (s *SettingsService) ListInvoices(ctx context.Context, userID string) ([]Invoice, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, amount, currency, status, pdf_url, created_at FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list invoices: %w", err)
	}
	defer rows.Close()

	var invoices []Invoice
	for rows.Next() {
		var inv Invoice
		if err := rows.Scan(&inv.ID, &inv.Amount, &inv.Currency, &inv.Status, &inv.PDFURL, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invoices = append(invoices, inv)
	}
	if invoices == nil {
		invoices = []Invoice{}
	}
	return invoices, nil
}

type CheckoutSession struct {
	URL       string `json:"url"`
	SessionID string `json:"session_id"`
}

func (s *SettingsService) CreateCheckoutSession(ctx context.Context, userID string, planID string) (*CheckoutSession, error) {
	// In production, create a real Stripe Checkout session
	// For now, return a stub
	return &CheckoutSession{
		URL:       fmt.Sprintf("https://checkout.stripe.com/stub?plan=%s&user=%s", planID, userID),
		SessionID: "cs_stub_" + userID,
	}, nil
}

func (s *SettingsService) CancelSubscription(ctx context.Context, userID string) (*BillingInfo, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE billing_info SET status = 'cancelled', updated_at = $1 WHERE user_id = $2`,
		time.Now(), userID)
	if err != nil {
		return nil, fmt.Errorf("cancel subscription: %w", err)
	}
	return s.GetBillingInfo(ctx, userID)
}
