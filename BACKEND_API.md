# Backend API — Personal Assistant

Documentación completa del backend asíncrono para procesamiento de audio con IA.

---

## Decisión arquitectónica

Se implementó una **cola de jobs respaldada por PostgreSQL (Supabase)** con la función `claim_next_pending_job()` que usa `FOR UPDATE SKIP LOCKED`.

### ¿Por qué esta arquitectura?

| Alternativa | Ventaja | Desventaja |
|---|---|---|
| Procesamiento síncrono en HTTP | Simple | El usuario espera 10–30s+ |
| Redis + BullMQ | Muy escalable | Infraestructura adicional |
| **PostgreSQL queue (implementada)** | Sin Redis, jobs persistentes, múltiples workers | Polling cada 2s |

Esta solución es **más escalable y mantenible** que un worker con polling naive porque:

1. **Atomicidad**: Solo un worker puede reclamar un job (`SKIP LOCKED`).
2. **Persistencia**: Los jobs sobreviven reinicios del servidor.
3. **Escalabilidad horizontal**: Puedes ejecutar N workers en paralelo.
4. **Stack unificado**: Ya usas Supabase; no introduces Redis.

Para escalar más adelante, puedes migrar el worker a BullMQ sin cambiar la API HTTP.

---

## Documentación Swagger (OpenAPI 3.0)

La API incluye documentación interactiva con Swagger UI.

| Recurso | URL |
|---|---|
| Swagger UI | `http://localhost:3000/api/docs` (solo si `NODE_ENV` ≠ `production`) |
| OpenAPI JSON | `http://localhost:3000/api/docs.json` (mismo: desactivado en production) |

La especificación vive en `src/docs/openapi.js`. Para actualizar la documentación al cambiar endpoints, edita ese archivo.

**Probar endpoints autenticados en Swagger:**

1. Abre `/api/docs`
2. Clic en **Authorize**
3. Pega el Supabase access token: `Bearer <token>` o solo el token (Swagger añade el prefijo)
4. Usa **Try it out** en cualquier endpoint

---

## Estructura del proyecto

```
src/
├── app.js                    # Factory Express (sin listen)
├── server.js                 # Entry point API
├── config/                   # Variables de entorno
├── clients/                  # Supabase, OpenAI
├── constants/                # Estados, tipos
├── controllers/              # HTTP thin layer
├── errors/                   # AppError, NotFoundError, etc.
├── middlewares/              # Auth, upload, validation, errors
├── repositories/             # Acceso a datos (Supabase)
├── routes/                   # Express routers
├── services/                 # Lógica de negocio
├── utils/                    # Logger, retry
├── validators/               # Schemas Zod
└── workers/
    ├── index.js              # Entry point worker
    └── job.worker.js         # Polling loop

supabase/migrations/
└── 001_initial_schema.sql    # Tablas jobs, records, RPC claim
```

### Capas y responsabilidades

```
HTTP Request
    ↓
Routes → Middlewares (auth, upload, validate)
    ↓
Controllers (solo delegación)
    ↓
Services (lógica de negocio)
    ↓
Repositories (Supabase / Storage)
```

Los **controllers no contienen lógica de negocio**. Solo reciben la request, llaman al service y formatean la response.

---

## Flujo completo

```
Frontend                    API Server                  Worker
   │                            │                          │
   │  POST /api/audio           │                          │
   │  (multipart audio)         │                          │
   ├───────────────────────────►│                          │
   │                            │  Guarda audio            │
   │                            │  Crea job (pending)      │
   │◄───────────────────────────┤                          │
   │  202 { jobId, pending }    │                          │
   │                            │                          │
   │  GET /api/jobs/:id (poll)  │                          │
   ├───────────────────────────►│                          │
   │◄───────────────────────────┤                          │
   │  { status: processing }    │                          │
   │                            │     claim_next_pending   │
   │                            │◄─────────────────────────┤
   │                            │                          │ Whisper STT
   │                            │                          │ GPT extract
   │                            │                          │ Save record
   │                            │                          │ status=completed
   │  GET /api/jobs/:id         │                          │
   ├───────────────────────────►│                          │
   │◄───────────────────────────┤                          │
   │  { status: completed,      │                          │
   │    result: {...} }         │                          │
```

---

## Base de datos (Supabase)

### Tabla `jobs`

| Columna | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | Usuario propietario |
| status | TEXT | pending, processing, completed, failed |
| progress | INT | 0–100 |
| audio_url | TEXT | URL pública (Supabase Storage) |
| audio_path | TEXT | Path interno del archivo |
| transcription | TEXT | Texto transcrito |
| structured_data | JSONB | JSON extraído por GPT |
| error | JSONB | `{ message, stack, occurredAt }` |
| retry_count | INT | Reintentos |
| deleted_at | TIMESTAMPTZ | Soft delete |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabla `records`

| Columna | Tipo | Descripción |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | |
| job_id | UUID | FK → jobs |
| type | TEXT | task, reminder, meeting, expense, income, note, idea |
| title | TEXT | |
| description | TEXT | |
| priority | TEXT | low, medium, high |
| date | TIMESTAMPTZ | |
| client | TEXT | |
| project | TEXT | |
| amount | NUMERIC | Para expense/income |
| currency | TEXT | |
| data | JSONB | Metadata adicional |

### Migración

