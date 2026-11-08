# update-icons.ps1 - Extract and apply mazz_music_icon_transparent.ico to MazzMuziK desktop
$ErrorActionPreference = "Stop"

$sourceIco = "D:\Mazz Laef\icones\mazz_music_icon_transparent.ico"
$tauriDir = "D:\Mazz MuZik\apps\mazzmuzik-desktop\src-tauri"
$iconsDir = Join-Path $tauriDir "icons"

Write-Host "Copying original ICO to icons/icon.ico..." -ForegroundColor Cyan
Copy-Item -Path $sourceIco -Destination (Join-Path $iconsDir "icon.ico") -Force

# Read ICO bytes to extract PNG frames
$bytes = [System.IO.File]::ReadAllBytes($sourceIco)
$count = [BitConverter]::ToUInt16($bytes, 4)
Write-Host "Found $count entries in ICO"

# Entry 5 is 256x256
$offset5 = [BitConverter]::ToUInt32($bytes, 6 + (5 * 16) + 12)
$size5 = [BitConverter]::ToUInt32($bytes, 6 + (5 * 16) + 8)

$png256Bytes = New-Object byte[] $size5
[Array]::Copy($bytes, $offset5, $png256Bytes, 0, $size5)

$pngPath = Join-Path $iconsDir "icon.png"
[System.IO.File]::WriteAllBytes($pngPath, $png256Bytes)
Write-Host "[OK] Extracted icon.png (256x256, $size5 bytes)" -ForegroundColor Green

# Also copy to 128x128 and 32x32 for Tauri bundle icons
Add-Type -AssemblyName System.Drawing

$srcBmp = [System.Drawing.Image]::FromFile($pngPath)

function Resize-Image($image, $width, $height, $targetPath) {
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $destImage = New-Object System.Drawing.Bitmap($width, $height)
    $destImage.SetResolution($image.HorizontalResolution, $image.VerticalResolution)
    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($image, $destRect, 0, 0, $image.Width, $image.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    $destImage.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destImage.Dispose()
    Write-Host "[OK] Saved $targetPath ($width x $height)" -ForegroundColor Green
}

Resize-Image $srcBmp 32 32 (Join-Path $iconsDir "32x32.png")
Resize-Image $srcBmp 128 128 (Join-Path $iconsDir "128x128.png")
Resize-Image $srcBmp 256 256 (Join-Path $iconsDir "128x128@2x.png")

# Also update web public/favicon
$publicDir = "D:\Mazz MuZik\apps\mazzmuzik-desktop\public"
if (Test-Path $publicDir) {
    Copy-Item -Path $sourceIco -Destination (Join-Path $publicDir "favicon.ico") -Force
    Copy-Item -Path (Join-Path $iconsDir "32x32.png") -Destination (Join-Path $publicDir "icon.png") -Force
}

$srcBmp.Dispose()
Write-Host "All icons synchronized with mazz_music_icon_transparent.ico!" -ForegroundColor Green
