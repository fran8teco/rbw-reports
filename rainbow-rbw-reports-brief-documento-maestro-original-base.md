# Rainbow Reports — Brief Técnico

Herramienta interna de reportería de performance para Rainbow®, agencia de marketing. Reemplaza un software de reportería de terceros (~25 USD/mes). Integra Meta Ads, Google Ads y GA4, genera informes en PDF, automatiza el envío mensual con comentario redactado por IA. Diseñada multi-tenant desde el modelo de datos para eventualmente venderse a otras agencias, aunque hoy solo la usa Rainbow con 2 clientes.

**Nombre interno:** Rainbow Reports (working title, cambiar libremente).

---

## 1. Stack técnico

| Capa | Elección |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Base de datos | PostgreSQL |
| ORM | Drizzle |
| Auth | Auth.js (Credentials provider, email/password) |
| Cola de jobs / cron | pg-boss (corre sobre Postgres, sin Redis) |
| Generación de PDF | Gotenberg (contenedor Docker separado, HTML → PDF vía Chromium headless) |
| Emails | Brevo (API transaccional) |
| IA para comentarios | API de Claude, modelo económico (Haiku) |
| Infra | VPS Contabo, orquestado con Coolify, todo dockerizado |
| i18n | next-intl, un solo locale `es` cargado inicialmente, estructura lista para más |

No usar Redis, no usar colas externas, no usar generación de PDF con librerías nativas (jsPDF, PDFKit, etc.) — el PDF tiene que ser un render HTML real vía Gotenberg para garantizar paridad pixel-a-pixel con el preview web.

---

## 2. Modelo de datos

```sql
organizations
  id, name, slug, created_at

users
  id, organization_id, email, password_hash, role ('admin'|'editor'), created_at

clients
  id, organization_id, name, logo_url, active, created_at

org_credentials                      -- credenciales a nivel organización (no por cliente)
  id, organization_id, platform ('meta'|'google_ads'|'ga4'),
  encrypted_payload jsonb,           -- cifrado con AES, clave desde env var de Coolify
  created_at, updated_at

connected_accounts                   -- 1 fila por cuenta de cliente vinculada
  id, client_id, platform ('meta'|'google_ads'|'ga4'),
  external_id text,                  -- ad_account_id / customer_id / property_id
  display_name text,
  timezone text,                     -- IANA tz, detectado automáticamente al conectar
  currency text default 'USD',       -- moneda nativa reportada por la API (ver sección 4.4)
  conversion_action_type text,       -- solo Meta: qué action_type cuenta como "conversión" (ver 4.1)
  status ('active'|'error'|'pending'),
  last_synced_at timestamptz

daily_metric_values                  -- tabla de hechos, formato largo
  id, connected_account_id, date, metric_key text, value numeric, synced_at
  UNIQUE (connected_account_id, date, metric_key)

sync_logs
  id, connected_account_id, started_at, finished_at,
  status ('success'|'error'|'partial'), error_message, records_synced

fx_rates                             -- solo si connected_accounts.currency != 'USD'
  id, date, currency, rate_to_usd numeric

report_templates
  id, organization_id, client_id nullable,   -- null = plantilla global
  name, service_type ('meta'|'google'|'ga4'|'mixto'),
  blocks jsonb[], created_at

reports
  id, client_id, template_id nullable,
  period_start date, period_end date,
  status ('draft'|'pending_review'|'sent'|'failed'),
  blocks_snapshot jsonb[],           -- copia resuelta de bloques + datos, inmutable
  ai_comment text,                   -- editable en la ventana de revisión
  pdf_url text,
  generated_at, reviewed_at, sent_at

ai_prompts
  id, organization_id, scope ('global'|'client'), client_id nullable,
  prompt_text text
```

