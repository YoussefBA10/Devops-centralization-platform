$url = "http://localhost:8880/api/v1/test/error"
$totalRequests = 50
$errorRate = 0.2 # 20% error rate

Write-Host "Starting error simulation to trigger 'HighErrorRate' alert..." -ForegroundColor Cyan
Write-Host "Target: $url"
Write-Host "Total requests per iteration: $totalRequests"
Write-Host "Target error rate: $($errorRate * 100)%"

for ($i = 1; $i -le 10; $i++) {
    Write-Host "`nIteration $i of 10..." -ForegroundColor Yellow
    for ($j = 1; $j -le $totalRequests; $j++) {
        $statusCode = 200
        if ([System.Random]::new().NextDouble() -lt $errorRate) {
            $statusCode = 500
        }

        try {
            Invoke-RestMethod -Uri "$url?code=$statusCode" -Method Get -ErrorAction SilentlyContinue | Out-Null
            if ($statusCode -eq 500) {
                Write-Host "X" -NoNewline -ForegroundColor Red
            } else {
                Write-Host "." -NoNewline -ForegroundColor Green
            }
        } catch {
            Write-Host "!" -NoNewline -ForegroundColor Gray
        }
    }
    Write-Host "`nWaiting 5 seconds before next burst..."
    Start-Sleep -Seconds 5
}

Write-Host "`nSimulation complete. The alert should trigger in Prometheus within 2 minutes." -ForegroundColor Cyan
