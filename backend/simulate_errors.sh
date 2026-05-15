#!/bin/bash

BASE_URL="http://localhost:8880/api/v1/test"
ENDPOINTS=("error" "db-error" "io-error" "timeout")
TOTAL_REQUESTS=40 # 10 per endpoint per iteration
ERROR_RATE=25 # 25% chance of error on the generic "error" endpoint

echo -e "\e[36mStarting multi-endpoint error burst to trigger observability alerts...\e[0m"
echo "Target Base: $BASE_URL"
echo "Endpoints: ${ENDPOINTS[*]}"

for i in {1..10}; do
    echo -e "\n\e[33mIteration $i of 10...\e[0m"
    for endpoint in "${ENDPOINTS[@]}"; do
        echo -n "Bursting /$endpoint: "
        for j in {1..10}; do
            URL="$BASE_URL/$endpoint"
            
            # Special logic for the generic error endpoint
            if [ "$endpoint" == "error" ]; then
                STATUS_CODE=200
                RAND=$(( RANDOM % 100 ))
                if [ $RAND -lt $ERROR_RATE ]; then
                    STATUS_CODE=500
                fi
                URL="$URL?code=$STATUS_CODE"
            fi

            # Send request
            RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
            
            if [[ "$RESPONSE" =~ ^5 ]]; then
                echo -ne "\e[31mX\e[0m"
            elif [[ "$RESPONSE" =~ ^2 ]]; then
                echo -ne "\e[32m.\e[0m"
            else
                echo -ne "\e[37m!\e[0m"
            fi
        done
        echo ""
    done
    echo "Waiting 5 seconds..."
    sleep 5
done

echo -e "\n\e[36mSimulation complete. High error rate alert should trigger shortly.\e[0m"
