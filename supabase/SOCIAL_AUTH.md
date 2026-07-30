# Social Sign-In (Google y Apple)

La app usa el backend (`POST /api/auth/google` y `POST /api/auth/apple`) con Supabase `signInWithIdToken`. El frontend obtiene el token nativo y el backend crea la sesión.

## 1. Supabase Dashboard

Proyecto: `dwbotbxqwdhultimuims`

1. **Authentication** → **Providers**
2. Habilitar **Google** y pegar el **Web Client ID** y **Client Secret** de Google Cloud.
3. Habilitar **Apple** y configurar:
   - **Services ID** (Apple Developer)
   - **Secret Key** (`.p8` generado en Apple Developer)
   - **Key ID** y **Team ID**

## 2. Google Cloud Console

1. Crear proyecto o usar uno existente.
2. **APIs & Services** → **Credentials** → **Create OAuth client ID**.
3. Crear al menos un **Web application** client:
   - Authorized redirect URIs (desarrollo Expo):
     - `https://auth.expo.io/@your-expo-username/kivo`
     - `kivo://redirect` (scheme de la app)
4. Para builds nativos, crear también:
   - **iOS** client (bundle ID: `com.kivo.app`)
   - **Android** client (package name del build)

Variables en `frontend-asistente-personal/.env`:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxx.apps.googleusercontent.com
```

## 3. Apple Developer

1. **Certificates, Identifiers & Profiles** → **Identifiers**
2. App ID con capability **Sign In with Apple**.
3. Crear **Services ID** para web/OAuth.
4. Crear **Key** para Sign in with Apple (descargar `.p8`).
5. En Supabase, pegar Team ID, Key ID, Services ID y el secret generado.

**Nota:** Sign in with Apple solo funciona en **iOS** (y requiere build nativo o dispositivo físico; no en Expo Go para producción).

## 4. Flujo técnico

```
Usuario pulsa "Continuar con Google/Apple"
    → Frontend obtiene idToken (expo-auth-session / expo-apple-authentication)
    → POST /api/auth/google o /api/auth/apple { idToken, nonce? }
    → Backend: supabase.auth.signInWithIdToken(...)
    → Backend: ensureProfile + session
    → Frontend guarda tokens y navega a Home
```

## 5. Endpoints

| Método | Ruta | Body |
|--------|------|------|
| POST | `/api/auth/google` | `{ "idToken": "..." }` |
| POST | `/api/auth/apple` | `{ "idToken": "...", "nonce": "..." }` |

## 6. Desarrollo con mock auth

Si `DEV_MOCK_AUTH=true` en el backend, los endpoints sociales crean usuarios mock sin validar tokens reales.
