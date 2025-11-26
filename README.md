# 🚗 Raspberry Pi Garage Opener v3.0

Moderne PWA zur Steuerung **mehrerer Garagentore** über Smartphone - optimiert für iOS und Android.

**Neu in v3.0:** Unterstützung für mehrere Tore in einer App! Keine separaten Instanzen mehr nötig.

## ✨ Features

### 🚪 Multi-Door Support
- ✅ **Mehrere Tore in einer App** - Keine separaten Instanzen mehr
- ✅ Konfigurierbare Tore per JSON
- ✅ Individuelle GPIO-Pins pro Tor
- ✅ Grid-Layout für übersichtliche Darstellung

### 🔒 Sicherheit
- ✅ JWT-Token basierte Authentifizierung
- ✅ Rate-Limiting (Schutz vor Brute-Force)
- ✅ Helmet.js Security Headers (CSP, HSTS)
- ✅ Constant-time String Vergleich (Timing-Attack-Schutz)
- ✅ HTTPS mit SSL/TLS

### 📱 Mobile Experience
- ✅ PWA - Installierbar als native App
- ✅ Haptic Feedback (Vibration bei Bedienung)
- ✅ Dark Mode (automatisch nach System)
- ✅ Offline-Unterstützung mit Service Worker
- ✅ Optimiert für Touch-Bedienung
- ✅ Pure Vanilla JavaScript - Keine Dependencies im Frontend

### 🚀 Technisch
- ✅ **Keine Template Engine** - Reines HTML/CSS/JS SPA
- ✅ REST API Architecture
- ✅ Modern Express.js v5
- ✅ Node.js 18+ kompatibel
- ✅ GPIO-Steuerung via onoff
- ✅ Graceful Shutdown mit Cleanup
- ✅ JSON-basierte Konfiguration

## 📋 Voraussetzungen

