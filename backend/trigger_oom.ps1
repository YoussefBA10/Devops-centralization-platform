$serviceUrl = "http://localhost:8880/api/v1/test/oom"

Write-Host "--- Prometheus Alert Trigger: Container OOM Killed ---" -ForegroundColor Red
Write-Host "Target: $serviceUrl"
Write-Host "WARNING: This will CRASH the backend container by exhausting memory." -ForegroundColor Yellow
Write-Host "Goal: Trigger 'container_oom_events_total' alert."

Write-Host "`nInitializing memory pressure..." -ForegroundColor Gray

try {
    # This request will hang and then the container will crash/restart
    $resp = Invoke-WebRequest -Uri $serviceUrl -Method Get -TimeoutSec 30 -ErrorAction SilentlyContinue
} catch {
    Write-Host "`nContainer connection lost. This likely means the OOM Killer has terminated the process." -ForegroundColor Green
}

Write-Host "`nWait 1 minute for Prometheus to detect the OOM event." -ForegroundColor Cyan
Write-Host "Summary: Container OOM Killed should be FIRING soon."
