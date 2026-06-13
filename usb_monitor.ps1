Write-Host "scrcpy auto monitor started..." -ForegroundColor Green

$adbPath = "C:\scrcpy\adb.exe"
$batPath = "C:\scrcpy\run_scrcpy.bat"

while ($true) {
    try {
        if (-not (Test-Path $adbPath) -or -not (Test-Path $batPath)) {
            Write-Host "adb or bat not found." -ForegroundColor Red
            Start-Sleep -Seconds 3
            continue
        }

        # Gọi adb devices
        $adbResult = & $adbPath devices 2>$null
        Write-Host "adb devices output:" -ForegroundColor Yellow
        Write-Host $adbResult

        $lines = $adbResult -split "`r?`n"

        # Lấy các dòng kiểu: <serial>    device
        $deviceLines = $lines | Where-Object {
            $_ -match "device\s*$" -and
            -not $_.StartsWith("List of devices") -and
            $_ -notmatch "unauthorized"
        }

        if ($deviceLines.Count -gt 0) {
            Write-Host "ADB device detected." -ForegroundColor Cyan

            # Nếu chưa có scrcpy thì mới chạy
            $scrcpyProc = Get-Process "scrcpy" -ErrorAction SilentlyContinue
            if (-not $scrcpyProc) {
                Write-Host "Starting scrcpy..." -ForegroundColor Cyan
                Start-Process $batPath
            } else {
                Write-Host "scrcpy is already running." -ForegroundColor DarkYellow
            }
        }
        else {
            Write-Host "No ADB device connected." -ForegroundColor DarkGray
        }

    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
}
