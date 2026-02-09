# Guia: Creacion de un Negocio

## Que significa "crear un negocio"?

En Book & Play, un **negocio** (Business) representa un complejo deportivo: un lugar fisico con canchas que se pueden alquilar por turnos. Crear un negocio es el primer paso para que un usuario pase de ser un simple jugador a ser **dueno y administrador** de su propio complejo.

El proceso no es solo insertar un registro en la base de datos. Involucra tres actores que se conectan entre si:

```
Usuario (User)  ──>  Negocio (Business)  ──>  Vinculo con rol (BusinessUser)
```

Un usuario registrado crea el negocio, y el sistema automaticamente lo vincula como **OWNER** a traves de la entidad intermedia `BusinessUser`. Este vinculo es lo que le otorga permisos de administracion sobre ese negocio.

---

## Por que existe BusinessUser?

Un usuario puede participar en multiples negocios con roles distintos. Por ejemplo, Juan podria ser OWNER de "Complejo Norte" y STAFF en "Complejo Sur". Esto no se puede resolver con un campo `businessRole` en la tabla `users`, porque eso limita al usuario a un solo negocio.

La solucion es una **tabla intermedia** que vincula usuario + negocio + rol:

```
┌──────────┐         ┌────────────────┐         ┌──────────┐
│   User   │ 1 ── N  │  BusinessUser  │  N ── 1 │ Business │
│          │         │                │         │          │
│ id       │         │ id             │         │ id       │
│ name     │         │ userId    (FK) │         │ name     │
│ email    │         │ businessId(FK) │         │ timezone │
│ password │         │ role           │         │ slotDur. │
└──────────┘         └────────────────┘         └──────────┘
```

**Constraint clave**: la combinacion `(businessId, userId)` es unica. Un usuario solo puede tener **un rol** por negocio.

---

## Pasos del flujo

El diagrama de flujo completo abarca desde el registro del usuario hasta la configuracion de canchas y reglas. Esta guia cubre los **primeros 3 pasos fundamentales**: registrarse, autenticarse, y crear el negocio.

```
 ┌─────────────────────┐
 │  1. Registro         │  POST /auth/register
 │  (crear cuenta)      │
 └────────┬────────────┘
          │ cuenta creada
          v
 ┌─────────────────────┐
 │  2. Login            │  POST /auth/login
 │  (obtener token)     │
 └────────┬────────────┘
          │ token JWT
          v
 ┌─────────────────────┐
 │  3. Crear negocio    │  POST /businesses
 │  (con token)         │  (requiere autenticacion)
 └────────┬────────────┘
          │ negocio creado + rol OWNER asignado
          v
    Flujo continua...
    (configurar canchas, reglas, etc.)
```

---

## Paso 1 — Registro de usuario

El usuario crea una cuenta en la plataforma. En este punto no tiene relacion con ningun negocio; es simplemente una identidad global.

### Endpoint

```
POST /auth/register
```

### Body

```json
{
  "name": "Maria Lopez",
  "userName": "marialopez",
  "email": "maria@email.com",
  "password": "miPassword123",
  "phone": "+54 9 11 1234-5678"
}
```

### Respuesta exitosa (201)

```json
{
  "user": {
    "id": "a1b2c3d4-...",
    "name": "Maria Lopez",
    "userName": "marialopez",
    "email": "maria@email.com",
    "globalRole": "PLAYER"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Que pasa en la base de datos?

Se inserta un registro en la tabla `users`:

| id | name | userName | email | global_role |
|---|---|---|---|---|
| a1b2c3d4-... | Maria Lopez | marialopez | maria@email.com | PLAYER |

**Modelo involucrado**: `User`

---

## Paso 2 — Login (autenticacion)

Si el usuario ya tiene cuenta, inicia sesion para obtener un token JWT que usara en las siguientes peticiones.

### Endpoint

```
POST /auth/login
```

### Body

```json
{
  "username": "maria@email.com",
  "password": "miPassword123"
}
```

> El campo `username` acepta tanto el email como el nombre de usuario.

### Respuesta exitosa (200)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Que pasa internamente?

1. El sistema busca al usuario por email o username
2. Compara la contraseña con el hash almacenado (bcrypt)
3. Si es valido, genera un token JWT con el `id` del usuario en el payload (`sub`)
4. El token se usara como `Bearer token` en los endpoints protegidos

**Modelo involucrado**: `User` (solo lectura)

---

## Paso 3 — Crear negocio

Con el token obtenido, el usuario crea su negocio. Este es el paso mas importante porque involucra **dos operaciones atomicas** dentro de una transaccion:

1. Crear el registro `Business`
2. Crear el registro `BusinessUser` que vincula al usuario como OWNER

Si alguna de las dos falla, ambas se revierten.

### Endpoint

```
POST /businesses
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Body

```json
{
  "name": "Complejo Deportivo del Sur",
  "description": "5 canchas de futbol sintetico con iluminacion",
  "address": "Av. Libertad 1234, Buenos Aires",
  "phone": "+54 9 11 9876-5432",
  "email": "contacto@complejosur.com",
  "timezone": "America/Argentina/Buenos_Aires",
  "slotDuration": 60
}
```

| Campo | Requerido | Validacion |
|---|---|---|
| `name` | Si | Minimo 3 caracteres |
| `description` | No | String libre |
| `address` | No | String libre |
| `phone` | No | String libre |
| `email` | No | String libre |
| `timezone` | Si | String no vacio |
| `slotDuration` | Si | Debe ser 30, 60, 90 o 120 (minutos) |

### Respuesta exitosa (201)

```json
{
  "business": {
    "id": "f5e6d7c8-...",
    "name": "Complejo Deportivo del Sur",
    "createdAt": "2026-02-09T15:30:00.000Z"
  }
}
```

