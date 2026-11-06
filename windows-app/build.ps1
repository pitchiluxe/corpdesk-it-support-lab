param([ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version='1.0.6')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $projectRoot
try {
    $env:DOTNET_CLI_HOME = Join-Path $projectRoot '.build\dotnet-home'
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
    $env:DOTNET_GENERATE_ASPNET_CERTIFICATE = 'false'
    & (Join-Path $PSScriptRoot 'build-icon.ps1')
    dotnet restore (Join-Path $PSScriptRoot 'CorpDesk.csproj') --packages (Join-Path $projectRoot '.build\nuget')
    if ($LASTEXITCODE -ne 0) {throw 'Dependency restore failed.'}
    dotnet publish (Join-Path $PSScriptRoot 'CorpDesk.csproj') -c Release -o (Join-Path $PSScriptRoot 'publish') --no-restore "-p:Version=$Version"
    if ($LASTEXITCODE -ne 0) {throw 'Windows app build failed.'}
    $compiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
    if (-not (Test-Path -LiteralPath $compiler)) {throw 'Install Inno Setup 6, then rerun this build.'}
    & $compiler "/DAppVersion=$Version" (Join-Path $PSScriptRoot 'setup.iss')
    if ($LASTEXITCODE -ne 0) {throw 'Installer build failed.'}
    $installer = Get-Item -LiteralPath (Join-Path $projectRoot 'dist\downloads\CORP-Desk-Setup.exe')
    $hash = Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256
    @{version=$Version;platform='windows-x64';sizeMB=[math]::Round($installer.Length/1MB,1);sha256=$hash.Hash.ToLowerInvariant();file=$installer.Name;signed=$false} |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'dist\downloads\release.json')
    ($hash.Hash.ToLowerInvariant()+'  '+$installer.Name) | Set-Content -LiteralPath (Join-Path $projectRoot 'dist\downloads\SHA256SUMS.txt')
    node package.cjs
} finally {Pop-Location}
