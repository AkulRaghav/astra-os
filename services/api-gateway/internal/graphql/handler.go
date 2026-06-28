package graphql

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/astra-os/api-gateway/internal/auth"
	"github.com/astra-os/api-gateway/internal/database"
	redisclient "github.com/astra-os/api-gateway/internal/redis"
)

type Handler struct {
	resolver *Resolver
}

type GraphQLRequest struct {
	Query         string                 `json:"query"`
	OperationName string                 `json:"operationName,omitempty"`
	Variables     map[string]interface{} `json:"variables,omitempty"`
}

type GraphQLResponse struct {
	Data   interface{}    `json:"data,omitempty"`
	Errors []GraphQLError `json:"errors,omitempty"`
}

type GraphQLError struct {
	Message string   `json:"message"`
	Path    []string `json:"path,omitempty"`
}

func NewHandler(db *database.DB, redis *redisclient.Client, authService *auth.Service) http.Handler {
	h := &Handler{
		resolver: NewResolver(db, redis),
	}
	return h
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req GraphQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeGraphQLError(w, "Invalid request body")
		return
	}

	result := h.executeQuery(r, req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *Handler) executeQuery(r *http.Request, req GraphQLRequest) GraphQLResponse {
	ctx := r.Context()

	// Simple query parser - extracts operation type and field name
	query := strings.TrimSpace(req.Query)

	// Determine if query or mutation
	var opType string
	if strings.HasPrefix(query, "mutation") {
		opType = "mutation"
	} else if strings.HasPrefix(query, "query") || strings.HasPrefix(query, "{") {
		opType = "query"
	} else {
		return GraphQLResponse{Errors: []GraphQLError{{Message: "Invalid operation"}}}
	}

	// Extract field name (simplified parser)
	field := extractTopLevelField(query)
	if field == "" {
		// Try introspection
		if strings.Contains(query, "__schema") || strings.Contains(query, "__type") || strings.Contains(query, "_service") {
			return GraphQLResponse{
				Data: map[string]interface{}{
					"_service": map[string]interface{}{
						"name":    "astra-api-gateway",
						"version": "0.1.0",
						"status":  "operational",
					},
				},
			}
		}
		return GraphQLResponse{Errors: []GraphQLError{{Message: "Could not parse query field"}}}
	}

	// Merge variables into args
	args := req.Variables
	if args == nil {
		args = extractInlineArgs(query, field)
	}

	var result interface{}
	var err error

	switch opType {
	case "query":
		result, err = h.resolver.resolveQuery(ctx, field, args)
	case "mutation":
		result, err = h.resolver.resolveMutation(ctx, field, args)
	}

	if err != nil {
		return GraphQLResponse{
			Errors: []GraphQLError{{Message: err.Error(), Path: []string{field}}},
		}
	}

	return GraphQLResponse{
		Data: map[string]interface{}{field: result},
	}
}

// extractTopLevelField is a simplified field extractor
func extractTopLevelField(query string) string {
	// Remove operation type prefix
	query = strings.TrimPrefix(query, "query")
	query = strings.TrimPrefix(query, "mutation")

	// Remove operation name if present
	if idx := strings.Index(query, "{"); idx >= 0 {
		query = query[idx+1:]
	}

	// Get first field name
	query = strings.TrimSpace(query)
	// Skip whitespace and find first word
	end := 0
	for end < len(query) && query[end] != '(' && query[end] != '{' && query[end] != ' ' && query[end] != '\n' {
		end++
	}
	if end == 0 {
		return ""
	}
	return strings.TrimSpace(query[:end])
}

// extractInlineArgs does a best-effort extraction of inline GraphQL arguments
func extractInlineArgs(query string, field string) map[string]interface{} {
	args := make(map[string]interface{})

	// Find the arguments section after the field name
	fieldIdx := strings.Index(query, field)
	if fieldIdx < 0 {
		return args
	}

	rest := query[fieldIdx+len(field):]
	rest = strings.TrimSpace(rest)

	if !strings.HasPrefix(rest, "(") {
		return args
	}

	// Find matching closing paren
	depth := 0
	end := 0
	for i, c := range rest {
		if c == '(' {
			depth++
		} else if c == ')' {
			depth--
			if depth == 0 {
				end = i
				break
			}
		}
	}

	if end == 0 {
		return args
	}

	argsStr := rest[1:end]
	// Simple key: value parsing
	pairs := splitArgs(argsStr)
	for _, pair := range pairs {
		parts := strings.SplitN(pair, ":", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			value = strings.Trim(value, "\"")
			args[key] = value
		}
	}

	return args
}

func splitArgs(s string) []string {
	var result []string
	depth := 0
	start := 0
	for i, c := range s {
		switch c {
		case '{', '[':
			depth++
		case '}', ']':
			depth--
		case ',':
			if depth == 0 {
				result = append(result, s[start:i])
				start = i + 1
			}
		}
	}
	if start < len(s) {
		result = append(result, s[start:])
	}
	return result
}

func writeGraphQLError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(GraphQLResponse{
		Errors: []GraphQLError{{Message: message}},
	})
}

func PlaygroundHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, playgroundHTML)
	}
}

const playgroundHTML = `<!DOCTYPE html>
<html>
<head>
  <title>Astra GraphQL Playground</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
</head>
<body style="margin: 0;">
  <div id="graphiql" style="height: 100vh;"></div>
  <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
    ReactDOM.render(
      React.createElement(GraphiQL, { fetcher }),
      document.getElementById('graphiql'),
    );
  </script>
</body>
</html>`
