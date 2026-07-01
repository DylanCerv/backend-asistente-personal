# Auth sin correos

## Backend (implementado)

El registro **nunca** usa `auth.signUp()`. Siempre:

```javascript
admin.auth.admin.createUser({ email_confirm: true, ... })
```

Eso **no dispara** emails de Supabase.

Endpoints seguros (sin email):
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

No hay endpoints de reset password, magic link ni invite.

## Supabase Dashboard (recomendado)

Para cubrir cualquier otro flujo (p. ej. alguien use el cliente Supabase directo):

1. **Authentication** → **Providers** → **Email**
   - Desactivar **Confirm email**
   - Desactivar **Secure email change** (opcional)

2. **Authentication** → **Email Templates**
   - No usar plantillas; o dejar desactivado confirm signup

3. No habilitar **Magic Link** ni **Phone OTP** si no los necesitas.

## Frontend Expo

| ❌ No usar | ✅ Usar |
|-----------|--------|
| `supabase.auth.signUp()` | `POST /api/auth/register` |
| `supabase.auth.resetPasswordForEmail()` | (no implementado — reset manual por admin si hace falta) |
| `supabase.auth.signInWithOtp()` | `POST /api/auth/login` |

## Usuarios antiguos sin confirmar

Si quedaron usuarios creados antes con email sin confirmar:

```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
```

(Solo en desarrollo / migración puntual.)
