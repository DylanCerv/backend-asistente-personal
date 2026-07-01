# Supabase Database Schema

Project: **dwbotbxqwdhultimuims** (`https://dwbotbxqwdhultimuims.supabase.co`)

## Authentication

Login and registration use **Supabase Auth** (`auth.users`).

On signup, a row is auto-created in `public.profiles` with role `client`.

Registro vía **Admin API** (sin envío de correos). Ver `supabase/AUTH_NO_EMAILS.md`.

### Frontend (Expo)

Usa **solo la API del backend** — no `supabase.auth.signUp()` en la app.

```typescript
await fetch(`${API_URL}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, fullName: name }),
});

await fetch(`${API_URL}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

## Roles

Ver `supabase/ROLES.md`. Tabla `roles` con IDs numéricos:

| id | name |
|----|------|
| 1 | Cliente (default al registrarse) |
| 2 | Administrador |

`profiles.role_id` → FK a `roles.id`

## Tables

| Table | Purpose | Scoped by |
|---|---|---|
| `roles` | Catálogo de roles (IDs fijos) | global read |
| `profiles` | User profile + role_id | `id = auth.users.id` |
| `jobs` | Async audio processing | `user_id` |
| `records` | AI-structured data | `user_id` |
| `tags` | User labels | `user_id` |
| `record_tags` | Record ↔ tag links | `user_id` |

## RLS

- **Client**: `auth.uid() = user_id`
- **Admin**: `public.is_admin()` → acceso global
- **Backend worker**: `service_role` (bypass RLS)
- **Anon key + JWT**: funciona con rol `authenticated`

## Migrations applied (remote)

1. `initial_app_schema`
2. `rls_policies_authenticated`
3. `storage_audio_bucket`
4. `harden_function_permissions`
5. `add_user_roles`
6. `rls_policies_with_admin_role`

Local files: `supabase/migrations/002_` … `007_`
