$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\dist\assets'))
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$sizes = @(16,24,32,48,64,128,256)
$images = @()
foreach ($size in $sizes) {
    $bitmap = [Drawing.Bitmap]::new($size,$size)
    $g = [Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.ScaleTransform($size/256.0,$size/256.0)
    $shape = [Drawing.Drawing2D.GraphicsPath]::new()
    $shape.AddArc(6,6,62,62,180,90); $shape.AddArc(188,6,62,62,270,90)
    $shape.AddArc(188,188,62,62,0,90); $shape.AddArc(6,188,62,62,90,90); $shape.CloseFigure()
    $background = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#163e3b'))
    $g.FillPath($background,$shape)
    $white = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#e8f0dd'),13)
    $white.StartCap = [Drawing.Drawing2D.LineCap]::Round; $white.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $g.DrawRectangle($white,54,68,148,99)
    $g.DrawLine($white,128,169,128,193); $g.DrawLine($white,97,195,159,195)
    $lime = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#c6df69'),11)
    $lime.StartCap = [Drawing.Drawing2D.LineCap]::Round; $lime.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($lime,83,86,90,80,180,180)
    $g.DrawLine($lime,83,125,83,142); $g.DrawLine($lime,173,125,173,142)
    $g.DrawLine($lime,173,142,151,148)
    $status = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#c6df69'))
    $g.FillEllipse($background,187,181,53,53); $g.FillEllipse($status,195,189,37,37)
    $checkPen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#163e3b'),5)
    $checkPen.StartCap = [Drawing.Drawing2D.LineCap]::Round; $checkPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($checkPen,204,207,211,214); $g.DrawLine($checkPen,211,214,223,201)
    $stream = [IO.MemoryStream]::new(); $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
    $images += ,([byte[]]$stream.ToArray())
    if ($size -eq 256) { $bitmap.Save((Join-Path $assetDirectory 'corpdesk.png'),[Drawing.Imaging.ImageFormat]::Png) }
    $stream.Dispose(); $checkPen.Dispose(); $status.Dispose(); $lime.Dispose(); $white.Dispose(); $background.Dispose(); $shape.Dispose(); $g.Dispose(); $bitmap.Dispose()
}
$output = [IO.MemoryStream]::new(); $writer = [IO.BinaryWriter]::new($output)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Length)
$offset = 6 + 16 * $sizes.Length
for ($i=0;$i -lt $sizes.Length;$i++) {
    $dimension = if ($sizes[$i] -eq 256) {0} else {$sizes[$i]}
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
    $offset += $images[$i].Length
}
foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
[IO.File]::WriteAllBytes((Join-Path $assetDirectory 'corpdesk.ico'),$output.ToArray())
$writer.Dispose(); $output.Dispose()
Write-Output 'Created CORP Desk PNG and 7-size Windows ICO.'
