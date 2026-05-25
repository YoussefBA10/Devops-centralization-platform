#!/bin/bash

URL="http://localhost:8880/api/v1/test/oom"

echo -e "\e[31m--- Prometheus Alert Trigger: Container OOM Killed ---\e[0m"
echo "Target: $URL"
echo -e "\e[33mWARNING: This will CRASH the backend container by exhausting memory.\e[0m"
echo "Goal: Trigger 'container_oom_events_total' alert."

echo -e "\nInitializing memory pressure..."

# This request will hang and then the container will crash/restart
curl -m 30 "$URL" > /dev/null 2>&1

echo -e "\nContainer connection lost. This likely means the OOM Killer has terminated the process."
echo -e "\nWait 1 minute for Prometheus to detect the OOM event."
echo "Summary: Container OOM Killed should be FIRING soon."