**Metric keys canónicos:** `spend, impressions, clicks, conversions, sessions, users, revenue`. Ninguna parte de la app (constructor de informes, bloques, plantillas) conoce nombres de campo nativos de las APIs — todo pasa por este set. Métricas derivadas (CTR, CPC, CPA, ROAS) **no se guardan**, se calculan en el momento de renderizar a partir de las atómicas.

---

## 3. Sincronización de datos

### 3.1 Cron diario (pg-boss)
- Un job por `connected_account`, corre de madrugada.
- Trae el día anterior usando el `timezone` propio de la cuenta (no UTC) — así "el día" coincide con lo que el cliente ve en su propio Ads Manager / GA4.
- Normaliza los campos nativos al metric_key canónico correspondiente (ver mapeo abajo).
- Upsert idempotente en `daily_metric_values` — correr el sync dos veces el mismo día no duplica filas.

### 3.2 Concurrencia y reintentos
- Concurrencia limitada por plataforma (ej: máx. 3 simultáneos para Meta, 3 para Google Ads, 5 para GA4).
- Reintentos con backoff exponencial (nativo de pg-boss). 3 fallos consecutivos → `connected_accounts.status = 'error'` + **email automático vía Brevo** avisando del error (además de quedar visible en el panel). No depender solo del panel: si un token se vence, hay que enterarse sin tener que entrar a revisar.

### 3.3 Backfill inicial
- Al vincular una cuenta nueva: job aparte que trae los últimos 90 días, no esperar acumulación día a día.

### 3.4 Mapeo de métricas por plataforma

| metric_key | Meta Ads (Insights API) | Google Ads API | GA4 Data API |
|---|---|---|---|
| spend | `spend` | `metrics.cost_micros / 1_000_000` | — |
| impressions | `impressions` | `metrics.impressions` | — |
| clicks | `clicks` | `metrics.clicks` | — |
| conversions | `actions[]` filtrado por `conversion_action_type` (configurable por cuenta, ver 3.5) | `metrics.conversions` | `conversions` (key events) |
| sessions | — | — | `sessions` |
| users | — | — | `activeUsers` |
| revenue | — | — | `totalRevenue` (solo clientes ecommerce) |

### 3.5 Particularidad de Meta: `conversion_action_type`
Meta no devuelve un campo único de "conversión", sino un array `actions[]` con distintos `action_type` (compra, lead, registro, etc.). Cada cliente puede tener un objetivo distinto. En el panel, al conectar una cuenta de Meta, hay que poder elegir/configurar qué `action_type` cuenta como conversión para ese cliente. Guardar en `connected_accounts.conversion_action_type`.

### 3.6 Moneda (USD)
Rainbow reporta siempre en USD a sus clientes, pero **las APIs devuelven el spend en la moneda nativa de la cuenta publicitaria**, que puede no ser USD (ej. un cliente con su cuenta de Meta configurada en ARS). Guardar el valor crudo tal cual llega + `connected_accounts.currency`. Si `currency != 'USD'`, convertir a USD en el momento de renderizar (no al guardar), usando `fx_rates` con snapshot diario de una API de cambio gratuita (ej. exchangerate.host o similar). Si `currency = 'USD'`, no hay conversión, es el caso por defecto.

---

## 4. Constructor de informes

### 4.1 Tipos de bloque

```json
{
  "id": "blk_01",
  "type": "kpi | table | chart | text | image",
  "position": { "x": 0, "y": 0, "w": 4, "h": 2 },
  "config": { }
}
```

**KPI**
```json
{
  "metric_key": "spend",
  "label": "Inversión Total",
  "connected_account_id": "uuid | all",
  "aggregation": "sum | avg | last",
  "format": "currency | number | percent",
  "show_comparison": true,
  "show_range_indicator": true
}
```

**Tabla**
```json
{
  "columns": [
    { "metric_key": "spend", "label": "Inversión", "format": "currency" },
    { "metric_key": "ctr", "label": "CTR", "format": "percent" }
  ],
  "group_by": "connected_account | campaign | date",
  "sort_by": "spend",
  "limit": 10
}
```

