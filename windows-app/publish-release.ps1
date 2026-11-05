param([Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repo='pitchiluxe/corpdesk-it-support-lab'
Push-Location $root
try {
    gh auth status
    if($LASTEXITCODE -ne 0){throw 'Sign in first using gh auth login -h github.com.'}
    $manifest=Get-Content -Raw -LiteralPath 'dist\downloads\release.json' | ConvertFrom-Json
    if($manifest.version -ne $Version){throw 'Build version and release version must match.'}
    $actual=(Get-FileHash -LiteralPath 'dist\downloads\CORP-Desk-Setup.exe' -Algorithm SHA256).Hash
    if($actual -ne $manifest.sha256){throw 'Installer checksum does not match release.json. Rebuild before publishing.'}
    gh release create "v$Version" 'dist/downloads/CORP-Desk-Setup.exe' 'dist/downloads/release.json' 'dist/downloads/SHA256SUMS.txt' --draft --repo $repo --title "CORP Desk $Version" --notes "Windows x64 IT support practice lab. Created by Erick Omari. Unsigned preview installer. Installed apps check this release for updates."
    if($LASTEXITCODE -ne 0){throw 'GitHub release upload failed.'}
    gh release edit "v$Version" --draft=false --latest --repo $repo
    if($LASTEXITCODE -ne 0){throw 'Release publication failed; uploaded assets remain in the draft.'}
    Write-Host "Published https://github.com/$repo/releases/tag/v$Version"
} finally {Pop-Location}
