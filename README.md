# Yunta STT Worker (`yunta-stt-worker`)

Microservicio Serverless de Transcripción de Voz a Texto (**Speech-To-Text STT**) alimentado por **Cloudflare Workers AI (`@cf/openai/whisper`)** para el agente de código [Yunta](https://github.com/j0sp0nc3/yunta-harness).

---

## 🌟 Características

- **100% Compatible con OpenAI Audio API**: Expone `/v1/audio/transcriptions` (STT) y `/v1/audio/speech` (TTS).
- **Speech-To-Text (STT)**: Transcripción de voz alimentada por `@cf/openai/whisper`.
- **Text-To-Speech (TTS)**: Síntesis de voz en español alimentada por `@cf/meta/mms-tts-spa`.
- **Cero Mantenimiento & Costo $0**: Corre sobre el plan gratuito de Cloudflare Workers AI (hasta 10,000 ejecuciones diarias gratis).
- **Inmunidad a Ruido de Fondo**: Ejecución en la red Edge de Cloudflare.
- **Soporte CORS y Autenticación por Token Bearer** opcional.
- **CI/CD Automático**: Despliegue continuo en cada `git push main` vía GitHub Actions (`wrangler-action`).

---

## 🚀 Despliegue Rápido en Cloudflare

### Requisitos Previos

- [Node.js 18+](https://nodejs.org/)
- Cuenta en [Cloudflare](https://dash.cloudflare.com/)

### Despliegue Manual con Wrangler

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Desplegar a Cloudflare Workers
npm run deploy
```

---

## 🔗 Integración con Yunta Harness

Una vez desplegado el worker en `https://yunta-stt-worker.<tu-usuario>.workers.dev`, configúralo en Yunta mediante variables de entorno:

### En CMD (Windows):
```cmd
set VOICE_API_BASE=https://yunta-stt-worker.<tu-usuario>.workers.dev/v1
set VOICE_MODEL=@cf/openai/whisper
```

### En PowerShell:
```powershell
$env:VOICE_API_BASE="https://yunta-stt-worker.<tu-usuario>.workers.dev/v1"
$env:VOICE_MODEL="@cf/openai/whisper"
```

Luego ejecuta `yunta voice` o `/voice` en el REPL interactivo para dictado libre en español.

---

## ⚙️ Despliegue Automático mediante GitHub Actions

Configura las siguientes variables en **Settings -> Secrets and variables -> Actions** en tu repositorio de GitHub:

- `CLOUDFLARE_API_TOKEN`: Token API de Cloudflare con permisos de Workers.
- `CLOUDFLARE_ACCOUNT_ID`: Tu ID de cuenta de Cloudflare.

Cualquier commit o Pull Request fusionado a `main` desplegará automáticamente la nueva versión del servicio.

---

## 📄 Licencia

MIT © [j0sp0nc3](https://github.com/j0sp0nc3)
