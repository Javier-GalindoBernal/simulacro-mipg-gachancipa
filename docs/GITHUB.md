# Crear el repositorio y publicar en GitHub Pages

Requisitos: cuenta de GitHub y `git` instalado. Opcional: `gh` (GitHub CLI).

## 1. Crear el repositorio

**Con la interfaz web**

- [ ] github.com → **New repository** → nombre sugerido `simulacro-mipg-gachancipa`.
- [ ] Visibilidad: *Public* si usarás Pages gratis (ver «Privacidad» en el README).
- [ ] No marques «Add README» (ya viene uno).

**Con `gh`**

```bash
gh repo create simulacro-mipg-gachancipa --public --source=. --remote=origin
```

## 2. Subir los archivos

Descomprime el zip, entra a la carpeta y:

```bash
git init -b main
git add .
git commit -m "Simulacro MIPG V7: sitio, Code.gs, datos y pruebas"
git remote add origin https://github.com/TU-USUARIO/simulacro-mipg-gachancipa.git
git push -u origin main
```

(si creaste el repo con `gh … --source=.`, el remoto ya existe: solo `git push -u origin main`).

## 3. Activar Pages con GitHub Actions

- [ ] Repositorio → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- [ ] Pestaña **Actions**: el flujo «Probar y publicar en GitHub Pages» corre solo en cada `push` a `main`.
      Si las pruebas fallan, **no publica**.
- [ ] Al terminar, el sitio queda en `https://TU-USUARIO.github.io/simulacro-mipg-gachancipa/`.

## 4. Conectar la base de datos

Sigue `docs/CONEXION-GOOGLE.md`, edita `js/config.js`, y:

```bash
git add js/config.js
git commit -m "Conectar el simulacro con Google Sheets"
git push
```

## 5. Actualizar el plan más adelante

```bash
python3 tools/build_data.py RUTA/datos-cronograma.json RUTA/simulacro-furag.html
npm test
git add data && git commit -m "Actualizar datos del plan (corte AAAA-MM-DD)" && git push
```

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El sitio abre en blanco | Pages sigue en «Deploy from a branch»: cámbialo a **GitHub Actions**. |
| Falla el job «probar» | Un dato del plan rompió una prueba: lee el mensaje; `npm test` lo reproduce en local. |
| Estilos o scripts no cargan | El sitio se sirve desde `/nombre-repo/`; las rutas son relativas, no las cambies a `/css/…`. |
