# Frontend Integration Guide

Guía para integrar la API de procesamiento de audio desde Expo (React Native).

---

## Resumen

1. El usuario graba audio.
2. Subes el archivo con `POST /api/audio`.
3. Recibes `jobId` inmediatamente (202).
4. Haces polling cada 2–3 segundos con `GET /api/jobs/:jobId`.
5. Cuando `status === "completed"`, muestras el resultado.
6. Si `status === "failed"`, ofreces reintentar.

**Nunca esperes la respuesta del procesamiento de IA en la misma petición de upload.**

---

## Configuración base

```typescript
const API_BASE_URL = "http://localhost:3000/api"; // o tu URL de producción

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("User not authenticated");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}
```

---

## 1. Subir audio

### Request

```
POST /api/audio
Content-Type: multipart/form-data
Authorization: Bearer <supabase_access_token>
```

El campo del archivo debe llamarse **`audio`**.

### Ejemplo Expo / React Native

```typescript
import * as FileSystem from "expo-file-system";

interface UploadAudioResponse {
  success: boolean;
  jobId: string;
  status: "pending";
}

async function uploadAudio(uri: string): Promise<UploadAudioResponse> {
  const headers = await getAuthHeaders();

  const formData = new FormData();

  formData.append("audio", {
    uri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/audio`, {
    method: "POST",
    headers: {
      ...headers,
      // NO incluyas Content-Type; fetch lo setea con boundary
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Upload failed");
  }

  return data;
}
```

### Qué esperar

- **HTTP 202 Accepted** — éxito, job creado.
- Respuesta inmediata (~100–500ms), sin esperar IA.

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

---

## 2. Polling del job

Consulta el estado cada **2–3 segundos** hasta que termine o falle.

```typescript
type JobStatus = "pending" | "processing" | "completed" | "failed";

interface JobPollResponse {
  success: boolean;
  jobId: string;
  status: JobStatus;
  progress: number;
  result?: {
    transcription: string;
    structuredData: StructuredData;
    record: Record;
  };
  error?: {
    message: string;
    occurredAt: string;
  };
}

interface StructuredData {
  type: "task" | "reminder" | "meeting" | "expense" | "income" | "note" | "idea";
  title: string;
  description?: string | null;
  priority?: "low" | "medium" | "high" | null;
  date?: string | null;
  client?: string | null;
  project?: string | null;
  amount?: number | null;
  currency?: string | null;
}

async function getJobStatus(jobId: string): Promise<JobPollResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, { headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to fetch job");
  }

  return data;
}
```

### Función de polling con timeout

```typescript
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_DURATION_MS = 120_000; // 2 minutos

