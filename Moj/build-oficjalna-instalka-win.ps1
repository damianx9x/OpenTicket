$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$MojDir = Join-Path $RootDir 'Moj'
$ReleaseDir = Join-Path $RootDir 'desktop\release-win'
$ExeOut = Join-Path $MojDir 'OpenTicket-Installer.exe'
$PortableOut = Join-Path $MojDir 'OpenTicket-Portable.exe'

function Log([string]$msg) {
  Write-Host "[Moj/build-win] $msg"
}

New-Item -ItemType Directory -Force -Path $MojDir | Out-Null
if (Test-Path $ReleaseDir) { Remove-Item -Recurse -Force $ReleaseDir }
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

Remove-Item -Force -ErrorAction SilentlyContinue $ExeOut, $PortableOut, (Join-Path $MojDir 'OpenTicket-Installer.exe.sha256'), (Join-Path $MojDir 'OpenTicket-Portable.exe.sha256')

Set-Location $RootDir

Log 'Budowa backend'
npm --prefix backend run build

Log 'Budowa frontend'
npm --prefix frontend run build

Log 'Budowa desktop main'
npm --prefix desktop run build:electron

Log 'Budowa artefaktów Windows (.exe)'
Set-Location (Join-Path $RootDir 'desktop')
npx electron-builder --win --x64 --publish never --config.directories.output="$ReleaseDir"

Set-Location $RootDir
$Version = node -p "require('./desktop/package.json').version"
$SetupSrc = Join-Path $ReleaseDir "OpenTicket Setup $Version.exe"
$PortableSrc = Join-Path $ReleaseDir "OpenTicket $Version.exe"

if (!(Test-Path $SetupSrc)) {
  throw "Brak pliku instalatora: $SetupSrc"
}

Copy-Item -Force $SetupSrc $ExeOut
if (Test-Path $PortableSrc) {
  Copy-Item -Force $PortableSrc $PortableOut
}

$setupHash = (Get-FileHash -Algorithm SHA256 $ExeOut).Hash.ToLower()
"$setupHash  OpenTicket-Installer.exe" | Set-Content -Encoding ascii (Join-Path $MojDir 'OpenTicket-Installer.exe.sha256')
if (Test-Path $PortableOut) {
  $portableHash = (Get-FileHash -Algorithm SHA256 $PortableOut).Hash.ToLower()
  "$portableHash  OpenTicket-Portable.exe" | Set-Content -Encoding ascii (Join-Path $MojDir 'OpenTicket-Portable.exe.sha256')
}

Log 'Gotowe artefakty Windows:'
Get-ChildItem $MojDir | Sort-Object Name | Format-Table Name, Length, LastWriteTime -AutoSize
