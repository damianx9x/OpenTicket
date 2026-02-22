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
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $MojDir 'latest.yml'), (Join-Path $MojDir 'latest.yml.sha256')
Get-ChildItem -Path $MojDir -Filter 'OpenTicket-Setup-*.exe*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $MojDir -Filter 'OpenTicket-Portable-*.exe*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

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
$WinUpdateYml = Join-Path $ReleaseDir "latest.yml"

if (Test-Path $WinUpdateYml) {
  $PathLine = (Get-Content $WinUpdateYml | Where-Object { $_ -match '^path:\s+' } | Select-Object -First 1)
  if ($PathLine) {
    $SetupRel = ($PathLine -replace '^path:\s+', '').Trim().Trim('"')
    $SetupRelPath = Join-Path $ReleaseDir $SetupRel
    if (Test-Path $SetupRelPath) {
      $SetupSrc = $SetupRelPath
    }
    if (!(Test-Path $SetupRelPath) -and (Test-Path $SetupSrc)) {
      Copy-Item -Force $SetupSrc $SetupRelPath
      $SetupBlockmap = "$SetupSrc.blockmap"
      if (Test-Path $SetupBlockmap) {
        Copy-Item -Force $SetupBlockmap "$SetupRelPath.blockmap"
      }
      $SetupSrc = $SetupRelPath
    }
  }
}

if (!(Test-Path $PortableSrc)) {
  $PortableAlt = Get-ChildItem -Path $ReleaseDir -Filter 'OpenTicket-Portable-*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($PortableAlt) {
    $PortableSrc = $PortableAlt.FullName
  }
}

if (!(Test-Path $SetupSrc)) {
  throw "Brak pliku instalatora: $SetupSrc"
}

Copy-Item -Force $SetupSrc $ExeOut
if (Test-Path $PortableSrc) {
  Copy-Item -Force $PortableSrc $PortableOut
}

Log 'Kopiowanie artefaktów auto-update Windows (latest.yml + pliki wskazane)'
if (Test-Path $WinUpdateYml) {
  Copy-Item -Force $WinUpdateYml (Join-Path $MojDir 'latest.yml')
  $RelFiles = @()
  $RelFiles += (Get-Content $WinUpdateYml | Where-Object { $_ -match '^path:\s+' } | ForEach-Object { ($_ -replace '^path:\s+', '').Trim().Trim('"') })
  $RelFiles += (Get-Content $WinUpdateYml | Where-Object { $_ -match '^\s*-\s+url:\s+' } | ForEach-Object { ($_ -replace '^\s*-\s+url:\s+', '').Trim().Trim('"') })
  $RelFiles = $RelFiles | Where-Object { $_ -and $_.Length -gt 0 } | Select-Object -Unique
  foreach ($rel in $RelFiles) {
    $src = Join-Path $ReleaseDir $rel
    if (Test-Path $src) {
      Copy-Item -Force $src (Join-Path $MojDir $rel)
    }
    $srcBlock = "$src.blockmap"
    if (Test-Path $srcBlock) {
      Copy-Item -Force $srcBlock (Join-Path $MojDir "$rel.blockmap")
    }
  }
}

$setupHash = (Get-FileHash -Algorithm SHA256 $ExeOut).Hash.ToLower()
"$setupHash  OpenTicket-Installer.exe" | Set-Content -Encoding ascii (Join-Path $MojDir 'OpenTicket-Installer.exe.sha256')
if (Test-Path $PortableOut) {
  $portableHash = (Get-FileHash -Algorithm SHA256 $PortableOut).Hash.ToLower()
  "$portableHash  OpenTicket-Portable.exe" | Set-Content -Encoding ascii (Join-Path $MojDir 'OpenTicket-Portable.exe.sha256')
}
if (Test-Path (Join-Path $MojDir 'latest.yml')) {
  $latestHash = (Get-FileHash -Algorithm SHA256 (Join-Path $MojDir 'latest.yml')).Hash.ToLower()
  "$latestHash  latest.yml" | Set-Content -Encoding ascii (Join-Path $MojDir 'latest.yml.sha256')
}
Get-ChildItem -Path $MojDir -Filter 'OpenTicket-Setup-*.exe' -ErrorAction SilentlyContinue | ForEach-Object {
  $h = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLower()
  "$h  $($_.Name)" | Set-Content -Encoding ascii (Join-Path $MojDir "$($_.Name).sha256")
}
Get-ChildItem -Path $MojDir -Filter 'OpenTicket-Setup-*.exe.blockmap' -ErrorAction SilentlyContinue | ForEach-Object {
  $h = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLower()
  "$h  $($_.Name)" | Set-Content -Encoding ascii (Join-Path $MojDir "$($_.Name).sha256")
}

Log 'Gotowe artefakty Windows:'
Get-ChildItem $MojDir | Sort-Object Name | Format-Table Name, Length, LastWriteTime -AutoSize
