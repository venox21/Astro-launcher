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
1. Version in `resources/config.json` erhöhen (z. B. `"version": "v1.0.1"`).
2. `powershell -ExecutionPolicy Bypass -File installer\build.ps1` ausführen.
3. Unter **Releases → Draft a new release** ein neues Release (Tag z. B. `v1.0.1`) anlegen und die gebaute `ASTRO Launcher Setup.exe` als Asset anhängen.
