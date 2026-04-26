# Warenwirtschaft: Umzug nach ~/dev/warenwirtschaft

Der Rest des Home-Verzeichnisses wurde am 2026-04-23 aufgeräumt.
Was noch fehlt: dieser Ordner selbst. Kann nicht passieren, solange Claude Code
in ihm läuft — Windows sperrt die Verzeichnis-Handles.

## Ablauf (einmalig)

1. **Claude-Session beenden**
   In dieser Session: `/exit` (oder Fenster schließen).

2. **Neue Shell öffnen** (Git Bash / Windows Terminal), *nicht* im
   warenwirtschaft-Ordner:
   ```bash
   cd ~
   ```

3. **Laufende Prozesse stoppen**, falls noch welche auf den Ordner zugreifen:
   - Next.js Dev-Server (`pnpm dev` / `npm run dev`) beenden (Strg+C)
   - VS Code / JetBrains schließen, falls geöffnet
   - Docker Desktop: falls lokale Container laufen → stoppen

4. **Ordner verschieben**:
   ```bash
   mv /c/Users/ekara/warenwirtschaft /c/Users/ekara/dev/warenwirtschaft
   ```

5. **Prüfen**:
   ```bash
   ls /c/Users/ekara/dev/
   # Erwartet: arbeitsbericht  awesome-claude-code  n8n-migration  warenwirtschaft
   ```

6. **Claude im neuen Pfad starten**:
   ```bash
   cd /c/Users/ekara/dev/warenwirtschaft
   claude
   ```

## Was passiert mit der Memory?

Die Auto-Memory liegt unter `~/.claude/projects/<encoded-path>/memory/` und ist
nicht an den Projektpfad gebunden — sie läuft weiter.

Der VPS-Deploy-Flow (`reference_warenwirtschaft_deploy.md`) referenziert nur
Remote-Pfade auf dem VPS (`/opt/apps/warenwirtschaft/`), keine lokalen
Windows-Pfade. **Keine Memory-Updates nötig.**

## Was sonst noch zu prüfen ist

- **Git remote**: unverändert (`https://github.com/ennurkara/Warenwirtschaft-.git`).
- **VS Code workspaces**: falls `.code-workspace` Datei existiert mit absolutem
  Pfad → einmal neu öffnen aus dem neuen Ort.
- **Shell-History / Aliase**: falls du `cd ~/warenwirtschaft` als Alias hattest,
  anpassen.
- **Docker-Volumes**: keine — die App läuft containerisiert auf dem VPS, nicht
  lokal.
