# Modelo de datos

## Hojas del Sheet (modo Apps Script)

**Estado** — una fila por acción con algo marcado (se actualiza en el lugar)

| Columna | Contenido |
|---|---|
| `codigo` | Código de la pregunta (`GCI205`, `EMI03`…) |
| `opciones_ok` | JSON con los índices de las opciones marcadas, p. ej. `[0,2,3]` |
| `avance` | 0–1 (referencia; el panel recalcula) |
| `dependencia`, `autor` | Quién hizo el último cambio |
| `actualizado` | ISO-8601 UTC. Gana el más reciente; una cola antigua no pisa un dato nuevo |

**Evidencias** — una fila por enlace (no se borra: se retira)

| Columna | Contenido |
|---|---|
| `id` | Identificador generado en el navegador (idempotencia) |
| `fecha` | ISO-8601 UTC |
| `codigo` | Acción a la que pertenece |
| `dependencia`, `autor` | Quién la registró |
| `tipo` | `Drive` · `SharePoint/OneDrive` · `PDF` · `Sitio web` · `Otro` |
| `url` | `https://…`, máx. 500 caracteres |
| `descripcion` | Qué demuestra el enlace, 8–300 caracteres |
| `activa` | `true` / `false` (retirada) |

**Bitácora** — una fila por escritura aceptada (`recibido`, `accion`, `codigo`, `autor`, `dependencia`, `detalle`).

## Eventos cliente → servidor

```jsonc
{ "accion": "estado",    "codigo": "GCI205", "ok": [0,2], "avance": 0.4, "actualizado": "…Z", "dependencia": "…", "autor": "…" }
{ "accion": "evidencia", "id": "…", "codigo": "GCI205", "url": "https://…", "tipo": "Drive", "descripcion": "…", "fecha": "…Z", "dependencia": "…", "autor": "…" }
{ "accion": "retirar",   "id": "…" }
```

Respuesta: `{ "ok": true }` · `{ "ok": true, "ignorado": true }` (duplicado o dato más antiguo) · `{ "ok": false, "permanente": true, "error": "…" }` (contenido inválido: se descarta de la cola) · `{ "ok": false, "error": "…" }` (transitorio: se reintenta).

Lectura: `GET …/exec?accion=estado&token=…` → `{ ok, servidor, estados[], evidencias[] }`.

## Datos del plan (`data/simulacro.data.js`)

`window.SIMULACRO_DATA = { meta, politicas[], hitos[], acciones[] }`

Acción: `id`, `politica` (código o `null` en transversales), `dimension`, `dependencia`, `inicio`, `fin`, `prioridad` (1 Crítica · 2 Alta · 3 Media · 4 Baja · 5 Condicionada), `pregunta`, `pagina`, `situacion`, `accion`, `entregable`, `evidencia`, `opciones` (`[texto, 1|0]`: `1` = ya acreditada en el reporte oficial), y `condicionada_a` si aplica.

Fechas y líderes son los del **plan V7 reanclado al 28-sep-2026**. El contenido del formulario (páginas, situación, opciones) viene del simulacro anterior; `build_data.py` exige que los códigos de ambas fuentes coincidan exactamente.
