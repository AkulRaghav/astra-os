#!/usr/bin/env bash
# Astra Load Test Script
# Dependencies: hey (preferred), ab (Apache Bench), or curl
# Install hey: go install github.com/rakyll/hey@latest
#
# Usage: ./scripts/load-test.sh [BASE_URL]

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
WS_URL="${2:-ws://localhost:8081}"
CONCURRENCY=50
REQUESTS=1000
DURATION="30s"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Astra Load Test ===${NC}"
echo "Target: $BASE_URL"
echo "Concurrency: $CONCURRENCY"
echo ""

# Detect available load testing tool
if command -v hey &> /dev/null; then
    TOOL="hey"
elif command -v ab &> /dev/null; then
    TOOL="ab"
else
    TOOL="curl"
    echo -e "${YELLOW}Warning: 'hey' or 'ab' not found. Using curl (limited).${NC}"
    echo "Install hey: go install github.com/rakyll/hey@latest"
fi

run_hey() {
    local method="$1"
    local url="$2"
    local body="${3:-}"
    local desc="$4"

    echo -e "\n${YELLOW}[$desc]${NC} $method $url"
    if [ -n "$body" ]; then
        hey -n "$REQUESTS" -c "$CONCURRENCY" -m "$method" \
            -H "Content-Type: application/json" \
            -d "$body" "$url" 2>&1 | grep -E "(Requests/sec|Average|Fastest|Slowest|Status code)"
    else
        hey -n "$REQUESTS" -c "$CONCURRENCY" -m "$method" "$url" 2>&1 | \
            grep -E "(Requests/sec|Average|Fastest|Slowest|Status code)"
    fi
}

run_ab() {
    local method="$1"
    local url="$2"
    local body="${3:-}"
    local desc="$4"

    echo -e "\n${YELLOW}[$desc]${NC} $method $url"
    if [ -n "$body" ]; then
        echo "$body" > /tmp/astra-ab-body.json
        ab -n "$REQUESTS" -c "$CONCURRENCY" -m "$method" \
            -T "application/json" -p /tmp/astra-ab-body.json \
            "$url" 2>&1 | grep -E "(Requests per second|Time per request|Failed)"
    else
        ab -n "$REQUESTS" -c "$CONCURRENCY" -m "$method" \
            "$url" 2>&1 | grep -E "(Requests per second|Time per request|Failed)"
    fi
}

run_curl() {
    local method="$1"
    local url="$2"
    local body="${3:-}"
    local desc="$4"
    local count=100

    echo -e "\n${YELLOW}[$desc]${NC} $method $url (${count} sequential requests)"
    local total=0
    local failures=0
    for i in $(seq 1 $count); do
        if [ -n "$body" ]; then
            status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
                -H "Content-Type: application/json" -d "$body" "$url")
        else
            status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
        fi
        if [[ "$status" -ge 400 ]]; then
            ((failures++))
        fi
        ((total++))
    done
    echo "  Completed: $total | Failed: $failures | Success rate: $(( (total - failures) * 100 / total ))%"
}

run_test() {
    case "$TOOL" in
        hey) run_hey "$@" ;;
        ab)  run_ab "$@" ;;
        *)   run_curl "$@" ;;
    esac
}

# ===== Test 1: Health Check =====
echo -e "\n${GREEN}--- 1. Health Check Endpoint ---${NC}"
run_test "GET" "$BASE_URL/health" "" "Health Check"

# ===== Test 2: Authentication =====
echo -e "\n${GREEN}--- 2. Auth Endpoints ---${NC}"
LOGIN_BODY='{"email":"loadtest@astra.dev","password":"LoadTest123!"}'
run_test "POST" "$BASE_URL/auth/login" "$LOGIN_BODY" "Login"

SIGNUP_BODY='{"email":"newuser-$RANDOM@astra.dev","password":"Test1234!","name":"Load Test"}'
run_test "POST" "$BASE_URL/auth/signup" "$SIGNUP_BODY" "Signup"

# ===== Test 3: File Upload (simulated) =====
echo -e "\n${GREEN}--- 3. File Operations ---${NC}"
run_test "GET" "$BASE_URL/api/v1/files" "" "List Files"
run_test "GET" "$BASE_URL/api/v1/files/quota" "" "Storage Quota"

# ===== Test 4: AI Chat =====
echo -e "\n${GREEN}--- 4. AI Chat Endpoint ---${NC}"
CHAT_BODY='{"message":"Hello, how are you?","conversation_id":"load-test"}'
run_test "POST" "$BASE_URL/api/v1/ai/chat" "$CHAT_BODY" "AI Chat"

# ===== Test 5: API Endpoints Mix =====
echo -e "\n${GREEN}--- 5. Mixed API Load ---${NC}"
run_test "GET" "$BASE_URL/api/v1/tasks" "" "List Tasks"
run_test "GET" "$BASE_URL/api/v1/notes" "" "List Notes"
run_test "GET" "$BASE_URL/api/v1/notifications/count" "" "Notification Count"
run_test "GET" "$BASE_URL/api/v1/calendar/events" "" "Calendar Events"

# ===== Test 6: WebSocket (basic connectivity check) =====
echo -e "\n${GREEN}--- 6. WebSocket Connectivity ---${NC}"
if command -v websocat &> /dev/null; then
    echo "Testing WebSocket connection..."
    echo '{"type":"ping"}' | timeout 5 websocat "$WS_URL/ws" 2>/dev/null && \
        echo -e "  ${GREEN}WebSocket: OK${NC}" || \
        echo -e "  ${RED}WebSocket: FAILED${NC}"
else
    echo -e "  ${YELLOW}Skipped (install websocat for WS testing)${NC}"
fi

# ===== Test 7: Rate Limiting Verification =====
echo -e "\n${GREEN}--- 7. Rate Limit Test ---${NC}"
echo "Sending burst of 200 rapid requests..."
RATE_LIMITED=0
for i in $(seq 1 200); do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
    if [ "$status" = "429" ]; then
        ((RATE_LIMITED++))
    fi
done
echo "  Requests rate-limited (429): $RATE_LIMITED / 200"
if [ "$RATE_LIMITED" -gt 0 ]; then
    echo -e "  ${GREEN}Rate limiting is active${NC}"
else
    echo -e "  ${YELLOW}No rate limiting detected (may need tuning)${NC}"
fi

echo -e "\n${GREEN}=== Load Test Complete ===${NC}"
