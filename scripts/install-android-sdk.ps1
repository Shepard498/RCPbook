$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoRoot = Split-Path $PSScriptRoot -Parent
$toolsRoot = Join-Path $repoRoot '.android-tools'
$sdkRoot = Join-Path $toolsRoot 'sdk'
$sdkManager = Join-Path $sdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'

if (-not (Test-Path -LiteralPath $sdkManager)) {
    New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
    $archive = Join-Path $toolsRoot 'commandlinetools.zip'
    Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' -OutFile $archive -UseBasicParsing
    $expectedHash = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'Android command-line tools checksum did not match.'
    }
    $unpacked = Join-Path $toolsRoot 'commandlinetools-unpacked'
    Expand-Archive -LiteralPath $archive -DestinationPath $unpacked -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $sdkRoot 'cmdline-tools\latest') | Out-Null
    Copy-Item -Path (Join-Path $unpacked 'cmdline-tools\*') -Destination (Join-Path $sdkRoot 'cmdline-tools\latest') -Recurse -Force
}

$env:ANDROID_USER_HOME = Join-Path $toolsRoot 'user-home'
# Installing the requested SDK packages accepts their standard Android SDK licenses.
1..100 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-36' 'build-tools;35.0.0' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation failed.' }
Write-Output "Android SDK ready: $sdkRoot"
