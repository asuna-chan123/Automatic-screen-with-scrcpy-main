Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ""C:\scrcpy\usb_monitor.ps1""", 0, False
