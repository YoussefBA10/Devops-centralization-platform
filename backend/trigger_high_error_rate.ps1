$serviceUrl = "http://localhost:8880/api/v1/test/error?code=500"
$durationMinutes = 3
$requestsPerSecond = 5

Write-Host "--- Prometheus Alert Trigger: HighErrorRate ---" -ForegroundColor Cyan
Write-Host "Target: $serviceUrl"
Write-Host "Duration: $durationMinutes minutes"
Write-Host "Goal: >5% 5xx Error Rate for 2 minutes" -ForegroundColor Yellow

$startTime = Get-Date
$endTime = $startTime.AddMinutes($durationMinutes)

$total = 0
$errors = 0

while ((Get-Date) -lt $endTime) {
    Write-Host -NoNewline "Fire burst: "
    for ($i = 0; $i -lt $requestsPerSecond; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $serviceUrl -Method Get -ErrorAction SilentlyContinue -TimeoutSec 2
            $code = [int]$resp.StatusCode
            if ($code -ge 500) { 
                Write-Host "X" -NoNewline -ForegroundColor Red 
                $errors++
            } else { 
                Write-Host "." -NoNewline -ForegroundColor Green 
            }
        } catch {
            Write-Host "X" -NoNewline -ForegroundColor Red
            $errors++
        }
        $total++
    }
    
    $elapsed = [Math]::Round(((Get-Date) - $startTime).TotalSeconds)
    Write-Host " | Total: $total | Errors: $errors | Elapsed: $($elapsed)s"
    
    Start-Sleep -Seconds 1
}

Write-Host "`n--- Simulation complete. Alert should be FIRING in Prometheus. ---" -ForegroundColor Cyan
