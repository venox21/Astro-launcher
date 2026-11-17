[CmdletBinding()]
param(
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$InstallerRoot = $PSScriptRoot
$LauncherRoot = Split-Path -Parent $InstallerRoot
$BuildDir = Join-Path $InstallerRoot 'build'
$PayloadZip = Join-Path $BuildDir 'payload.zip'

if (-not $OutputPath) {
    $OutputPath = Join-Path $LauncherRoot 'ASTRO Launcher Setup.exe'
}

if (-not (Test-Path (Join-Path $LauncherRoot 'ASTRO Launcher.exe'))) {
    throw "ASTRO Launcher.exe wurde nicht in '$LauncherRoot' gefunden."
}

# Read version from resources\config.json (fallback to 1.0.0)
$version = '1.0.0'
$configPath = Join-Path $LauncherRoot 'resources\config.json'
if (Test-Path $configPath) {
    try {
        $cfg = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($cfg.version) {
            $raw = ([string]$cfg.version).Trim()
            if ($raw.StartsWith('v', [System.StringComparison]::OrdinalIgnoreCase)) {
                $raw = $raw.Substring(1)
            }
            if ($raw -match '^\d+\.\d+\.\d+$') {
                $version = $raw
            }
        }
    }
    catch {
        Write-Warning "Konnte Version nicht aus config.json lesen, verwende $version."
    }
}

Write-Host "[1/4] Baue ASTRO Uninstaller (v$version) ..." -ForegroundColor Cyan
$uninstallerProj = Join-Path $InstallerRoot 'src\AstroUninstaller\AstroUninstaller.csproj'
& dotnet build $uninstallerProj -c Release "-p:AstroVersion=$version" -v minimal
if ($LASTEXITCODE -ne 0) {
    throw "Build von AstroUninstaller fehlgeschlagen."
}

$uninstallerExe = Join-Path $InstallerRoot 'src\AstroUninstaller\bin\Release\net48\Uninstall ASTRO Launcher.exe'
if (-not (Test-Path $uninstallerExe)) {
    throw "Kompilierter Uninstaller nicht gefunden: $uninstallerExe"
}

Write-Host "[2/4] Bereite gepatchtes app.asar und payload.zip vor ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
if (Test-Path $PayloadZip) {
    Remove-Item -Path $PayloadZip -Force
}

$sourceAsar = Join-Path $LauncherRoot 'resources\app.asar'
$patchedAsar = Join-Path $BuildDir 'app.asar'
$patchScript = Join-Path $InstallerRoot 'patch-asar.py'
$patchDir = Join-Path $InstallerRoot 'launcher-patch'
if ((Test-Path $patchScript) -and (Test-Path $patchDir) -and (Get-Command python -ErrorAction SilentlyContinue)) {
    & python $patchScript $sourceAsar $patchedAsar $patchDir
    if ($LASTEXITCODE -ne 0) {
        throw "Patchen von app.asar fehlgeschlagen."
    }
}
else {
    Copy-Item -Path $sourceAsar -Destination $patchedAsar -Force
}

$stagedConfig = Join-Path $BuildDir 'config.json'
if (Test-Path $configPath) {
    $cfgObj = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $cfgObj.update) {
        $cfgObj | Add-Member -NotePropertyName update -NotePropertyValue ([pscustomobject]@{})
    }
    if (-not $cfgObj.update.owner -or $cfgObj.update.owner -in @('omgnocap-commits', 'DEIN-GITHUB-NAME')) {
        $cfgObj.update.owner = 'venox21'
        $cfgObj.update.repo = 'Astro-launcher'
    }
    $cfgObj.update.enabled = $true
    $cfgObj.update.checkOnStartup = $true
    $cfgObj.update.provider = 'github'
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($stagedConfig, ($cfgObj | ConvertTo-Json -Depth 10), $utf8NoBom)
}

$stagedAppUpdate = Join-Path $BuildDir 'app-update.yml'
$sourceAppUpdate = Join-Path $LauncherRoot 'resources\app-update.yml'
if (Test-Path $sourceAppUpdate) {
    $yml = Get-Content -Path $sourceAppUpdate -Raw -Encoding UTF8
    $yml = $yml -replace '(?m)^owner:.*$', 'owner: venox21'
    $yml = $yml -replace '(?m)^repo:.*$', 'repo: Astro-launcher'
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($stagedAppUpdate, $yml, $utf8NoBom)
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$excludedTopLevel = @(
    'installer',
    'ASTRO Launcher Setup.exe',
    'Uninstall ASTRO Launcher.exe',
    '.git',
    '.github',
    '.gitignore',
    '.vscode',
    'README.md'
)

$excludedExtensions = @('.pdb', '.tmp', '.log', '.zip')
$rootPrefixLen = $LauncherRoot.TrimEnd('\', '/').Length + 1
$fileCount = 0

$zipStream = [System.IO.File]::Open($PayloadZip, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
    $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        $allFiles = Get-ChildItem -Path $LauncherRoot -Recurse -File -Force
        foreach ($file in $allFiles) {
            $relPath = $file.FullName.Substring($rootPrefixLen)
            $topSegment = ($relPath -split '[\\/]')[0]

            if ($excludedTopLevel -contains $topSegment) {
                continue
            }
            if ($excludedExtensions -contains $file.Extension.ToLowerInvariant()) {
                continue
            }

            $entryName = $relPath -replace '\\', '/'
            $sourceFile = switch ($entryName) {
                'resources/app.asar' { $patchedAsar }
                'resources/config.json' { if (Test-Path $stagedConfig) { $stagedConfig } else { $file.FullName } }
                'resources/app-update.yml' { if (Test-Path $stagedAppUpdate) { $stagedAppUpdate } else { $file.FullName } }
                default { $file.FullName }
            }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $sourceFile,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
            $fileCount++
        }

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $uninstallerExe,
            'Uninstall ASTRO Launcher.exe',
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
        $fileCount++
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $zipStream.Dispose()
}

$zipSizeMb = [Math]::Round((Get-Item $PayloadZip).Length / 1MB, 2)
Write-Host "      $fileCount Dateien komprimiert -> $zipSizeMb MB" -ForegroundColor Gray

Write-Host "[3/4] Baue Single-File ASTRO Launcher Setup.exe ..." -ForegroundColor Cyan
$installerProj = Join-Path $InstallerRoot 'src\AstroInstaller\AstroInstaller.csproj'
& dotnet build $installerProj -c Release "-p:AstroVersion=$version" "-p:PayloadZipPath=$PayloadZip" -v minimal
if ($LASTEXITCODE -ne 0) {
    throw "Build von AstroInstaller fehlgeschlagen."
}

$builtSetupExe = Join-Path $InstallerRoot 'src\AstroInstaller\bin\Release\net48\ASTRO Launcher Setup.exe'
if (-not (Test-Path $builtSetupExe)) {
    throw "Gebauter Installer nicht gefunden: $builtSetupExe"
}

Write-Host "[4/4] Kopiere fertigen Installer nach '$OutputPath' ..." -ForegroundColor Cyan
Copy-Item -Path $builtSetupExe -Destination $OutputPath -Force

$finalItem = Get-Item $OutputPath
$finalSizeMb = [Math]::Round($finalItem.Length / 1MB, 2)
$hash = (Get-FileHash -Path $OutputPath -Algorithm SHA256).Hash

Write-Host ""
Write-Host "Build erfolgreich abgeschlossen!" -ForegroundColor Green
Write-Host "  Datei:   $($finalItem.FullName)"
Write-Host "  Groesse: $finalSizeMb MB"
Write-Host "  SHA-256: $hash"
