# RBW Reports

## Qué es / objetivo

Herramienta interna de reportería de performance para Rainbow® (agencia de marketing, Uruguay). Reemplaza un software de terceros (~25 USD/mes). Integra Meta Ads, Google Ads y GA4, genera informes en PDF y automatiza su envío mensual con un comentario redactado por IA. Diseñada multi-tenant desde el modelo de datos para eventualmente venderse a otras agencias (referencia: dashgoo.com), aunque hoy solo la usa Rainbow con 2 clientes (Bauten, Eleka).

Fuente de verdad del dominio: `rainbow-rbw-reports-brief-documento-maestro-original-base.md` (mismo repo) + `CLAUDE.md`.

## Stack y decisiones técnicas

- Next.js 15 App Router + TypeScript, Postgres + Drizzle ORM, Auth.js v5 (Credentials), pg-boss (jobs), Gotenberg (PDF, aún no implementado), Brevo (email, aún no implementado), Claude Haiku (comentario IA, aún no implementado), Coolify sobre VPS Contabo, pnpm, shadcn/ui (sobre Base UI, no Radix — usa `render={<Componente/>}` en vez de `asChild`).
- **Sin Redis, sin colas externas.** pg-boss corre dentro del mismo proceso de Next.js vía `instrumentation.ts` — no hay worker service separado. Esto funcionó bien para el volumen actual (2 clientes).
- **Auth.js**: `auth.config.ts` (edge-safe, sin DB/bcrypt, usado por middleware) + `auth.ts` (config completa, Node-only). Requiere `trustHost: true` y `AUTH_URL` en producción por estar detrás del proxy de Coolify.
- **Rate limiting de login**: backed por Postgres (tabla `login_rate_limits`), no en memoria — un `Map` en memoria NO se comparte entre Route Handlers y Server Actions porque Next.js los bundlea como chunks separados. Lección aplicada: cualquier estado compartido entre requests tiene que vivir en Postgres o en el hook de `instrumentation.ts` (proceso único), nunca en una variable de módulo suelta.
- **Credenciales de plataformas** (`org_credentials.encrypted_payload`): AES-256-GCM con `crypto` nativo de Node, clave en `ENCRYPTION_KEY` (env var, nunca en el repo). Una fila por organización y plataforma.
- **Meta**: System User de Business Manager con token de larga duración (permiso `ads_read` únicamente), generado a mano una vez y pegado en el panel — decisión deliberada de NO construir un flujo OAuth completo porque es la cuenta propia de Rainbow, no de terceros. Evita además el App Review de Meta por ahora.
- **Google Ads**: OAuth2 (Client ID/Secret + Developer Token + Refresh Token), refresh token generado una sola vez con un script local (`scripts/get-google-ads-refresh-token.mjs`, flujo loopback, corre en la máquina del usuario — nunca pasa credenciales por el chat/agente). Mismo criterio que Meta: sin pantalla de login de Google en la app.
- **GA4**: Service Account (email + private key) — sin OAuth. Se comparte la propiedad de GA4 de cada cliente con el email del service account (rol Viewer). Truco: la private key pegada desde el JSON crudo trae `\n` literales en vez de saltos de línea reales — `saveGa4Credential` los normaliza (`.replace(/\\n/g, "\n")`) antes de cifrar.
- **google-ads-api (librería npm)**: tiene un bug real en su manejo de errores (`getGoogleAdsError()` hace `error.metadata.internalRepr.get(...)` sin optional chaining, y crashea enmascarando el error real de Google en cualquier falla de auth). Un `pnpm patch` al paquete NO sobrevive el build de producción (el cache de webpack de Next indexa el módulo por versión, y un patch no cambia la versión). Fix real: monkeypatch en runtime desde `lib/google-ads/client.ts` (`ensureGoogleAdsErrorHandlerPatched`), que sí se recompila siempre porque es código propio.
- **Multi-tenant, pero no self-serve todavía**: `org_credentials` ya está scoped por organización (listo para multi-tenant), pero conseguir el token de cada plataforma es manual (a mano, una vez). El día que se venda a otra agencia, lo que hay que construir es una pantalla real de OAuth ("Conectar con Google/Meta") — no hace falta tocar el modelo de datos ni el motor de sync.
- **Deploy**: git push a `main` = deploy real a `reports.rbwsuite.com` vía Coolify (Nixpacks). Tratar cada push con cautela — confirmar con el usuario antes de pushear cambios significativos.

