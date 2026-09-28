# Simulacro MIPG · Gachancipá

Herramienta de **autoevaluación** del plan de mejoramiento MIPG V7 de la Alcaldía de Gachancipá.
Cada dependencia marca el checklist de sus preguntas FURAG con brecha y **registra el enlace de la evidencia**; el panel consolida avance por dimensión, política y dependencia.

- Sitio estático (HTML + JS sin dependencias): se publica en **GitHub Pages**.
- Los enlaces de evidencia y el avance se guardan en un **Google Sheet** (vía Apps Script) o en un **Google Form**.
- Sin conexión configurada funciona igual, guardando en el navegador de cada persona (modo local).

> **Alcance.** El simulacro no acredita cumplimiento ni sustituye el reporte FURAG. Las evidencias las valida la Oficina de Control Interno.

---

## Contenido del repositorio

| Ruta | Qué es |
|---|---|
| `index.html` | Aplicación (una sola página, cinco vistas por `#/ruta`) |
| `css/styles.css` | Diseño: tema claro/oscuro, adaptable a móvil |
| `js/config.js` | **Único archivo que se edita** para conectar la base de datos |
| `js/core.js` `ui.js` `views.js` `app.js` | Lógica, componentes visuales, vistas y arranque |
| `data/simulacro.data.js` | Datos del plan (244 acciones, 20 políticas, 19 hitos). Generado, no se edita a mano |
| `apps-script/Code.gs` | Servidor de evidencias sobre Google Sheets |
| `tools/build_data.py` | Regenera `data/` desde las fuentes del vault |
| `tests/` | Pruebas de datos y de la lógica de `Code.gs`, y servidor simulado |
| `docs/` | GitHub, conexión con Google y modelo de datos |
| `.github/workflows/pages.yml` | Prueba y publica en cada `push` a `main` |

---

## Puesta en marcha (checklist)

- [ ] **1. Repositorio.** Sigue `docs/GITHUB.md` (crear repo, subir archivos, activar Pages).
- [ ] **2. Base de datos.** Sigue `docs/CONEXION-GOOGLE.md`: opción A (Apps Script + Sheet, recomendada) u opción B (Google Form).
- [ ] **3. Configuración.** Edita `js/config.js` con la URL y el token; `git push`.
- [ ] **4. Prueba.** Abre el sitio, identifícate, marca una opción y registra un enlace; revisa que aparezca en la hoja.
- [ ] **5. Comunica.** Envía a cada dependencia el enlace del sitio y la sección «Ayuda».

## Probar en local

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. También funciona abriendo `index.html` con doble clic (los datos van en un `.js` clásico, no en un `fetch`).

Para ver el panel en otra fecha: `…/index.html?hoy=2026-11-20`.

## Pruebas

```bash
npm test                       # datos + lógica de Code.gs (Node 18+, sin dependencias)
node tests/mock-server.js      # sitio + servidor simulado en http://localhost:8766
node tests/mock-server.js 8767 form   # ídem, simulando el modo Google Form
```

`tests/mock-server.js` ejecuta el `Code.gs` real sobre servicios simulados de Apps Script. Prueba la lógica (validaciones, idempotencia, orden), **no** la plataforma de Google.

## Actualizar los datos del plan

Los datos salen de dos fuentes del vault MIPG (ver docstring de `tools/build_data.py`):

```bash
python3 tools/build_data.py RUTA/datos-cronograma.json RUTA/simulacro-furag-2026-09-09.html
npm test
```

El script se detiene si los códigos de las dos fuentes no coinciden. `data/simulacro.data.js` guarda la huella SHA-256 de cada fuente en `meta.fuentes`.

---

## Cómo se calcula el avance

- Cada acción trae las opciones del formulario FURAG que **aún no están acreditadas** (las ya acreditadas salen bloqueadas).
- **Avance de la acción** = (opciones marcadas + 1 si hay al menos un enlace de evidencia) ÷ (opciones pendientes + 1).
- **Acción completa** = 100 %: todas las pendientes marcadas **y** al menos un enlace.
- El indicador general y los de dimensión/dependencia usan las acciones **firmes** (199). Las **condicionadas** (45) no pesan hasta que su pregunta habilitante las active; se listan aparte.
- Vencida = fecha límite pasada y acción no completa. Próxima = vence en 14 días o menos.

## Permisos dentro de la aplicación

Quien se identifica con una dependencia solo puede marcar y registrar en **sus** acciones; ve las demás en lectura. «Coordinación MIPG» edita todas.
**Es una convención de uso, no seguridad**: no hay inicio de sesión y cualquiera puede elegir cualquier dependencia.

## Límites que conviene tener claros

| Tema | Realidad |
|---|---|
| Privacidad | GitHub Pages es público (en cuentas gratuitas, el repositorio también). No registres enlaces con datos personales o reservados. |
| Token | Está en `js/config.js`, visible para quien abra el sitio. Evita escrituras accidentales; **no** es autenticación. |
| Control real | Si se requiere, publica el sitio en una intranet y restringe la implementación de Apps Script a la organización. |
| Enlaces | El sitio guarda el enlace, no el archivo. Un enlace de Drive debe estar compartido con quien lo revisa; nada verifica que el enlace abra. |
| Cuotas | Apps Script limita ejecuciones diarias por cuenta; para 4 dependencias y 244 acciones sobra con margen. |
| Modo Form | Sin validación en servidor y con retraso de lectura (~5 min) por la publicación del CSV. Ver `docs/CONEXION-GOOGLE.md`. |
| Verificación | El modo Apps Script y el modo Form **no se han probado contra Google** en esta entrega; sí contra un servidor simulado. Haz la prueba de humo del paso 4. |
