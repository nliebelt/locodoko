# GitHub Actions — Deployment-Secrets einrichten

Für die CD-Pipeline (`.github/workflows/cd.yml`) müssen drei Secrets in den GitHub-Repository-Einstellungen angelegt werden:

**GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

---

## SSH_PRIVATE_KEY

Der private Ed25519-SSH-Schlüssel, mit dem der GitHub Actions Runner auf den Produktionsserver zugreift.

Der öffentliche Teil (`*.pub`) muss in `/root/.ssh/authorized_keys` auf `prod1.locodoko.de` eingetragen sein.

**Schlüssel erzeugen (einmalig, falls noch nicht vorhanden):**
```sh
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/locodoko_deploy
# Öffentlichen Schlüssel auf dem Server eintragen:
ssh-copy-id -i ~/.ssh/locodoko_deploy.pub root@prod1.locodoko.de
```

**Secret-Wert:** Inhalt von `~/.ssh/locodoko_deploy` (der private Schlüssel, beginnt mit `-----BEGIN OPENSSH PRIVATE KEY-----`).

---

## SSH_KNOWN_HOSTS

Der Host-Fingerprint von `prod1.locodoko.de`, damit der Runner den Server verifizieren kann (verhindert MITM-Angriffe).

**Wert ermitteln:**
```sh
ssh-keyscan prod1.locodoko.de
```

**Secret-Wert:** Die komplette Ausgabe des obigen Befehls (mehrere Zeilen mit `prod1.locodoko.de ssh-...`).

---

## DEPLOY_HOST

Die SSH-Zieladresse in der Form `nutzer@host`.

**Secret-Wert:** `root@prod1.locodoko.de`

---

## Deploy auslösen

Nach dem Anlegen der Secrets den Deploy-Workflow manuell starten:

**GitHub → Repository → Actions → CD → Run workflow → Run workflow**

Der Workflow baut das JAR, kopiert es auf den Server und startet den `locodoko`-Systemd-Service neu.
Laufzeit: ca. 2–3 Minuten. Kurze Downtime (~5 s) während `systemctl restart` läuft.
