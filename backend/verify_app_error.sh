#!/bin/bash

# Usage: ./verify_app_error.sh [ENDPOINT_URL] [NUM_REQUESTS]
ENDPOINT_URL=${1:-"http://localhost:8880/api/v1/test/error"}
NUM_REQUESTS=${2:-20}

echo "========================================================"
echo " Starting Application Error Validation Test"
echo " Target Endpoint: $ENDPOINT_URL"
echo " Total Requests : $NUM_REQUESTS"
echo "========================================================"
echo ""

TOTAL=0
SUCCESS=0
ERROR_500=0
OTHER_ERRORS=0

# Create a temporary file for response bodies
TMP_BODY=$(mktemp)

for ((i=1; i<=NUM_REQUESTS; i++)); do
    TOTAL=$((TOTAL+1))
    
    # Execute curl request:
    # -s: silent
    # -w: write-out specific variables (http_code and time_total)
    # -o: output body to temp file
    RESULT=$(curl -s -w "%{http_code}:%{time_total}" -o "$TMP_BODY" "$ENDPOINT_URL")
    
    # Parse results
    HTTP_CODE=$(echo "$RESULT" | cut -d':' -f1)
    DURATION=$(echo "$RESULT" | cut -d':' -f2)
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Read first 50 characters of body for logging
    BODY=$(head -c 50 "$TMP_BODY" | tr -d '\n')
    
    echo "[$TIMESTAMP] Req #$i | Code: $HTTP_CODE | Duration: ${DURATION}s | Body: ${BODY}..."
    
    # Categorize responses
    if [ "$HTTP_CODE" -eq 200 ]; then
        SUCCESS=$((SUCCESS+1))
    elif [ "$HTTP_CODE" -eq 500 ]; then
        ERROR_500=$((ERROR_500+1))
    else
        OTHER_ERRORS=$((OTHER_ERRORS+1))
    fi
    
    # Small sleep to simulate realistic traffic pattern
    sleep 0.1
done

rm -f "$TMP_BODY"

# Calculate failure rate
if [ "$TOTAL" -gt 0 ]; then
    FAILURE_RATE=$(awk "BEGIN {printf \"%.2f\", ($ERROR_500 / $TOTAL) * 100}")
else
    FAILURE_RATE="0.00"
fi

echo ""
echo "========================================================"
echo " Test Report Summary"
echo "========================================================"
echo " Total Requests      : $TOTAL"
echo " Successful (200)    : $SUCCESS"
echo " HTTP 500 Responses  : $ERROR_500"
echo " Other Responses     : $OTHER_ERRORS"
echo " Failure Rate (500s) : ${FAILURE_RATE}%"
echo "========================================================"
