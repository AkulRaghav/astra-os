package redis

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	*redis.Client
}

func Connect(redisURL string) (*Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	// Test connection
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("unable to ping Redis: %w", err)
	}

	return &Client{Client: client}, nil
}

// NewNoop returns a nil-safe Client that no-ops on all operations.
func NewNoop() *Client {
	return &Client{Client: redis.NewClient(&redis.Options{Addr: "localhost:6379"})}
}
