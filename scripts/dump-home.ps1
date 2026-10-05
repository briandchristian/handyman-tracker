$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
  $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}
$out = Join-Path $PSScriptRoot "home-dump.html"
$err = Join-Path $PSScriptRoot "home-dump.err"
& $edge --headless=new --disable-gpu --ignore-certificate-errors --virtual-time-budget=12000 --dump-dom "https://127.0.0.1:5173/" 1> $out 2> $err
Write-Output "EDGE_EXIT:$LASTEXITCODE"
Write-Output "OUT_BYTES:$((Get-Item $out).Length)"
