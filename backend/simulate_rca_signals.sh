#!/bin/bash

# simulate_rca_signals.sh
# Simulates RCA conditions by triggering specific endpoints in the backend
# which log the target strings AND actually crash or return 500s.
# This ensures tickets are properly triggered in the downstream systems.

SCENARIO=$1
BASE_URL="http://localhost:8880/api/v1/test"

if [ -z "$SCENARIO" ]; then
    echo "Usage: ./simulate_rca_signals.sh [database|deployment|config|network|dependency|traffic|all]"
    echo ""
    echo "Available scenarios:"
    echo "  database   - Simulates DB pool exhaustion (Returns 500)"
    echo "  deployment - Simulates K8s CrashLoopBackOff (Crashes App!)"
    echo "  config     - Simulates invalid YAML/Secrets (Crashes App!)"
    echo "  network    - Simulates DNS resolution issues (Returns 504)"
    echo "  dependency - Simulates Redis/Kafka unavailability (Returns 500)"
    echo "  traffic    - Sends burst of traffic (Triggers 429 & metrics spike)"
    echo "  all        - Runs all simulations sequentially (Warning: Includes crashes)"
    exit 1
fi

run_database() {
    echo "=== Simulating DATABASE_CONNECTION_FAILURE ==="
    echo "Sending 50 requests to trigger Prometheus 5xx alert threshold..."
    for i in {1..50}; do
        curl -s -X GET "${BASE_URL}/rca/db" > /dev/null
    done
    echo "Endpoint triggered. Database errors logged."
}

run_deployment() {
    echo "=== Simulating DEPLOYMENT_FAILURE ==="
    echo "WARNING: This will crash the backend container to simulate a CrashLoopBackOff."
    curl -s -X GET "${BASE_URL}/rca/deployment" || echo "Backend container crashed."
    echo "Wait for Docker Compose to automatically restart the container..."
}

run_config() {
    echo "=== Simulating CONFIGURATION_ERROR ==="
    echo "WARNING: This will crash the backend container to simulate startup failure."
    curl -s -X GET "${BASE_URL}/rca/config" || echo "Backend container crashed."
    echo "Wait for Docker Compose to automatically restart the container..."
}

run_network() {
    echo "=== Simulating NETWORK_FAILURE ==="
    echo "Sending 50 requests to trigger Prometheus 5xx alert threshold..."
    for i in {1..50}; do
        curl -s -X GET "${BASE_URL}/rca/network" > /dev/null
    done
    echo "Endpoint triggered. Network timeouts logged."
}

run_dependency() {
    echo "=== Simulating DEPENDENCY_FAILURE ==="
    echo "Sending 50 requests to trigger Prometheus 5xx alert threshold..."
    for i in {1..50}; do
        curl -s -X GET "${BASE_URL}/rca/dependency" > /dev/null
    done
    echo "Endpoint triggered. Dependency failures logged."
}

run_traffic() {
    echo "=== Simulating TRAFFIC_SPIKE ==="
    echo "Sending concurrent requests to health endpoint to trigger Prometheus spike..."
    for i in {1..200}; do
        curl -s -o /dev/null "http://localhost:8880/actuator/health" &
    done
    wait
    echo "Traffic spike completed."
}

case $SCENARIO in
    database) run_database ;;
    deployment) run_deployment ;;
    config) run_config ;;
    network) run_network ;;
    dependency) run_dependency ;;
    traffic) run_traffic ;;
    all)
        run_database
        sleep 2
        run_network
        sleep 2
        run_dependency
        sleep 2
        run_traffic
        sleep 2
        run_deployment
        echo "Waiting 15 seconds for backend to restart..."
        sleep 15
        run_config
        ;;
    *)
        echo "Unknown scenario: $SCENARIO"
        exit 1
        ;;
esac

echo ""
echo "Simulation completed. Check the Root Cause Intelligence dashboard for the generated tickets."
