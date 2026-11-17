# ASTRO Launcher

Single-File Installer, Uninstaller, UI-Patches und GitHub Auto-Updater für den **ASTRO FiveM Launcher**.

## Features
- **Single-File 1-Klick Express-Installer (`ASTRO Launcher Setup.exe`)**:
  - Komprimiert alle Launcher-Dateien in eine einzige `.exe` (`.NET Framework 4.8` / WPF, keine Zusatz-DLLs nötig).
  - Installiert automatisch nach `%LocalAppData%\Programs\ASTRO Launcher`, erstellt Desktop- & Startmenü-Verknüpfungen und registriert einen eigenen Uninstaller unter Windows *Apps & Features*.
- **GitHub Auto-Updater (`venox21/Astro-launcher`)**:
  - Prüft bei jedem Start automatisch das neueste GitHub Release (`releases/latest`) sowie manuell über den Button **„Update suchen“** in der Topbar und in den Einstellungen.
  - Zeigt eine klare Meldung an, wenn kein neueres Update verfügbar ist, und lädt bei neuen Releases die Setup-`.exe` automatisch herunter und installiert sie.
- **Randloser Fenster-Fix**:
  - Entfernt den äußeren Margin-Rand (`.window` mit `inset: 0`) für ein sauberes `1260×820` Fenster.

## Build-Anleitung (lokal)
Lege die Dateien neben den entpackten Electron-Launcher-Ordner (`ASTRO Launcher.exe`, `resources/`, `locales/`) und starte:

```powershell
powershell -ExecutionPolicy Bypass -File installer\build.ps1
```

Dadurch wird eine fertige Single-File `ASTRO Launcher Setup.exe` erstellt.

## Neues Update auf GitHub veröffentlichen
Die Version startet bei `v1.0` und zählt bei jedem Update um 1 hoch (`v1.0` → `v1.1` → `v1.2` …):

1. Build mit automatischem Versions-Sprung starten:
   ```powershell
   powershell -ExecutionPolicy Bypass -File installer\build.ps1 -Bump
   ```
   *(Erhöht `installer/version.txt` und `resources/config.json` automatisch z. B. von `1.0` auf `1.1` und baut die neue `ASTRO Launcher Setup.exe`.)*
2. Unter **Releases → Draft a new release** ein neues Release mit passendem Tag (z. B. `v1.1`) anlegen und die gebaute `ASTRO Launcher Setup.exe` als Asset anhängen.
