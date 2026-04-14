# App Móvil — Soluciona Ya

## Requisitos previos
- Node.js instalado (ya lo tienes)
- Instalar Expo CLI: `npm install -g expo-cli`
- Instalar la app **Expo Go** en tu celular (App Store o Play Store)

## Cómo ejecutar

1. Abre una terminal en esta carpeta:
   ```
   cd app-movil
   npm install
   npm start
   ```

2. Aparecerá un código QR en la terminal.

3. En tu celular:
   - **Android**: abre la app Expo Go y escanea el código QR
   - **iPhone**: abre la cámara y escanea el código QR

4. La app se cargará en tu celular automáticamente.

## Importante: conectar al servidor

En `src/api.js`, línea 3, cambia la IP por la de tu computador:
```js
export const API_URL = 'http://192.168.0.2:3000'; // ← tu IP
```

Tu computador y celular deben estar en la **misma red WiFi**.

## Para publicar en App Store / Play Store

Necesitas una cuenta en:
- **Google Play Console**: $25 USD (pago único)
- **Apple Developer Program**: $99 USD/año

Luego ejecutas:
```
npm install -g eas-cli
eas login
eas build --platform all
```

Esto genera los archivos .apk (Android) y .ipa (iOS) para subir a las tiendas.
