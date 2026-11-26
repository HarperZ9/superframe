param(
  [string]$Version = $(if ($env:SUPERFRAME_VERSION) { $env:SUPERFRAME_VERSION } else { "latest" }),
  [string]$InstallDir = $(if ($env:SUPERFRAME_INSTALL_DIR) { $env:SUPERFRAME_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Superframe" }),
  [string]$FromDir = $(if ($env:SUPERFRAME_FROM_DIR) { $env:SUPERFRAME_FROM_DIR } else { "" }),
  [switch]$WithRawDx12,
  [switch]$NoPath,
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
$Repo = "HarperZ9/superframe"

function Get-Sha256Hex([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Parse-Sums([string]$SumsPath) {
  $map = @{}
  foreach ($line in (Get-Content -Path $SumsPath -Encoding UTF8)) {
    if ($line -match '^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$') {
      $map[$Matches[2].Trim()] = $Matches[1].ToLowerInvariant()
    }
  }
  return $map
}

function Assert-Checksum([string]$FilePath, [string]$AssetName, [hashtable]$Sums) {
  if (-not $Sums.ContainsKey($AssetName)) {
    throw "Refusing install: $AssetName is missing from SHA256SUMS."
  }
  $actual = Get-Sha256Hex $FilePath
  $expected = $Sums[$AssetName]
  if ($actual -ne $expected) {
    throw "Refusing install: SHA-256 mismatch for $AssetName (expected $expected, got $actual)."
  }
}

function Add-UserPath([string]$BinDir) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($current) { $parts = $current.Split(";") | Where-Object { $_ -ne "" } }
  if ($parts -notcontains $BinDir) {
    $next = ($parts + $BinDir) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $next, "User")
  }
  if (($env:Path.Split(";")) -notcontains $BinDir) {
    $env:Path = "$BinDir;$env:Path"
  }
}

function Resolve-ReleaseInfo([string]$RequestedVersion) {
  $api = if ($RequestedVersion -eq "latest") {
    "https://api.github.com/repos/$Repo/releases/latest"
  } else {
    $tag = if ($RequestedVersion.StartsWith("v")) { $RequestedVersion } else { "v$RequestedVersion" }
    "https://api.github.com/repos/$Repo/releases/tags/$tag"
  }
  $headers = @{ "User-Agent" = "superframe-installer"; "Accept" = "application/vnd.github+json" }
  return Invoke-RestMethod -Uri $api -Headers $headers
}

function Install-FromStage([string]$StageDir, [string]$TargetDir, [bool]$SkipPath, [bool]$ShowRawGuide) {
  $sumsFile = Join-Path $StageDir "SHA256SUMS"
  if (-not (Test-Path $sumsFile)) { throw "Refusing install: SHA256SUMS not found in $StageDir." }
  $sums = Parse-Sums $sumsFile

  $archive = Get-ChildItem -Path $StageDir -File | Where-Object {
    $_.Name -match '^superframe-playground-windows-.+\.zip$' -or $_.Name -match '^superframe-playground-.+\.zip$'
  } | Select-Object -First 1
  if (-not $archive) { throw "Refusing install: no Superframe Playground zip archive found." }
  Assert-Checksum $archive.FullName $archive.Name $sums

  $bundleDir = Join-Path $TargetDir "bundle"
  $binDir = Join-Path $TargetDir "bin"
  New-Item -ItemType Directory -Force -Path $bundleDir, $binDir | Out-Null
  Get-ChildItem -Path $bundleDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  Expand-Archive -Path $archive.FullName -DestinationPath $bundleDir -Force

  $cli = Get-ChildItem -Path $bundleDir -Recurse -Filter "superframe.mjs" | Select-Object -First 1
  if ($cli) {
    $shim = "@echo off`r`nnode `"$($cli.FullName)`" %*`r`n"
    Set-Content -Path (Join-Path $binDir "superframe.cmd") -Value $shim -Encoding ASCII
  }

  $nativeCli = Get-ChildItem -Path $bundleDir -Recurse -Filter "raw_native_cli.exe" | Select-Object -First 1
  if ($nativeCli) {
    Copy-Item -Path $nativeCli.FullName -Destination (Join-Path $binDir "raw_native_cli.exe") -Force
  }

  Copy-Item -Path $sumsFile -Destination (Join-Path $TargetDir "SHA256SUMS") -Force
  if (-not $SkipPath) { Add-UserPath $binDir }

  Write-Output "Superframe Playground verified (SHA256SUMS OK) and installed to: $TargetDir"
  Write-Output "CLI bin directory: $binDir"
  if ($ShowRawGuide) {
    Write-Output "Optional RAW DX12 game runtime binaries (Skyrim SE / Fallout 4 / Starfield): download the signed release zip + SHA256SUMS from https://github.com/$Repo/releases or Nexus Mods and verify with Get-FileHash -Algorithm SHA256 before copying into the game root."
  }
}

function Invoke-SelfTest {
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("superframe-install-selftest-" + [Guid]::NewGuid().ToString("N"))
  try {
    $stage = Join-Path $tmp "stage"
    $payload = Join-Path $tmp "payload"
    $destOk = Join-Path $tmp "dest-ok"
    $destBad = Join-Path $tmp "dest-bad"
    New-Item -ItemType Directory -Force -Path $stage, (Join-Path $payload "superframe\cli"), (Join-Path $payload "native\bin") | Out-Null

    Set-Content -Path (Join-Path $payload "superframe\cli\superframe.mjs") -Value 'console.log("superframe selftest ok");' -Encoding UTF8
    Set-Content -Path (Join-Path $payload "native\bin\raw_native_cli.exe") -Value "stub-binary-payload" -Encoding ASCII
    $zipPath = Join-Path $stage "superframe-playground-windows-x64.zip"
    Compress-Archive -Path (Join-Path $payload "*") -DestinationPath $zipPath -Force

    $sumsText = "$(Get-Sha256Hex $zipPath)  superframe-playground-windows-x64.zip`n"
    Set-Content -Path (Join-Path $stage "SHA256SUMS") -Value $sumsText -NoNewline -Encoding UTF8

    Install-FromStage $stage $destOk $true $true
    if (-not (Test-Path (Join-Path $destOk "bin\superframe.cmd"))) { throw "Self-test failed: superframe.cmd missing." }
    if (-not (Test-Path (Join-Path $destOk "bin\raw_native_cli.exe"))) { throw "Self-test failed: raw_native_cli.exe missing." }

    # Planted 1-byte tamper control: installer must refuse before extracting.
    $bytes = [System.IO.File]::ReadAllBytes($zipPath)
    $bytes[$bytes.Length - 1] = $bytes[$bytes.Length - 1] -bxor 0x01
    [System.IO.File]::WriteAllBytes($zipPath, $bytes)

    $refused = $false
    try { Install-FromStage $stage $destBad $true $false } catch { if ($_.Exception.Message -match "SHA-256 mismatch") { $refused = $true } else { throw } }
    if (-not $refused) { throw "Self-test failed: tampered archive was not refused." }
    if (Test-Path (Join-Path $destBad "bin\superframe.cmd")) { throw "Self-test failed: tampered archive was extracted." }
    Write-Output "SELFTEST PASS: valid install verified and planted 1-byte tamper refused."
  } finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($SelfTest) {
  Invoke-SelfTest
  exit 0
}

if ($FromDir) {
  Install-FromStage (Resolve-Path $FromDir).Path $InstallDir ([bool]$NoPath) ([bool]$WithRawDx12)
  exit 0
}

$rel = Resolve-ReleaseInfo $Version
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("superframe-install-" + [Guid]::NewGuid().ToString("N"))
try {
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $assets = @($rel.assets)
  $sumsAsset = $assets | Where-Object { $_.name -eq "SHA256SUMS" } | Select-Object -First 1
  if (-not $sumsAsset) { throw "Refusing install: release $($rel.tag_name) has no SHA256SUMS asset." }
  $pkgAsset = $assets | Where-Object { $_.name -match '^superframe-playground-windows-.+\.zip$' } | Select-Object -First 1
  if (-not $pkgAsset) { throw "Refusing install: release $($rel.tag_name) has no Windows Playground archive." }
  foreach ($a in @($sumsAsset, $pkgAsset)) {
    Invoke-WebRequest -Uri $a.browser_download_url -OutFile (Join-Path $tmp $a.name)
  }
  Install-FromStage $tmp $InstallDir ([bool]$NoPath) ([bool]$WithRawDx12)
} finally {
  Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
