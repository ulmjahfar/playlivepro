Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "All PlayLive services stopped."
Read-Host "Press Enter to exit"
