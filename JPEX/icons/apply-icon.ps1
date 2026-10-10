param (
    [string]$SourceImage = "",
    [string]$OutputDir = "D:\ExtensionJP\JPEX\icons"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$sizes = @(16, 32, 48, 128)

if ([string]::IsNullOrWhiteSpace($SourceImage) -or -not (Test-Path $SourceImage)) {
    # Generate clean Japanese Dictionary icon placeholder with kanji 辞
    foreach ($sz in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap $sz, $sz
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

        # Background rounded rect or circle
        $brushBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(2, 132, 199))
        $g.FillEllipse($brushBg, 1, 1, ($sz - 2), ($sz - 2))

        # Text Kanji
        $fontSize = [Math]::Max(7, [int]($sz * 0.52))
        $font = New-Object System.Drawing.Font("MS Gothic", $fontSize, [System.Drawing.FontStyle]::Bold)
        $brushText = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

        $rect = New-Object System.Drawing.RectangleF 0, 0, $sz, $sz
        $g.DrawString("辞", $font, $brushText, $rect, $sf)

        $outPath = Join-Path $OutputDir "icon$sz.png"
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $bmp.Dispose()
        Write-Host "Created $outPath"
    }
} else {
    # Resize from user-provided source image
    $srcBmp = [System.Drawing.Bitmap]::FromFile($SourceImage)
    foreach ($sz in $sizes) {
        $destBmp = New-Object System.Drawing.Bitmap $sz, $sz
        $g = [System.Drawing.Graphics]::FromImage($destBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        $g.DrawImage($srcBmp, 0, 0, $sz, $sz)

        $outPath = Join-Path $OutputDir "icon$sz.png"
        $destBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $destBmp.Dispose()
        Write-Host "Resized and saved $outPath"
    }
    $srcBmp.Dispose()
}