**Gráfico**
```json
{
  "chart_type": "line | bar",
  "metric_keys": ["spend", "conversions"],
  "connected_account_id": "uuid",
  "granularity": "daily | weekly",
  "show_comparison": true
}
```

**Texto / Imagen**
```json
{ "content": "markdown", "is_ai_generated": false }
{ "url": "string", "alt": "string" }
```

`report_templates.blocks` = array ordenado de bloques sin datos resueltos. Al generar un informe, cada bloque se resuelve contra `daily_metric_values` y el resultado (ya con números) se congela en `reports.blocks_snapshot` — así un informe enviado no cambia si después se edita la plantilla.

### 4.2 Plantillas
Reutilizables por cliente o por tipo de servicio (`service_type`). Una plantilla con `client_id = null` es global y aplica como default para cualquier cliente que no tenga una propia.

---

## 5. Exportación PDF
- Preview web y PDF final deben ser el mismo render HTML.
- Gotenberg corre como contenedor Docker separado (deploy vía Coolify), recibe la URL del preview (o el HTML directamente) y devuelve el PDF.
- No usar generación de PDF embebida en el proceso Next.js (colgaría el event loop, especialmente el día 3 de cada mes cuando se generan todos los informes juntos).

---

## 6. Automatización mensual
1. **Día 3 de cada mes** (no día 1 — ver nota abajo), timezone `America/Montevideo`.
2. Antes de generar: re-sync forzado de los últimos 5 días del mes recién cerrado (por ventanas de atribución, ver nota).
3. Para cada cliente activo con informe habilitado: resolver la plantilla correspondiente, calcular variación vs. mes anterior si está activada esa comparación.
4. Generar comentario de análisis (1-3 párrafos) llamando a la API de Claude (Haiku), combinando `ai_prompts` scope `global` + scope `client` (si existe) para ese cliente, con las métricas del informe como contexto.
5. Informe queda en estado `pending_review`.
6. **Ventana de revisión: 48 horas.** Si Fran edita el comentario, se guarda el cambio. Si no se toca nada, pasadas las 48hs se envía automáticamente por email (Brevo) y pasa a estado `sent`.

> **Nota — por qué día 3 y no día 1 (como se pidió originalmente):** las conversiones de Meta Ads tienen ventanas de atribución de hasta 7 días. Un informe generado el día 1 va a subestimar las conversiones de la última semana del mes, que siguen sumando después de que el mes "cerró" en el calendario. Generar el día 3 con un re-sync forzado reduce ese desfasaje sin perder la idea de "principios de mes".

### 6.1 Generación manual/on-demand
Además del flujo automático, cualquier informe tiene que poder generarse a demanda desde el panel, para cualquier período, sin esperar al cron mensual. Mismo pipeline (resolver plantilla → calcular métricas → generar comentario IA opcional → preview → export PDF), pero disparado manualmente y sin pasar por la ventana de revisión de 48hs (se revisa ahí mismo, en el momento).

---

## 7. Panel de administración
- Alta de clientes.
- Vinculación de cuentas Meta/Google Ads/GA4 por cliente (incluye configurar `conversion_action_type` para Meta).
- Gestión de plantillas de informe.
- Vista de informes generados, con filtro por estado (`draft/pending_review/sent/failed`).
- Vista de `connected_accounts` con estado de sync y errores.
- Gestión de usuarios y roles (admin/editor) — funcional desde el día 1 aunque hoy solo exista un usuario.

---

## 8. Autenticación
- Auth.js, provider Credentials (email + password).
- No hay self-signup: los usuarios se crean desde el panel por un admin.
- Roles: `admin` (todo) / `editor` (gestiona clientes e informes, no gestiona usuarios ni credenciales de organización).

---

