package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	CORSOrigins []string

	// JWT
	JWTSecret          string
	JWTAccessExpiry    string
	JWTRefreshExpiry   string

	// OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	MicrosoftClientID  string
	MicrosoftClientSecret string
	AppleClientID      string
	AppleClientSecret  string

	// S3
	S3Endpoint  string
	S3Bucket    string
	S3AccessKey string
	S3SecretKey string
	S3Region    string

	// Service URLs
	AIServiceURL   string
	RustServiceURL string
	WSGatewayURL   string

	// App
	BaseURL   string
	FrontendURL string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://astra:astra@localhost:5432/astra?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379/0"),
		CORSOrigins: []string{getEnv("CORS_ORIGIN", "http://localhost:3000")},

		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		JWTAccessExpiry:  getEnv("JWT_ACCESS_EXPIRY", "15m"),
		JWTRefreshExpiry: getEnv("JWT_REFRESH_EXPIRY", "168h"),

		GoogleClientID:        getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:    getEnv("GOOGLE_CLIENT_SECRET", ""),
		GitHubClientID:        getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret:    getEnv("GITHUB_CLIENT_SECRET", ""),
		MicrosoftClientID:     getEnv("MICROSOFT_CLIENT_ID", ""),
		MicrosoftClientSecret: getEnv("MICROSOFT_CLIENT_SECRET", ""),
		AppleClientID:         getEnv("APPLE_CLIENT_ID", ""),
		AppleClientSecret:     getEnv("APPLE_CLIENT_SECRET", ""),

		S3Endpoint:  getEnv("S3_ENDPOINT", "http://localhost:9000"),
		S3Bucket:    getEnv("S3_BUCKET", "astra"),
		S3AccessKey: getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey: getEnv("S3_SECRET_KEY", "minioadmin"),
		S3Region:    getEnv("S3_REGION", "us-east-1"),

		AIServiceURL:   getEnv("AI_SERVICE_URL", "localhost:50051"),
		RustServiceURL: getEnv("RUST_SERVICE_URL", "localhost:50052"),
		WSGatewayURL:   getEnv("WS_GATEWAY_URL", "localhost:8081"),

		BaseURL:     getEnv("BASE_URL", "http://localhost:8080"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