## Estado actual

**Hecho:**
- Hito 1 — Setup base, login funcionando en producción.
- Hito 2 — Panel admin CRUD (clientes, cuentas conectadas).
- Hito 3 — Meta Ads: sync manual + backfill automático al conectar cuenta + cron diario (06:00 UTC). **Confirmado corriendo solo en producción**, sin intervención manual.
- Hito 4 (parcial) — GA4: sync manual y automático funcionando con datos reales (confirmado con la cuenta de Bauten). Google Ads: código completo, probado end-to-end contra la API real (con credenciales dummy hasta llegar al punto exacto de fallo esperado), pero **bloqueado por Google**: la solicitud de acceso "Basic" a la Google Ads API está en revisión (hasta 5 días hábiles desde el 27/8/2026). El developer token está en nivel "Acceso de explorador" (test accounts), que no permite leer cuentas reales — por eso el sync a Bauten falla con "User doesn't have permission to access customer" hasta que se apruebe.

**A medias / roto:**
- Nada roto en lo que ya está deployado. Lo único pendiente de validar es que el cron de GA4 y Google Ads corran solos sin intervención (mismo tipo de verificación que ya se hizo con Meta) — no se hizo aún.

## Pendientes / roadmap

1. Confirmar aprobación de Basic Access de Google Ads → probar sync real con Bauten (`177-128-7972`) → cerrar Hito 4.
2. **Hito 5 — Constructor de informes**: bloques (KPI, tabla, gráfico, texto, imagen) definidos en `report_templates.blocks`, resueltos contra `daily_metric_values` al generar un informe y congelados en `reports.blocks_snapshot`. Ya se armó un mockup visual de referencia (artifact "Bauten Informe Mensual") con la estructura acordada: 4 KPIs con comparación vs. mes anterior, gráfico de inversión/conversiones diario, tabla por plataforma, comentario de análisis.
3. **Hito 6 — Export PDF**: Gotenberg como contenedor Docker separado en Coolify, recibe el mismo HTML del preview web (nunca generación de PDF embebida en el proceso Next.js).
4. **Hito 7 — Automatización mensual**: cron el día 3 de cada mes (no el 1 — por ventanas de atribución de Meta de hasta 7 días), re-sync forzado de los últimos 5 días antes de generar, comentario IA vía Claude Haiku, ventana de revisión de 48hs antes del envío automático por Brevo.
5. Brevo todavía no está integrado — el email de alerta por 3 fallos consecutivos de sync (mencionado en el brief sección 3.2) se dejó explícitamente para el Hito 7, cuando Brevo ya esté configurado.

## Contexto de negocio/producto relevante

- Objetivo de negocio: hoy reemplaza una herramienta de terceros de ~25 USD/mes para 2 clientes; el modelo de datos está pensado desde el día 1 para eventualmente venderse a otras agencias (multi-tenant), aunque no es la prioridad actual.
- Rainbow reporta siempre en USD a sus clientes aunque las cuentas publicitarias puedan estar en otra moneda nativa — la conversión se hace al momento de renderizar el informe (no al guardar), no implementado todavía (parte del Hito 5).
- El comentario de IA del informe mensual pasa por una ventana de revisión humana de 48hs antes de salir — Fran puede editarlo, y si no lo toca se envía solo. Esto es una decisión de producto explícita, no un detalle técnico: la IA no manda nada sin ventana de revisión.
- Meta App Review para `ads_read` en producción es una dependencia externa a resolver antes de escalar a más clientes/agencias — no bloqueante mientras sea el Business Manager propio de Rainbow.
