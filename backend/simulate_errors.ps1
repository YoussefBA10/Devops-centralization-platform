$baseUrl = "http://localhost:8880/api/v1/test"
$endpoints = @("error", "db-error", "io-error", "timeout")
$errorRate = 0.25 # For generic error endpoint

Write-Host "Starting multi-endpoint error burst..." -ForegroundColor Cyan

for ($i = 1; $i -le 10; $i++) {
    Write-Host "`nIteration $i of 10..." -ForegroundColor Yellow
    foreach ($endpoint in $endpoints) {
        Write-Host "Bursting /$endpoint: " -NoNewline
        for ($j = 1; $j -le 10; $j++) {
            $url = "$baseUrl/$endpoint"
            if ($endpoint -eq "error") {
                $status = 200
                if ([System.Random]::new().NextDouble() -lt $errorRate) { $status = 500 }
                $url = "$url?code=$status"
            }

            try {
                $resp = Invoke-WebRequest -Uri $url -Method Get -ErrorAction SilentlyContinue
                $code = [int]$resp.StatusCode
                if ($code -ge 500) { Write-Host "X" -NoNewline -ForegroundColor Red }
                else { Write-Host "." -NoNewline -ForegroundColor Green }
            } catch {
                if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -ge 500) {
                    Write-Host "X" -NoNewline -ForegroundColor Red
                } else {
                    Write-Host "!" -NoNewline -ForegroundColor Gray
                }
            }
        }
        Write-Host ""
    }
    Start-Sleep -Seconds 5
}

Write-Host "`nSimulation complete." -ForegroundColor Cyan
