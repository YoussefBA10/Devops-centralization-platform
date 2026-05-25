#!/bin/bash

URL="http://localhost:8880/api/v1/test/error?code=500"
DURATION_MINUTES=3
REQUESTS_PER_SECOND=5

echo "--- Prometheus Alert Trigger: HighErrorRate ---"
echo "Target: $URL"
echo "Duration: $DURATION_MINUTES minutes"
echo "Goal: >5% 5xx Error Rate for 2 minutes"

END_TIME=$((SECONDS + DURATION_MINUTES * 60))
TOTAL=0
ERRORS=0

while [ $SECONDS -lt $END_TIME ]; do
    for i in $(seq 1 $REQUESTS_PER_SECOND); do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
        if [ "$CODE" -ge 500 ]; then
            echo -n -e "\e[31mX\e[0m"
            ((ERRORS++))
        else
            echo -n -e "\e[32m.\e[0m"
        fi
        ((TOTAL++))
    done
    
    ELAPSED=$((SECONDS - START_TIME))
    echo " | Total: $TOTAL | Errors: $ERRORS | Elapsed: ${SECONDS}s"
    sleep 1
done

echo -e "\n--- Simulation complete. Alert should be FIRING in Prometheus. ---"
