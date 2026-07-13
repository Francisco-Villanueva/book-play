# PM System — Book & Play

Sistema de seguimiento autónomo del proyecto para un solo desarrollador.
Un agente PM ("Project Manager") mantiene el estado al día y emite un reporte
semanal, **sin intervención manual**.

## Piezas

| Archivo | Rol |
|---|---|
| `pm/BACKLOG.md` | **Fuente de verdad**: tareas en progreso, por hacer, futuras y hechas. |
| `pm/reports/YYYY-MM-DD.md` | Reporte de estado semanal (uno por lunes). |
| `.claude/commands/pm-report.md` | El flujo que ejecuta el PM (invocable con `/pm-report`). |

## Cómo corre solo

Una **rutina programada en la nube** ejecuta `/pm-report` todos los **lunes a las
14:00 (hora Argentina, UTC-3)**. La rutina:

1. Lee `pm/BACKLOG.md` (estado actual).
2. Escanea los commits de git desde el último reporte para detectar avances.
3. Revisa los docs de auditoría del repo (`BACKEND_AUDIT.md`, `MERCADOPAGO_BILLING_AUDIT.md`, etc.) por ítems abiertos nuevos.
4. **Actualiza `BACKLOG.md`**: mueve a Hecho lo terminado, agrega tareas nuevas inferidas, re-prioriza.
5. Genera `pm/reports/<fecha-lunes>.md`.
6. Commitea los cambios en una rama y (si el conector de Gmail está autorizado) envía el reporte por email.

> **Alcance:** la rutina en la nube solo ve el repo `back-end/` (la raíz y `front-end/`
> no están versionadas). Las tareas de frontend/producto ya están sembradas en el
> backlog y se siguen a mano o vía este repo; el escaneo automático de avances usa
> los commits del backend.

## Uso manual

Podés disparar el flujo cuando quieras, sin esperar al lunes:

```
/pm-report
```

Y editar `pm/BACKLOG.md` a mano en cualquier momento: agregá tareas bajo
`## 📋 Por hacer` y el PM las recoge en el próximo ciclo.

## Email

La entrega por email requiere autorizar el **conector de Gmail** en claude.ai
(Ajustes → Conectores). Hasta entonces, el reporte queda garantizado como
archivo en `pm/reports/`.