Ejecuta `supabase/migrations/001_initial_schema.sql` en el SQL Editor de Supabase.

Crea también el bucket de storage `audio-uploads` (privado recomendado).

---

## Autenticación

Todos los endpoints requieren:

```
Authorization: Bearer <supabase_access_token>
```

El middleware valida el JWT con Supabase Auth y extrae `user_id`.

---

## Endpoints

Base URL: `http://localhost:3000/api`

### Health check

```
GET /api/health
```

**Response 200:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-06-30T12:00:00.000Z"
}
```

---

### Subir audio

```
POST /api/audio
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Body (form-data):**

| Field | Type | Required |
|---|---|---|
| audio | File | Yes |

Formatos soportados: mp3, m4a, wav, webm, ogg, mp4.

**Response 202:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

---

### Consultar estado del job

```
GET /api/jobs/:jobId
Authorization: Bearer <token>
```

**Response — pending:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "progress": 0,
  "createdAt": "2026-06-30T12:00:00.000Z",
  "updatedAt": "2026-06-30T12:00:00.000Z"
}
```

**Response — processing:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 50,
  "createdAt": "2026-06-30T12:00:00.000Z",
  "updatedAt": "2026-06-30T12:00:05.000Z"
}
```

**Response — completed:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "createdAt": "2026-06-30T12:00:00.000Z",
  "updatedAt": "2026-06-30T12:00:15.000Z",
  "result": {
    "transcription": "Recuérdame llamar a Juan mañana a las 10",
    "structuredData": {
      "type": "reminder",
      "title": "Llamar a Juan",
      "description": null,
      "priority": "medium",
      "date": "2026-07-01T10:00:00.000Z",
      "client": "Juan",
      "project": null
    },
    "record": {
      "id": "...",
      "type": "reminder",
      "title": "Llamar a Juan"
    }
  }
}
```

**Response — failed:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "progress": 25,
  "error": {
    "message": "OpenAI rate limit exceeded",
    "occurredAt": "2026-06-30T12:00:10.000Z"
  }
}
```

---

### Obtener resultado final

```
GET /api/jobs/:jobId/result
Authorization: Bearer <token>
```

Solo disponible cuando `status === completed`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "transcription": "...",
    "structuredData": { "type": "task", "title": "..." },
    "record": { "id": "...", "type": "task" }
  }
}
```

**Response 409 (aún procesando):**
```json
{
  "success": false,
  "error": {
    "message": "Job is still processing",
    "code": "JOB_IN_PROGRESS"
  }
}
```

---

### Reintentar job fallido

```
POST /api/jobs/:jobId/retry
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

---

### Eliminar job (soft delete)

```
DELETE /api/jobs/:jobId
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "deleted": true
}
```

---

## Estados del job

| Status | Progress | Descripción |
|---|---|---|
| pending | 0 | En cola, esperando worker |
| processing | 10–90 | Worker procesando |
| completed | 100 | Terminado con éxito |
| failed | variable | Error durante procesamiento |

### Progreso durante processing

| Progress | Etapa |
|---|---|
| 10 | Job reclamado |
| 25 | Transcribiendo (Whisper) |
| 50 | Analizando transcripción |
| 75 | Estructurando JSON |
| 90 | Guardando record |
| 100 | Completado |

---

## Códigos de error

| HTTP | Code | Descripción |
|---|---|---|
| 400 | VALIDATION_ERROR | Datos inválidos |
| 401 | UNAUTHORIZED | Token inválido o ausente |
| 404 | NOT_FOUND | Job no encontrado |
| 409 | JOB_IN_PROGRESS | Result aún no disponible |
| 409 | JOB_FAILED | Job falló |
| 409 | JOB_NOT_FAILED | Retry solo en jobs failed |
| 500 | INTERNAL_ERROR | Error interno |

Formato de error:
```json
{
  "success": false,
  "error": {
    "message": "Human readable message",
    "code": "ERROR_CODE",
    "details": []
  }
}
```

---

## Variables de entorno

Copia `.env.example` a `.env` y configura:

| Variable | Requerida | Descripción |
|---|---|---|
| SUPABASE_URL | Sí | URL del proyecto |
| SUPABASE_SERVICE_ROLE_KEY | Sí | Para worker y backend |
| SUPABASE_ANON_KEY | Sí | Para validar JWT |
| OPENAI_API_KEY | Sí | API key OpenAI |
| PORT | No | Default 3000 |
| WORKER_POLL_INTERVAL_MS | No | Default 2000 |

---

## Ejecución

```bash
# Instalar dependencias
npm install

# Terminal 1 — API
npm run dev

# Terminal 2 — Worker
npm run worker

# O ambos juntos
npm run dev:all
```

---

## Worker

Proceso independiente que:

1. Llama `claim_next_pending_job()` (atomic claim)
2. Descarga/prepara el audio
3. Transcribe con OpenAI Whisper
4. Extrae JSON estructurado con GPT
5. Guarda en `records` y actualiza `jobs`
6. En error: marca `failed` con message, stack, fecha

Reintentos automáticos para errores temporales (429, 5xx, timeouts).

---

## Ejemplo cURL

```bash
# Subir audio
curl -X POST http://localhost:3000/api/audio \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@recording.m4a"

# Consultar job
curl http://localhost:3000/api/jobs/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```
