---
name: fomo-dev
description: Launch the full FOMO dev environment for Expo Go in one step — detect the current LAN IP, update the Expo wrapper config, start the Vite web server and the Expo (Metro) server, then generate and open a QR code to scan with Expo Go. Use whenever the user wants to run / start / launch the app on their phone, get the QR, or asks to "open Expo Go" / "show the barcode".
---

# FOMO — one-step dev launcher for Expo Go

This project is a **Vite + React web app** wrapped in a thin **Expo WebView** so it runs in
**Expo Go**. There are two pieces that must both run:

- **Web app (Vite)** — project root: `c:\Users\LENOVO\OneDrive - China Israel Ltd\שולחן העבודה\FOMO-app-main`, port **5173**.
- **Expo wrapper (Metro)** — `C:\Users\LENOVO\fomo-expo` (kept OUTSIDE the project because the project
  path contains Hebrew characters, which break Metro), port **8081**, **SDK 54** (what the user's Expo Go supports).

The wrapper loads the Vite URL over the LAN, so the phone must be on the **same WiFi** as the PC,
and `config.js` must point at the PC's **current** LAN IP (it changes between networks).

## Steps to perform when invoked

1. **Get the current LAN IPv4** (varies by network):
   ```powershell
   (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }).IPAddress -join ', '
   ```
   Pick the Wi-Fi address. Call it `<IP>`.

2. **Update the wrapper config** — set `APP_URL` in `C:\Users\LENOVO\fomo-expo\config.js` to
   `http://<IP>:5173` (only if it differs from the current value).

3. **Free stale ports** so the servers can bind (TaskStop any prior background tasks first, then):
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue | Where-Object { (Get-NetTCPConnection -OwningProcess $_.Id -LocalPort 5173 -ErrorAction SilentlyContinue) -or (Get-NetTCPConnection -OwningProcess $_.Id -LocalPort 8081 -ErrorAction SilentlyContinue) } | ForEach-Object { Stop-Process -Id $_.Id -Force }
   ```

4. **Start Vite** (web app) in the background from the project root:
   ```
   npm run dev
   ```
   (run_in_background: true)

5. **Start Expo** in a VISIBLE CMD window from the wrapper folder (so the user gets a live QR + the
   `r`/`a` shortcuts), with the cache cleared on first run of the session:
   ```powershell
   Start-Process cmd -ArgumentList '/k','title FOMO-EXPO && cd /d C:\Users\LENOVO\fomo-expo && npx expo start --port 8081'
   ```

6. **Wait for both servers to be ready** (use an until-loop in a background Bash task, don't sleep-chain):
   ```bash
   until curl -s -o /dev/null --max-time 3 "http://localhost:8081/status"; do sleep 2; done; echo "expo ready"
   curl -s -o /dev/null -w "Vite: %{http_code}\n" --max-time 5 "http://localhost:5173/"
   ```

7. **Generate and open the QR** for `exp://<IP>:8081`:
   ```bash
   cd "C:\Users\LENOVO\fomo-expo" && (node -e "require('qrcode')" 2>/dev/null || npm install qrcode --no-save) && node -e "require('qrcode').toFile('C:/Users/LENOVO/fomo-expo/expo-qr.png','exp://<IP>:8081',{width:600,margin:2},e=>console.log(e?('ERR '+e):'QR saved'))"
   ```
   ```powershell
   Start-Process "C:\Users\LENOVO\fomo-expo\expo-qr.png"
   ```

8. **Tell the user** the QR is open and the URL is `exp://<IP>:8081`:
   - iPhone: scan with the regular Camera app → tap the banner.
   - Android: Expo Go → "Scan QR code".
   - Approve the location permission prompt when it appears.

## Notes / gotchas
- The `.env` (Supabase + Mapbox keys) lives in the project root and is gitignored — required for the
  web app to render (without it the app is a black screen). Do not commit or push it.
- If Expo says **"Project is incompatible / requires newer Expo Go"**, the SDK no longer matches the
  installed Expo Go. Re-pin the wrapper SDK (clean install in `C:\Users\LENOVO\fomo-expo`) to the
  version the user's Expo Go supports, then `npx expo start --clear`.
- If the WebView shows a black screen, it's almost always the missing `.env` or a wrong IP in `config.js`.
- Location uses a native bridge in the wrapper's `App.js` (expo-location → injected `nativeLocation`),
  because `navigator.geolocation` does not work in the iOS WebView.
