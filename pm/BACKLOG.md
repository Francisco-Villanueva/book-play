# Book & Play — Backlog (fuente de verdad del PM)

> Este archivo es **la única fuente de verdad** de las tareas del proyecto.
> Lo mantiene actualizado el agente PM (ver `pm/README.md`), pero podés editarlo
> a mano cuando quieras: agregá tareas en `## 📋 Por hacer` y el PM las recoge.
>
> **Formato de tarea:** `- [ ] [ID] (Prioridad · Área) Título — nota corta` · `(ref: archivo)`
> **Áreas:** `BE` backend · `FE` frontend · `MP` MercadoPago/billing · `INFRA` · `PROD` producto
> **Prioridad:** 🔴 Crítica · 🟠 Alta · 🟡 Media · ⚪ Baja
> **Última actualización:** 2026-07-13 (seed + reconciliación contra código real)

---

## 🚧 En progreso

- [ ] [MP-01] (🔴 · MP) La pantalla de confirmación post-pago no refleja el estado real de la suscripción — `ref: MERCADOPAGO_BILLING_AUDIT.md §1`
- [ ] [MP-02] (🟠 · MP) `reactivateSubscription` (frontend) espera un contrato que el backend ya no devuelve — `ref: MERCADOPAGO_BILLING_AUDIT.md §2`
- [ ] [MP-03] (🟠 · MP) Sin idempotencia: se pueden generar múltiples preferencias de pago activas para la misma suscripción (usar `X-Idempotency-Key` + deshabilitar botón con pago PENDING) — `ref: MERCADOPAGO_BILLING_AUDIT.md §3`

---

## 📋 Por hacer

### 🟠 Alta

- [ ] [BE-01] (🟠 · PROD/BE) Player business discovery — decidir Opción A (endpoint público `GET /businesses/discover` + rutas con `businessId`) vs Opción B (estandarizar flujo público). **Bloquea un flujo core.** — `ref: MISSING_BACKEND_ENDPOINTS.md §1`
- [ ] [INFRA-02] (🟠 · INFRA) Reemplazar `sync({ alter: true })` por migraciones reales — **riesgo en producción** (verificado vigente: `database.config.ts:13` + `database.provider.ts:132`) — `ref: BACKEND_AUDIT.md Estado general`
- [ ] [DOC-01] (🟠 · DOC) Actualizar auditorías desactualizadas: `BACKEND_AUDIT.md` (parcial) y `FRONTEND_AUDIT.md` (muy stale) declaran como faltantes cosas ya implementadas. `MISSING_BACKEND_ENDPOINTS.md` y `MERCADOPAGO_BILLING_AUDIT.md` están al día — `ref: reconciliación 2026-07-13`

### 🟡 Media

- [ ] [BE-02] (🟡 · BE) Master: feature flags por negocio — `GET/PATCH /master/businesses/:id/features`. Requiere sign-off de producto sobre la lista de `featureKey` — `ref: MISSING_BACKEND_ENDPOINTS.md §5`
- [ ] [BE-03] (🟡 · BE) Master: audit logs — entidad `AuditLog` + `GET /master/audit-logs` + instrumentación de escritura en acciones sensibles — `ref: MISSING_BACKEND_ENDPOINTS.md §6`
- [ ] [BE-04] (🟡 · BE) Gaps de modelo: `Court.slotDuration`, `ExceptionRule.name`, declarar `User.businessUsers` — `ref: BACKEND_AUDIT.md §1.4, §1.8, §1.1`
- [ ] [FE-02] (🟡 · FE) Verificar contrato de login: el body envía `{ username, password }` — confirmar qué espera `LocalStrategy` (¿username o email?) — `ref: FRONTEND_AUDIT.md auth-06`

### ⚪ Baja

- [ ] [BE-05] (⚪ · BE) Player preferences & favorites — `GET/PATCH /users/me/preferences`, favoritos (nueva entidad `FavoriteBusiness`) — `ref: MISSING_BACKEND_ENDPOINTS.md §3`
- [ ] [BE-06] (⚪ · BE) Master: platform config — `platform-config`, team interno, integraciones. Necesita scoping de producto — `ref: MISSING_BACKEND_ENDPOINTS.md §8`

---

## 🔮 Futuro / Fuera de alcance actual

- [ ] [FUT-01] (⚪ · PROD) Módulo de Torneos — sin entidades ni scoping. Pantalla marcada "Pronto" — `ref: MISSING_BACKEND_ENDPOINTS.md §9`

---

## ✅ Hecho (histórico reciente)

> El PM mueve acá las tareas completadas y las que detecta terminadas en los commits.
> Mantener solo ~15 más recientes; archivar el resto si crece.

- [x] `HttpExceptionFilter` global implementado — `all-exceptions.filter.ts` existe (verificar que esté registrado global) — _reconciliación 2026-07-13; BACKEND_AUDIT §2.3 estaba stale_
- [x] Frontend: módulos API + query keys existen para auth, bookings, courts, businesses, billing, plans, master, availability y exception rules (`*Api.ts` + `*Keys.ts`) — _reconciliación 2026-07-13; FRONTEND_AUDIT api-02/api-03 estaban stale_
- [x] Modelo `BusinessFeature` implementado (`subscriptions/entities/business-feature.model.ts`) — _BACKEND_AUDIT §1.11 estaba stale_
- [x] Billing & Subscriptions con MercadoPago: modelos `Plan/Subscription/BusinessFeature/Payment`, `MercadoPagoService`, endpoints checkout/cancel/reactivate + webhook firmado + cron de expiración de trial — `ref: MISSING_BACKEND_ENDPOINTS.md §4` — _2026-07 (commits MP)_
- [x] Master: payments / MRR / catálogo de planes (`/master/plans`, `/master/metrics/mrr`, `/master/transactions`) — `ref: MISSING_BACKEND_ENDPOINTS.md §7`
- [x] `GET /users/me/bookings` (Mis turnos) — `ref: MISSING_BACKEND_ENDPOINTS.md §2`
- [x] Endpoints públicos de bookings — _git: "Feat: add public endpoints for bookings"_
- [x] Swagger (@nestjs/swagger) — _git: "Feat: Implement swagger"_
- [x] Availability & exception rules — _git: "fix: availabilty and expection rules"_
- [x] Módulo BusinessUser + `me` auth — _git: "BusinessUser module & me auth"_
- [x] Creación de business & courts — _git: "Feat: creation of business & courts"_