async function waitForJobCompletion(jobId: string): Promise<JobPollResponse> {
  const start = Date.now();

  while (Date.now() - start < MAX_POLL_DURATION_MS) {
    const job = await getJobStatus(jobId);

    if (job.status === "completed" || job.status === "failed") {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Job processing timeout");
}
```

---

## 3. Detectar cuando terminó

```typescript
const job = await waitForJobCompletion(jobId);

if (job.status === "completed") {
  // Mostrar resultado
  console.log(job.result?.structuredData);
} else if (job.status === "failed") {
  // Mostrar error y opción de retry
  console.error(job.error?.message);
}
```

Estados terminales: **`completed`** y **`failed`**.

---

## 4. Obtener solo el resultado

Cuando ya sabes que terminó, puedes usar el endpoint dedicado:

```typescript
async function getJobResult(jobId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/result`, { headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message);
  }

  return data.data;
}
```

Útil si guardaste el `jobId` y quieres recuperar el resultado más tarde.

---

## 5. Reintentar job fallido

```typescript
async function retryJob(jobId: string) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/retry`, {
    method: "POST",
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message);
  }

  // Vuelve a hacer polling
  return waitForJobCompletion(data.jobId);
}
```

---

## 6. Eliminar job

```typescript
async function deleteJob(jobId: string) {
  const headers = await getAuthHeaders();

  await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: "DELETE",
    headers,
  });
}
```

---

## 7. Manejo de errores

| Escenario | HTTP | Acción en UI |
|---|---|---|
| Sin token | 401 | Redirigir a login |
| Archivo muy grande | 400 | "El audio es demasiado grande" |
| Formato no soportado | 400 | "Formato de audio no válido" |
| Job no encontrado | 404 | "Procesamiento no encontrado" |
| Job aún procesando (result) | 409 | Seguir polling |
| Job falló | failed status | Botón "Reintentar" |
| Timeout de polling | — | "Tardó demasiado, intenta de nuevo" |
| Sin conexión | — | Mensaje offline + retry |

```typescript
try {
  const { jobId } = await uploadAudio(uri);
  setJobId(jobId);
  const result = await waitForJobCompletion(jobId);
  // ...
} catch (error) {
  if (error.message.includes("401")) {
    navigation.navigate("Login");
  } else {
    showToast(error.message);
  }
}
```

---

## 8. UX recomendada por estado

Mapea `status` + `progress` a mensajes amigables:

| Estado API | Progress | Mensaje UI |
|---|---|---|
| (upload en curso) | — | **Subiendo audio...** |
| pending | 0 | **Procesando...** |
| processing | 10–24 | **Transcribiendo...** |
| processing | 25–49 | **Analizando...** |
| processing | 50–74 | **Organizando...** |
| processing | 75–99 | **Guardando...** |
| completed | 100 | **Listo** ✓ |
| failed | — | **Error** + botón Reintentar |

### Ejemplo de hook React

```typescript
function getStatusMessage(status: JobStatus, progress: number): string {
  if (status === "pending") return "Procesando...";
  if (status === "processing") {
    if (progress < 25) return "Transcribiendo...";
    if (progress < 50) return "Analizando...";
    if (progress < 75) return "Organizando...";
    return "Guardando...";
  }
  if (status === "completed") return "Listo";
  if (status === "failed") return "Error al procesar";
  return "Procesando...";
}
```

### Flujo UX completo recomendado

```
[Grabar] → [Subiendo audio...] → [Spinner con mensaje dinámico]
                                        ↓
                              polling cada 2.5s
                                        ↓
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
              [Listo ✓]                              [Error + Reintentar]
           Mostrar tarjeta                           POST /retry
           con type, title,                          y volver a polling
           date, etc.
```

### Buenas prácticas UX

1. **Feedback inmediato**: Tras soltar el botón de grabación, muestra "Subiendo..." al instante.
2. **No bloquees la UI**: El usuario puede seguir navegando mientras procesa en background.
3. **Notificación push/local**: Cuando `completed`, notifica si el usuario salió de la pantalla.
4. **Persistir jobId**: Guarda en AsyncStorage por si cierran la app mid-process.
5. **Timeout generoso**: 60–120s para audios largos; luego ofrece retry.
6. **Optimistic UI opcional**: Muestra placeholder "Procesando tu nota..." antes del primer poll.
7. **Cancelar polling**: Usa `AbortController` o flag al desmontar el componente.

---

## Flujo completo integrado

```typescript
async function processVoiceRecording(audioUri: string) {
  // 1. UI: "Subiendo audio..."
  setUiState("uploading");

  const { jobId } = await uploadAudio(audioUri);

  // 2. UI: "Procesando..."
  setUiState("processing");
  setJobId(jobId);

  // 3. Polling
  const job = await waitForJobCompletion(jobId, (progress, status) => {
    setProgress(progress);
    setMessage(getStatusMessage(status, progress));
  });

  // 4. Resultado
  if (job.status === "completed") {
    setUiState("done");
    return job.result;
  }

  setUiState("error");
  throw new Error(job.error?.message);
}
```

---

## Checklist de integración

- [ ] Supabase Auth configurado en Expo
- [ ] Token Bearer en cada request
- [ ] Campo form-data: `audio`
- [ ] Polling cada 2–3 segundos
- [ ] Manejo de estados pending/processing/completed/failed
- [ ] Mensajes UX por progress
- [ ] Retry en jobs fallidos
- [ ] Timeout de polling
- [ ] Persistencia de jobId (opcional)

---

## Soporte

Consulta `BACKEND_API.md` para detalles de arquitectura, esquema DB y códigos de error completos.
