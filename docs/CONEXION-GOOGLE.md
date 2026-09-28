# Conectar el simulacro con Google

Dos caminos. **Elige uno** y déjalo declarado en `js/config.js` (`backend`).

| | A. Apps Script + Sheet | B. Google Form |
|---|---|---|
| Recomendado | **Sí** | Solo si no puedes usar Apps Script |
| Validación en servidor | Sí (https, longitudes, códigos, tipos) | No: solo la del navegador |
| Lectura entre dependencias | Inmediata (refresco cada 45 s) | Retraso de ~5 min (CSV publicado) |
| Evita duplicados | Sí (por `id`) | No: se filtra al leer |
| Bitácora | Hoja «Bitácora» | Cada fila del Form |
| Código que mantener | `Code.gs` | Ninguno |

---

## A. Apps Script + Google Sheet

### 1. La hoja y el script

- [ ] Crea una hoja de cálculo en Drive, por ejemplo «Simulacro MIPG — evidencias». Mejor con la **cuenta institucional**.
- [ ] **Extensiones → Apps Script** → borra el contenido y pega `apps-script/Code.gs` → guarda.
- [ ] En el editor, elige la función **`configurar`** y pulsa **Ejecutar**. Acepta los permisos (Hojas de cálculo y almacenamiento de propiedades).
- [ ] **Ver → Registros** (o «Registro de ejecución»): copia el **token** que imprimió.
      Crea las hojas `Estado`, `Evidencias` y `Bitácora`, y guarda el token en *Propiedades del script*.

### 2. Publicarlo como aplicación web

- [ ] **Implementar → Nueva implementación → Tipo: Aplicación web**.
  - Ejecutar como: **Yo**
  - Quién tiene acceso: **Cualquier persona** (el sitio público no puede iniciar sesión de Google por el usuario)
- [ ] Copia la **URL de la aplicación web** (termina en `/exec`).
- [ ] Cada cambio posterior a `Code.gs` exige **Implementar → Administrar implementaciones → Editar → Nueva versión**; si no, la URL sigue sirviendo el código anterior.

### 3. Configurar el sitio

En `js/config.js`:

```js
backend: "appsscript",
appsScriptUrl: "https://script.google.com/macros/s/XXXXXXXX/exec",
token: "el-token-del-registro",
```

Haz `git push` (ver `docs/GITHUB.md`).

### 4. Prueba de humo (no omitir)

- [ ] Abre el sitio → **Ayuda → Probar conexión**: debe decir «Conectado…».
- [ ] Identifícate, marca una opción, registra un enlace.
- [ ] En la hoja `Evidencias` aparece la fila; en `Estado`, el avance; en `Bitácora`, ambos registros.
- [ ] Abre el sitio en otro navegador (o ventana privada), identifícate con otra dependencia: ves lo registrado en solo lectura.
- [ ] Desconecta la red, marca algo, reconecta: la píldora pasa de «por enviar» a «Sincronizado».

### Notas técnicas (por qué está hecho así)

- El navegador envía `POST` con `Content-Type: text/plain` para **evitar el preflight CORS**, que Apps Script no atiende. No lo cambies a `application/json`.
- `Code.gs` toma un **candado** (`LockService`) en cada escritura: dos dependencias guardando a la vez no se pisan.
- Las hojas se crean con formato **texto plano**: un valor que empiece por `=` no se evalúa como fórmula.
- Las evidencias **no se borran**: «retirar» pone `activa = false`. Queda trazabilidad para Control Interno.
- Un registro que el servidor rechaza por su contenido se descarta de la cola y se avisa; uno que falla por red se reintenta.

### Seguridad

El token está en `js/config.js`, es decir, **público**. Solo evita escrituras accidentales. Si necesitas control real:

- Publica el sitio en una intranet y pon la implementación en «Cualquier usuario de tu organización».
- O migra a una base con autenticación (Firebase, Supabase) — el contrato de `js/core.js` (`B.appsscript`) es pequeño para adaptar.

---

## B. Google Form (sin código)

Cada registro se envía como una respuesta de formulario; una hoja publicada como CSV devuelve los datos al panel.

### 1. El formulario

Crea un Google Form con **estas preguntas, con estos títulos exactos** (el CSV se lee por título) y todas de «Respuesta corta» salvo la marcada:

| Título | Tipo | Obligatoria |
|---|---|---|
| Tipo de registro | Respuesta corta | Sí |
| Código | Respuesta corta | Sí |
| Dependencia | Respuesta corta | No |
| Autor | Respuesta corta | No |
| Enlace | Respuesta corta | No |
| Tipo de enlace | Respuesta corta | No |
| Descripción | **Párrafo** | No |
| Opciones cumplidas | Respuesta corta | No |
| ID | Respuesta corta | No |
| Fecha ISO | Respuesta corta | Sí |

Ajustes: desactiva «Limitar a 1 respuesta» y «Recopilar correos».

### 2. Los identificadores `entry.XXXX`

- [ ] Menú ⋮ → **Obtener enlace prellenado** → rellena cada pregunta con un valor de ejemplo → **Obtener enlace** → copiar.
- [ ] En el enlace verás `entry.123456789=Ejemplo`. Anota qué `entry.` corresponde a cada pregunta.
- [ ] La URL de envío es la del formulario cambiando `/viewform…` por **`/formResponse`**.

### 3. Publicar la hoja de respuestas como CSV

- [ ] En el Form → **Respuestas → Vincular con Hojas de cálculo**.
- [ ] En la hoja: **Archivo → Compartir → Publicar en la Web** → hoja «Respuestas de formulario 1» → formato **CSV** → Publicar → copiar el enlace.

### 4. Configurar el sitio

```js
backend: "form",
form: {
  actionUrl: "https://docs.google.com/forms/d/e/XXXX/formResponse",
  csvUrl: "https://docs.google.com/spreadsheets/d/e/YYYY/pub?gid=0&single=true&output=csv",
  campos: {
    tipo: "entry.111", codigo: "entry.222", dependencia: "entry.333", autor: "entry.444",
    url: "entry.555", tipo_enlace: "entry.666", descripcion: "entry.777",
    opciones_ok: "entry.888", id: "entry.999", fecha: "entry.000"
  }
},
```

### Límites del modo Form

- **Sin validación en servidor**: cualquiera con la URL del Form puede mandar filas. Un CSV con filas mal formadas se ignora al leer, pero no se rechaza.
- Google publica el CSV con **retraso** (hasta unos 5 minutos): lo que registra una dependencia tarda en verlo otra. El navegador que registra lo ve al instante (queda en su copia local).
- La hoja acumula **una fila por cada marca** del checklist; el panel toma la más reciente por acción. Crece más rápido que en la opción A.
- Google Forms responde sin cabeceras CORS: el navegador **no puede confirmar** que el envío llegó (se da por enviado si no hubo error de red). Verifica en la hoja.

---

## Datos que llegan a la hoja

Ver `docs/MODELO-DE-DATOS.md`. Para Control Interno: la hoja `Evidencias` es exportable a Excel/CSV; el botón **Exportar CSV** de la vista Evidencias hace lo mismo desde el sitio.