### Que pasa en la base de datos?

**Dentro de una transaccion**, se ejecutan dos inserciones:

**Tabla `businesses`**:

| id | name | timezone | slot_duration |
|---|---|---|---|
| f5e6d7c8-... | Complejo Deportivo del Sur | America/Argentina/Buenos_Aires | 60 |

**Tabla `business_users`**:

| id | business_id | user_id | role |
|---|---|---|---|
| x9y8z7w6-... | f5e6d7c8-... | a1b2c3d4-... | OWNER |

**Modelos involucrados**: `Business`, `BusinessUser`

### Respuestas de error

| Codigo | Caso | Ejemplo |
|---|---|---|
| 401 | Sin token o token invalido | No se envia header `Authorization` |
| 400 | Falta campo requerido | Body sin `name` |
| 400 | Nombre muy corto | `"name": "AB"` (menos de 3 caracteres) |
| 400 | slotDuration invalido | `"slotDuration": 45` (no es 30, 60, 90 ni 120) |
| 400 | Falta timezone | Body sin `timezone` |

---

## Ejemplo completo: Maria crea su complejo

### Contexto

Maria Lopez quiere digitalizar la gestion de su complejo de padel. Actualmente coordina turnos por WhatsApp y quiere usar Book & Play.

### 1. Se registra

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Lopez",
    "userName": "mariapadel",
    "email": "maria@padelzone.com",
    "password": "Segura2026!",
    "phone": "+54 9 11 5555-0001"
  }'
```

Respuesta:
```json
{
  "user": {
    "id": "u-001",
    "name": "Maria Lopez",
    "email": "maria@padelzone.com",
    "globalRole": "PLAYER"
  },
  "access_token": "eyJ...token_de_maria"
}
```

**Estado de la DB**:

```
users
├── u-001 | Maria Lopez | mariapadel | PLAYER

business_users
└── (vacia)

businesses
└── (vacia)
```

Maria existe como usuario global. No tiene relacion con ningun negocio.

---

### 2. Inicia sesion (si lo necesita despues)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "maria@padelzone.com",
    "password": "Segura2026!"
  }'
```

Respuesta:
```json
{
  "access_token": "eyJ...nuevo_token"
}
```

---

### 3. Crea su negocio

```bash
curl -X POST http://localhost:3000/businesses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ...token_de_maria" \
  -d '{
    "name": "Padel Zone",
    "description": "4 canchas de padel techadas con vestuarios",
    "address": "Calle Raqueta 456, CABA",
    "phone": "+54 9 11 5555-0002",
    "timezone": "America/Argentina/Buenos_Aires",
    "slotDuration": 90
  }'
```

Respuesta:
```json
{
  "business": {
    "id": "b-001",
    "name": "Padel Zone",
    "createdAt": "2026-02-09T16:00:00.000Z"
  }
}
```

**Estado de la DB despues de crear el negocio**:

```
users
├── u-001 | Maria Lopez | mariapadel | PLAYER

businesses
├── b-001 | Padel Zone | America/Argentina/Buenos_Aires | 90min

business_users
├── bu-001 | business: b-001 | user: u-001 | role: OWNER
```

Maria ahora es **OWNER** de "Padel Zone". Esto le permite:
- Crear y editar canchas
- Configurar reglas de disponibilidad y excepciones
- Gestionar reservas
- Agregar otros usuarios como ADMIN o STAFF
- Ver facturacion y eliminar el negocio

---

## Que sigue despues?

Segun el flujo completo del diagrama, los siguientes pasos (aun no implementados) son:

```
Negocio creado
     │
     v
 ┌──────────────────────────────┐
 │  Configurar canchas?         │──> Crear cancha (nombre, deporte, superficie...)
 │  (puede crear varias)        │    POST /businesses/:id/courts
 └──────────────┬───────────────┘
                v
 ┌──────────────────────────────┐
 │  Configurar disponibilidad?  │──> Crear regla (dias, horarios)
 │  (puede crear varias)        │    POST /businesses/:id/availability-rules
 └──────────────┬───────────────┘
                v
 ┌──────────────────────────────┐
 │  Configurar excepciones?     │──> Crear excepcion (feriados, eventos)
 │  (puede crear varias)        │    POST /businesses/:id/exception-rules
 └──────────────┬───────────────┘
                v
 ┌──────────────────────────────┐
 │  Asociar reglas a canchas    │──> Vincular reglas con canchas especificas
 └──────────────┬───────────────┘
                v
          Fin del proceso
```

---

## Resumen de modelos involucrados

| Modelo | Tabla | Rol en el flujo |
|---|---|---|
| **User** | `users` | Identidad global del usuario. Se crea en el registro. |
| **Business** | `businesses` | El negocio/complejo deportivo. Se crea en el paso 3. |
| **BusinessUser** | `business_users` | Vinculo usuario-negocio-rol. Se crea automaticamente con rol OWNER al crear el negocio. |

## Resumen de endpoints

| Paso | Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|---|
| 1 | POST | `/auth/register` | No | Crear cuenta de usuario |
| 2 | POST | `/auth/login` | No | Obtener token JWT |
| 3 | POST | `/businesses` | Si (Bearer) | Crear negocio + asignar OWNER |

## Reglas de negocio relacionadas

- **BR-013**: Los permisos se determinan por el rol en `BusinessUser`, no por el `globalRole` del usuario.
- **BR-014**: Un usuario puede tener diferentes roles en diferentes negocios.
- **BR-015**: Los roles son jerarquicos: OWNER > ADMIN > STAFF.
- **BR-017**: Los datos de cada negocio estan completamente aislados entre si.
