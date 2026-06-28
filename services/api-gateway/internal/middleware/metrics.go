package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

// ===== Prometheus-compatible Metrics =====

// Metrics holds application-level HTTP metrics.
type Metrics struct {
	requestCount     map[string]*atomic.Int64
	requestDuration  *histogram
	activeConns      atomic.Int64
	mu               sync.RWMutex
}

// histogram implements a simple histogram with pre-defined buckets.
type histogram struct {
	buckets []float64
	counts  []atomic.Int64
	sum     atomic.Int64 // stored as microseconds
	count   atomic.Int64
}

func newHistogram(buckets []float64) *histogram {
	return &histogram{
		buckets: buckets,
		counts:  make([]atomic.Int64, len(buckets)+1), // +1 for +Inf
	}
}

func (h *histogram) observe(seconds float64) {
	h.count.Add(1)
	h.sum.Add(int64(seconds * 1e6))
	for i, b := range h.buckets {
		if seconds <= b {
			h.counts[i].Add(1)
		}
	}
	h.counts[len(h.buckets)].Add(1) // +Inf
}

// NewMetrics creates a new Metrics instance with standard HTTP buckets.
func NewMetrics() *Metrics {
	return &Metrics{
		requestCount: make(map[string]*atomic.Int64),
		requestDuration: newHistogram([]float64{
			0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
		}),
	}
}

func (m *Metrics) incRequestCount(method, path string, status int) {
	key := method + "|" + path + "|" + strconv.Itoa(status)
	m.mu.RLock()
	counter, exists := m.requestCount[key]
	m.mu.RUnlock()
	if exists {
		counter.Add(1)
		return
	}
	m.mu.Lock()
	counter, exists = m.requestCount[key]
	if !exists {
		counter = &atomic.Int64{}
		m.requestCount[key] = counter
	}
	m.mu.Unlock()
	counter.Add(1)
}

// Middleware returns an HTTP middleware that records metrics.
func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.activeConns.Add(1)
		defer m.activeConns.Add(-1)

		start := time.Now()
		ww := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)

		duration := time.Since(start).Seconds()
		m.requestDuration.observe(duration)
		m.incRequestCount(r.Method, r.URL.Path, ww.status)
	})
}

// Handler returns an HTTP handler that exposes metrics in Prometheus text format.
func (m *Metrics) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		// Active connections
		fmt.Fprintf(w, "# HELP astra_http_active_connections Current active HTTP connections\n")
		fmt.Fprintf(w, "# TYPE astra_http_active_connections gauge\n")
		fmt.Fprintf(w, "astra_http_active_connections %d\n\n", m.activeConns.Load())

		// Request count
		fmt.Fprintf(w, "# HELP astra_http_requests_total Total HTTP requests\n")
		fmt.Fprintf(w, "# TYPE astra_http_requests_total counter\n")
		m.mu.RLock()
		for key, counter := range m.requestCount {
			method, path, status := parseKey(key)
			fmt.Fprintf(w, "astra_http_requests_total{method=%q,path=%q,status=%q} %d\n",
				method, path, status, counter.Load())
		}
		m.mu.RUnlock()
		fmt.Fprintln(w)

		// Duration histogram
		fmt.Fprintf(w, "# HELP astra_http_request_duration_seconds HTTP request duration in seconds\n")
		fmt.Fprintf(w, "# TYPE astra_http_request_duration_seconds histogram\n")
		var cumulative int64
		for i, b := range m.requestDuration.buckets {
			cumulative += m.requestDuration.counts[i].Load()
			fmt.Fprintf(w, "astra_http_request_duration_seconds_bucket{le=%q} %d\n",
				strconv.FormatFloat(b, 'f', -1, 64), cumulative)
		}
		cumulative += m.requestDuration.counts[len(m.requestDuration.buckets)].Load()
		fmt.Fprintf(w, "astra_http_request_duration_seconds_bucket{le=\"+Inf\"} %d\n", cumulative)
		fmt.Fprintf(w, "astra_http_request_duration_seconds_sum %f\n",
			float64(m.requestDuration.sum.Load())/1e6)
		fmt.Fprintf(w, "astra_http_request_duration_seconds_count %d\n",
			m.requestDuration.count.Load())
	}
}

// statusWriter wraps http.ResponseWriter to capture status codes.
type statusWriter struct {
	http.ResponseWriter
	status int
	written bool
}

func (sw *statusWriter) WriteHeader(code int) {
	if !sw.written {
		sw.status = code
		sw.written = true
	}
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Write(b []byte) (int, error) {
	if !sw.written {
		sw.written = true
	}
	return sw.ResponseWriter.Write(b)
}

func parseKey(key string) (method, path, status string) {
	var parts [3]string
	idx := 0
	start := 0
	for i, c := range key {
		if c == '|' && idx < 2 {
			parts[idx] = key[start:i]
			idx++
			start = i + 1
		}
	}
	parts[idx] = key[start:]
	return parts[0], parts[1], parts[2]
}