- Raspberry Pi (getestet auf RPi 3/4/5)
- Raspbian/Raspberry Pi OS
- Node.js 18+ (empfohlen: Node.js 20 LTS)
- SSL-Zertifikat (Let's Encrypt empfohlen)

## 🛠️ Installation

### 1. Repository klonen
```bash
git clone https://github.com/kaiherzig/RPI_garage-opener.git
cd RPI_garage-opener
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. SSL-Zertifikat einrichten
```bash
sudo apt-get install certbot
sudo certbot certonly --standalone -d ihre-domain.de
```

### 4. Konfiguration anpassen
Bearbeite `config.json`:

```json
{
  "apiKey": "IhrSichererAPIKey123!",
  "port": 8000,
  "ssl": {
    "keyPath": "/etc/letsencrypt/live/domain/privkey.pem",
    "certPath": "/etc/letsencrypt/live/domain/fullchain.pem"
  },
  "doors": [
    {
      "id": "door1",
      "name": "Garagentor 1",
      "gpio": 26,
      "physicalPin": 538,
      "activationTime": 500
    },
    {
      "id": "door2",
      "name": "Garagentor 2",
      "gpio": 20,
      "physicalPin": 532,
      "activationTime": 500
    }
  ],
  "rateLimiting": {
    "windowMs": 900000,
    "maxRequests": 100,
    "maxActionsPerMinute": 10
  }
}
```

**Parameter erklärt:**
- `apiKey`: Ihr geheimer Zugriffsschlüssel (mindestens 20 Zeichen)
- `port`: HTTPS Port (Standard: 8000)
- `ssl`: Pfade zu SSL-Zertifikaten
- `doors`: Array mit allen Toren
  - `id`: Eindeutige ID (z.B. "door1", "door2")
  - `name`: Anzeigename in der App
  - `gpio`: GPIO Pin-Nummer (BCM)
  - `physicalPin`: Physischer Pin am Board (zur Dokumentation)
  - `activationTime`: Dauer des Signals in ms (Standard: 500)

### 5. Starten
```bash
npm start
```

Die App läuft nun auf `https://ihre-domain:8000/IhrAPIKey`

## 🚀 Autostart einrichten

Erstelle Service für systemd:

```bash
sudo nano /etc/systemd/system/garage.service
```

Inhalt:
```ini
[Unit]
Description=Garage Opener Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/RPI_garage-opener
ExecStart=/usr/bin/node /home/pi/RPI_garage-opener/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Aktivieren:
```bash
sudo systemctl enable garage.service
sudo systemctl start garage.service
sudo systemctl status garage.service
```

## 📱 iPhone Shortcut einrichten

1. **App öffnen:** Öffne `https://ihre-domain:8000/IhrAPIKey` im Safari
2. **Zur Home-Screen hinzufügen:** Teilen-Button → "Zum Home-Bildschirm"
3. **Als App nutzen:** Icon auf Home-Screen tippen

Alternative - Shortcuts App:
1. Shortcuts App öffnen
2. Neuer Shortcut → "URL öffnen"
3. URL: `https://ihre-domain:8000/IhrAPIKey`
4. Zum Home-Screen hinzufügen

## 🔧 Erweiterte Konfiguration

### Weiteres Tor hinzufügen
Füge in `config.json` im `doors` Array ein neues Tor hinzu:

```json
{
  "id": "door3",
  "name": "Garagentor 3",
  "gpio": 21,
  "physicalPin": 540,
  "activationTime": 500
}
```

Nach Neustart erscheint das Tor automatisch in der App!

### Tor entfernen
Entferne einfach das entsprechende Objekt aus dem `doors` Array.

### Rate-Limiting anpassen
In `config.json`:
```json
"rateLimiting": {
  "windowMs": 900000,           // 15 Minuten in ms
  "maxRequests": 100,           // Max Requests pro Window
  "maxActionsPerMinute": 10     // Max Tor-Aktionen pro Minute
}
```

### Port ändern
In `config.json`:
```json
"port": 8443
```

### Aktivierungszeit anpassen
Falls Ihr Garagentor-Relais länger/kürzer aktiviert werden muss:
```json
"activationTime": 1000  // 1 Sekunde statt 500ms
```

## 🧪 Testen

```bash
# Health Check (zeigt alle Tore und deren Status)
curl -k https://ihre-domain:8000/health

# Konfiguration abrufen
curl -k https://ihre-domain:8000/api/IhrAPIKey/config

# Spezifisches Tor öffnen (mit JWT)
# Zuerst Token holen, dann:
curl -k -X POST https://ihre-domain:8000/api/action/door1 \
  -H "Content-Type: application/json" \
  -d '{"token":"JWT_TOKEN_HIER"}'

# Legacy: Erstes Tor öffnen (für alte Shortcuts)
curl -k https://ihre-domain:8000/action/IhrAPIKey
```

## 🔒 Sicherheitshinweise

1. **API-Key sicher wählen** - Mindestens 20 Zeichen, Sonderzeichen
2. **Firewall einrichten** - Nur Port 8000 von außen erreichbar
3. **SSL-Zertifikat aktuell halten** - Certbot Auto-Renewal
4. **Logs überwachen** - `journalctl -u garage.service -f`
5. **System aktuell halten** - Regelmäßige Updates

## 📊 Features im Detail

### PWA Installation
- Beim ersten Besuch erscheint "Als App installieren"
- Funktioniert wie native App
- Eigenes Icon auf Home-Screen
- Kein Browser-UI

### Haptic Feedback
- Kurzes Vibrieren beim Drücken
- Doppeltes Vibrieren bei Erfolg
- Langes Vibrieren bei Fehler

### Dark Mode
- Automatisch je nach System-Einstellung
- Keine manuelle Umschaltung nötig

### Offline-Support
- Service Worker cached statische Assets
- Zeigt Offline-Hinweis bei fehlender Verbindung
- Cache wird automatisch aktualisiert

## 🐛 Troubleshooting

**GPIO Fehler:**
```bash
# Prüfe GPIO Zugriff
ls -l /sys/class/gpio
# User zur gpio Gruppe hinzufügen
sudo usermod -a -G gpio pi
```

**SSL-Fehler:**
```bash
# Prüfe Zertifikat
sudo certbot certificates
# Erneuere Zertifikat
sudo certbot renew
```

**Port bereits in Verwendung:**
```bash
# Prüfe welcher Prozess Port 8000 nutzt
sudo lsof -i :8000
# Beende Prozess
sudo kill -9 <PID>
```

## 🔄 Migration

### Von v2.0 auf v3.0

**Wichtig:** v3.0 verwendet JSON-Konfiguration statt Hardcoded-Werten!

1. **Backup erstellen:**
```bash
cp server.js server.js.backup
```

2. **Code aktualisieren:**
```bash
git pull origin main
```

3. **Dependencies aktualisieren:**
```bash
npm install
```

4. **config.json erstellen** und alte Werte übertragen:
   - API-Key aus altem server.js
   - SSL-Pfade
   - GPIO-Pin
   
5. **Zweites Tor hinzufügen** (falls vorhanden):
   ```json
   {
     "id": "door2",
     "name": "Garagentor 2", 
     "gpio": 20,
     "physicalPin": 532,
     "activationTime": 500
   }
   ```

6. **Service neu starten:**
```bash
sudo systemctl restart garage.service
```

7. **Alte v1.0/v2.0 Shortcuts funktionieren weiterhin!**

### Von v1.0 auf v3.0

Gleiche Schritte wie oben. Alte Shortcuts bleiben kompatibel.

## 📝 Changelog

### Version 3.0.0 (November 2025)
- 🚪 **Multi-Door Support** - Mehrere Tore in einer App!
- ❌ **EJS entfernt** - Pure SPA ohne Template Engine
- 🏗️ **REST API Architecture** - Saubere API-Struktur
- 📝 **JSON Config** - Einfache Konfiguration in config.json
- 🎨 **Grid Layout** - Übersichtliche Darstellung mehrerer Tore
- ⚡ **Optimiert** - Weniger Dependencies, schneller

### Version 2.0.0 (November 2025)
- ✨ PWA-Support mit Service Worker
- 🔒 JWT-basierte Authentifizierung
- 🛡️ Rate-Limiting & Helmet Security
- 📱 Haptic Feedback
- 🌙 Dark Mode Support
- ⚡ Kein jQuery mehr - Native JS
- 🎨 Modernes UI mit CSS Variables
- 📦 Dependencies aktualisiert

### Version 1.0.0
- Initiale Version mit Express + EJS
- Bootstrap 4 + jQuery
- Basis GPIO-Steuerung

## 📄 Lizenz

ISC

## 👨‍💻 Autor

Kai Herzig

---

**Hinweis:** Icons in `public/` sind SVG-Placeholders. Für Produktivbetrieb echte PNG-Icons erstellen:
```bash
# z.B. mit ImageMagick
convert -size 192x192 xc:none -draw "fill green circle 96,96 96,0" icon-192.png
convert -size 512x512 xc:none -draw "fill green circle 256,256 256,0" icon-512.png
```