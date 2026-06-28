package auth

import (
	"net/http"
	"testing"
)

func TestExtractToken_Valid(t *testing.T) {
	req, _ := http.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer test-token-123")

	token := extractToken(req)
	if token != "test-token-123" {
		t.Errorf("expected 'test-token-123', got '%s'", token)
	}
}

func TestExtractToken_Missing(t *testing.T) {
	req, _ := http.NewRequest("GET", "/", nil)

	token := extractToken(req)
	if token != "" {
		t.Errorf("expected empty token, got '%s'", token)
	}
}

func TestExtractToken_InvalidFormat(t *testing.T) {
	req, _ := http.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "InvalidFormat")

	token := extractToken(req)
	if token != "" {
		t.Errorf("expected empty token for invalid format, got '%s'", token)
	}
}

func TestExtractToken_WrongScheme(t *testing.T) {
	req, _ := http.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Basic base64credentials")

	token := extractToken(req)
	if token != "" {
		t.Errorf("expected empty token for non-Bearer scheme, got '%s'", token)
	}
}
