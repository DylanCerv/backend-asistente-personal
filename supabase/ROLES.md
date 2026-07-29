# Roles (numeric IDs)

## Tabla `roles`

| id | name |
|----|------|
| **1** | Cliente |
| **2** | Administrador |

## Relación

`profiles.role_id` → `roles.id` (FK)

- Registro: `role_id = 1` automático (trigger + backend)
- Admin: asignar `role_id = 2` manualmente o vía API

## Crear primer admin

```sql
UPDATE public.profiles SET role_id = 2 WHERE email = 'tu@email.com';
```

O vía API (admin existente):

```http
PATCH /api/profiles/:profileId/role
{ "roleId": 2 }
```

## Consultar roles

Requiere autenticación (`Authorization: Bearer <token>`).

```http
GET /api/roles
```

Respuesta:
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Cliente" },
    { "id": 2, "name": "Administrador" }
  ]
}
```

## Respuestas de auth

```json
{
  "user": {
    "roleId": 1,
    "role": { "id": 1, "name": "Cliente" }
  }
}
```
