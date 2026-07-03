# توليد أيقونات PWA: خلفية خضراء مائلة للزرقة + نص «خُطى» أبيض
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Make-Icon([int]$size, [string]$path, [double]$textScale) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'

    # خلفية متدرجة
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 15, 118, 110),
        [System.Drawing.Color]::FromArgb(255, 6, 78, 74),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    $g.FillRectangle($brush, $rect)

    # مسار خطوات: ثلاث نقاط صاعدة
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
    $r1 = $size * 0.055
    $g.FillEllipse($dotBrush, [float]($size * 0.20), [float]($size * 0.72), [float]$r1, [float]$r1)
    $g.FillEllipse($dotBrush, [float]($size * 0.32), [float]($size * 0.60), [float]$r1, [float]$r1)
    $g.FillEllipse($dotBrush, [float]($size * 0.44), [float]($size * 0.48), [float]$r1, [float]$r1)

    # النص
    $font = New-Object System.Drawing.Font('Segoe UI', [float]($size * $textScale), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $white = [System.Drawing.Brushes]::White
    $g.DrawString('خُطى', $font, $white, (New-Object System.Drawing.RectangleF(0, [float](-$size * 0.03), $size, $size)), $fmt)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "Saved $path"
}

Make-Icon 512 (Join-Path $out 'icon-512.png') 0.30
Make-Icon 192 (Join-Path $out 'icon-192.png') 0.30
# maskable: نص أصغر ليبقى داخل المنطقة الآمنة (٨٠٪)
Make-Icon 512 (Join-Path $out 'icon-maskable-512.png') 0.24
