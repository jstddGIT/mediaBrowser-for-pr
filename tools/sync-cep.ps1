[CmdletBinding()]
param(
  [string]$Source = (Split-Path -Parent $PSScriptRoot),
  [string]$Destination = (Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.mediaBrowser.pr')
)
$ErrorActionPreference = 'Stop'
$runtime = @('CSXS', 'index.html', 'css', 'js', 'jsx', 'icons', '.debug')

if (-not (Test-Path -LiteralPath $Destination)) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}
foreach ($entry in $runtime) {
  $from = Join-Path $Source $entry
  if (Test-Path -LiteralPath $from) {
    Copy-Item -LiteralPath $from -Destination $Destination -Recurse -Force
  }
}
Write-Output "已准备同步运行文件到：$Destination"
Write-Output '此脚本仅在用户明确同意后手动运行；不会修改注册表或安装 git 钩子。'