## 9. Diseño
Ver mockup de referencia adjunto (`rainbow-informe-mockup.html`) — **es punto de partida, no está cerrado.** Dirección actual:
- Modo oscuro por defecto, alternativa en modo claro.
- Bordes redondeados, acentos "glow".
- Paleta: fondo negro-azulado (no negro puro ni cream/terracota genérico), espectro violeta→cian→ámbar→coral usado solo como elemento funcional (indicador de rango en KPIs), no decorativo.
- Tipografía: Instrument Sans (texto), JetBrains Mono (todos los números, tabular).
- Layout de informe pensado en proporción A4 desde el web preview, para que el PDF sea 1:1.

El diseño final del panel de administración (distinto del informe en sí) queda abierto para definir en desarrollo — el foco de diseño hasta ahora fue el informe, que es lo que ve el cliente.

---

## 10. Multi-tenancy e i18n (preparado, no implementado a fondo)
- El modelo de datos ya soporta múltiples `organizations`, pero hoy solo existe una (Rainbow). No construir billing, self-serve signup, ni límites de plan — eso es v2/v3, cuando exista una segunda organización real.
- i18n con `next-intl`, un archivo `es.json`, sin traducir a otros idiomas todavía. La estructura tiene que permitir agregar un locale nuevo sin reescribir componentes.

---

## 11. Fuera de alcance v1
- No hay portal ni login para que los clientes vean un dashboard en vivo. El único entregable para el cliente es el PDF por email.
- Comparativas: solo mes actual vs. mes anterior. No interanual todavía.
- No hay billing ni onboarding self-serve para otras agencias.
- No hay tests automatizados extensivos — priorizar velocidad de desarrollo para un proyecto de un solo usuario interno.

---

## 12. Plan de desarrollo — por hitos

Cada hito es una sesión separada con Claude Code (este brief completo + instrucción de trabajar solo en ese hito). No pedir todo de una. Cada hito termina en algo verificable en el navegador sin leer código.

1. **Setup base** — repo, Next.js, Postgres/Drizzle, Auth.js funcionando, deploy en Coolify.
   → *Chequeo: login funciona en el VPS real.*
2. **Panel admin (CRUD)** — organización, clientes, cuentas conectadas, con datos cargados a mano (sin pegarle a las APIs todavía).
   → *Chequeo: das de alta un cliente y una cuenta "conectada" ficticia.*
3. **Integración Meta Ads** (primero — es la de mayor riesgo por App Review, mejor descubrir ese problema temprano) + sync diario + `daily_metric_values`.
   → *Chequeo: datos reales del Business Manager en la base.*
4. **Google Ads + GA4** — mismo patrón ya validado en el hito 3.
   → *Chequeo: las 3 fuentes sincronizando.*
5. **Constructor de informes** — bloques, plantillas, preview web.
   → *Chequeo: armás un informe a mano con datos reales.*
6. **Export PDF** (Gotenberg).
   → *Chequeo: PDF idéntico al preview.*
7. **Automatización mensual + IA + Brevo** — pipeline completo, ventana de revisión de 48hs, envío automático.
   → *Chequeo: no tocás nada y el informe llega solo al email.*

---

## 13. Consideraciones operativas
- **URL de producción:** `reports.rbwsuite.com`, siguiendo el patrón de subdominios ya usado en la Suite (ej. `n8n.rbwsuite.com`). Deploy vía Coolify con SSL automático (Let's Encrypt), mismo flujo que las apps existentes en ese dominio.
- Secrets (tokens de Meta/Google/GA4, clave de cifrado, API key de Claude, API key de Brevo) van como variables de entorno gestionadas por Coolify, nunca en el repo.
- Backups de Postgres: snapshot diario del volumen en el VPS (definir retención en implementación, no bloqueante para arrancar).
- Meta App Review para el permiso `ads_read` en producción: dependencia externa a resolver antes de escalar a más clientes/agencias, no bloqueante para el desarrollo inicial con el Business Manager propio de Rainbow.
