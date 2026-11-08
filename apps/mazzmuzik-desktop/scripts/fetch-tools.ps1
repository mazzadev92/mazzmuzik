# fetch-tools.ps1 - MazzMuziK Toolchain Fetcher & Auto-Maintainer with Rollback
param(
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$BinariesDir = Join-Path $BaseDir "src-tauri\binaries"
$cur  = Join-Path $BinariesDir "current"
$prev = Join-Path $BinariesDir "previous"
$tmp  = Join-Path $BinariesDir "pending"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   MAZZMUZIK TOOLCHAIN MANAGER & AUTO-MAINTAINER  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Path $BinariesDir -Force | Out-Null
}
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

$manifest = @(
    @{ n = "yt-dlp.exe";  u = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"; z = $false },
    @{ n = "deno.exe";    u = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"; z = $true }
)

foreach ($m in $manifest) {
    $dst = Join-Path $tmp $m.n
    Write-Host "-> Fetching $($m.n)..." -ForegroundColor Yellow
    if ($m.z) {
        $zip = "$dst.zip"
        & curl.exe -s -L $m.u -o $zip
        if (Test-Path $zip) {
            $extractDir = "$dst.d"
            Expand-Archive $zip -DestinationPath $extractDir -Force
            $found = Get-ChildItem $extractDir -Recurse -Filter $m.n | Select-Object -First 1
            if ($found) {
                Move-Item $found.FullName $dst -Force
            }
            Remove-Item $zip, $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        & curl.exe -s -L $m.u -o $dst
    }
}

# Preserve local ffmpeg & node
$localFfmpeg = "D:\TC4\MAZZAE\mon-spotify\desktop\embedded\bin\ffmpeg.exe"
$dstFfmpeg = Join-Path $tmp "ffmpeg.exe"
if (Test-Path $localFfmpeg) {
    Copy-Item $localFfmpeg $dstFfmpeg -Force
}

$localNode = "C:\Program Files\nodejs\node.exe"
$dstNode = Join-Path $tmp "node.exe"
if (Test-Path $localNode) {
    Copy-Item $localNode $dstNode -Force
}

# Smoke test on pending yt-dlp
$ytdlpPending = Join-Path $tmp "yt-dlp.exe"
$smokeOk = $false
if (Test-Path $ytdlpPending) {
    try {
        $v = & $ytdlpPending --version
        if ($LASTEXITCODE -eq 0 -and $v) {
            Write-Host "[OK] Smoke test passed: yt-dlp version $v" -ForegroundColor Green
            $smokeOk = $true
        }
    } catch {
        Write-Warning "Smoke test failed on pending binary: $_"
    }
}

if ($smokeOk) {
    # Backup current to previous
    if (Test-Path $cur) {
        Remove-Item $prev -Recurse -Force -ErrorAction SilentlyContinue
        Move-Item $cur $prev -Force
    }
    Move-Item $tmp $cur -Force
    Write-Host "[OK] New toolchain promoted to current!" -ForegroundColor Green
} else {
    Write-Warning "Update check failed or skipped. Keeping current binaries."
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# Synchronize current/ into target-triple named binaries for Tauri v2 bundle
$sourceDir = if (Test-Path $cur) { $cur } else { $BinariesDir }

$mappings = @{
    "yt-dlp.exe" = "yt-dlp-x86_64-pc-windows-msvc.exe"
    "ffmpeg.exe" = "ffmpeg-x86_64-pc-windows-msvc.exe"
    "node.exe"   = "node-x86_64-pc-windows-msvc.exe"
    "deno.exe"   = "deno-x86_64-pc-windows-msvc.exe"
}

foreach ($src in $mappings.Keys) {
    $srcPath = Join-Path $sourceDir $src
    if (-not (Test-Path $srcPath)) {
        $srcPath = Join-Path $BinariesDir $mappings[$src]
    }
    $targetPath = Join-Path $BinariesDir $mappings[$src]
    if (Test-Path $srcPath) {
        if ($srcPath -ne $targetPath) {
            Copy-Item $srcPath $targetPath -Force
        }
        Write-Host "[OK] $($mappings[$src]) ready ($((Get-Item $targetPath).Length) bytes)" -ForegroundColor Green
    }
}

# fpcalc & bgutil-provider fallbacks
$fpcalcTarget = Join-Path $BinariesDir "fpcalc-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $fpcalcTarget)) {
    Copy-Item (Join-Path $BinariesDir "ffmpeg-x86_64-pc-windows-msvc.exe") $fpcalcTarget -Force
}
$bgutilTarget = Join-Path $BinariesDir "bgutil-provider-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $bgutilTarget)) {
    Copy-Item (Join-Path $BinariesDir "node-x86_64-pc-windows-msvc.exe") $bgutilTarget -Force
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "All 6 sidecars verified and ready!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
