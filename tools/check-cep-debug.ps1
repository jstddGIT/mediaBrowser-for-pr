$ErrorActionPreference = 'Stop'
$key = 'HKCU:\Software\Adobe\CSXS.12'
$value = (Get-ItemProperty -Path $key -Name PlayerDebugMode -ErrorAction SilentlyContinue).PlayerDebugMode
if ([string]$value -eq '1') {
  Write-Output 'PlayerDebugMode=1'
  exit 0
}
Write-Output '未检测到 PlayerDebugMode=1。请手动在 HKCU\Software\Adobe\CSXS.12 设置后重启 Premiere。'
exit 1
