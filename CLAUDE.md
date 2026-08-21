# RBW Reports — CLAUDE.md

Herramienta interna de reportería de performance (Meta Ads, Google Ads, GA4) para Rainbow®. Genera informes en PDF y automatiza su envío mensual por email con comentario redactado por IA.

**Fuente de verdad del dominio:** [`rainbow-rbw-reports-brief-documento-maestro-original-base.md`](rainbow-rbw-reports-brief-documento-maestro-original-base.md), en esta misma carpeta. Este CLAUDE.md NO repite ese contenido — lo complementa con decisiones técnicas y reglas operativas. Ante cualquier duda de modelo de datos, mapeo de métricas, lógica de sync, ventanas de atribución, etc., el brief manda. Si en algún momento se contradicen, el brief gana salvo que el usuario diga lo contrario.

---

## Regla de trabajo más importante

Este proyecto se construye **un hito a la vez** (ver sección 12 del brief). Cada sesión de Claude Code trabaja sobre un solo hito:

1. Setup base (repo, Next.js, Postgres/Drizzle, Auth.js, deploy en Coolify)
2. Panel admin CRUD (con datos cargados a mano)
3. Integración Meta Ads + sync diario
4. Google Ads + GA4
5. Constructor de informes (bloques, plantillas, preview web)
6. Export PDF (Gotenberg)
7. Automatización mensual + IA + Brevo

**No te adelantes a hitos siguientes** aunque parezca natural o eficiente hacerlo. Cada hito debe terminar en algo verificable en el navegador sin leer código — si no podés mostrar eso funcionando, el hito no está terminado. Si no está claro en qué hito estamos, preguntá antes de asumir.

---

## Stack técnico confirmado

Ver sección 1 del brief para la lista completa (Next.js 15 App Router + TS, Postgres, Drizzle, Auth.js Credentials, pg-boss, Gotenberg, Brevo, Claude Haiku, Coolify/VPS Contabo, next-intl). Decisiones adicionales resueltas para este documento:

| Tema | Decisión |
|---|---|
| Gestor de paquetes | **pnpm** |
| UI / estilos | **shadcn/ui + Tailwind CSS** |
| Storage (logos de clientes, PDFs generados) | **Volumen local en el VPS** (mismo host dockerizado vía Coolify, sin servicios externos por ahora) |
| Testing automatizado | **Ninguno en v1**, como marca la sección 11 del brief — prioridad es velocidad para un proyecto interno de un solo usuario. Si algo es genuinamente crítico y frágil (ej. cálculo de métricas derivadas), se puede proponer un test puntual, pero no es la norma |
| Cifrado de `org_credentials.encrypted_payload` | AES-256-GCM con el módulo `crypto` nativo de Node, clave desde variable de entorno gestionada por Coolify (nunca en el repo) |
| Nombre del producto | **RBW Reports** |

---

## Repositorio y despliegue

- El código vive en esta misma carpeta (`RBW Reports`), que es la raíz del repo git.
- Repo alojado en **GitHub, privado**.
- Coolify está conectado al repo y **redeploya automáticamente con cada push a `main`**.

⚠️ **Importante:** en este proyecto, a diferencia de un repo cualquiera, `git push` a `main` dispara un deploy real a `reports.rbwsuite.com`. Una vez que exista el pipeline de automatización mensual (hito 7), un deploy accidentalmente roto en el momento equivocado podría afectar el envío de informes reales a clientes reales. Tratar cada push a `main` con la misma cautela que un deploy manual: confirmar con el usuario antes de pushear cambios significativos, no solo antes de acciones destructivas.

---

## Entorno de desarrollo local

- **Docker Desktop no está instalado todavía** en esta máquina (Windows) — es parte del setup del Hito 1, junto con `pnpm` (`corepack enable` alcanza, ya viene con Node).
- Desarrollo local vía `docker-compose` replicando Postgres + Gotenberg (y lo que pg-boss necesite) — así cada hito se prueba sin tocar el VPS real.
- Node instalado: v24.x. Git instalado y funcional.

---

## Variables de entorno (borrador, completar en Hito 1)

```
DATABASE_URL=
AUTH_SECRET=
ENCRYPTION_KEY=              # para org_credentials.encrypted_payload
CLAUDE_API_KEY=
BREVO_API_KEY=
GOTENBERG_URL=
META_APP_ID=
META_APP_SECRET=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GA4_CLIENT_ID=
GA4_CLIENT_SECRET=
```

Nunca commitear valores reales — van como variables de entorno en Coolify. `.env.local` para desarrollo, en `.gitignore` desde el primer commit.

---

## Convenciones de código

- TypeScript estricto (`strict: true`).
- Estructura por feature dentro de `app/` (App Router), no por tipo de archivo genérico.
- Todo el dominio de métricas pasa por los `metric_key` canónicos (`spend, impressions, clicks, conversions, sessions, users, revenue`) — nunca exponer nombres de campo nativos de las APIs de Meta/Google/GA4 fuera de la capa de sync (sección 2 del brief).
- Sin comentarios explicativos de "qué hace" el código — solo cuando haya una razón no obvia (ej. por qué el cron corre el día 3 y no el día 1).
