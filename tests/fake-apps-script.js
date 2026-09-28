/* Entorno mínimo que imita los servicios de Apps Script que usa apps-script/Code.gs.
   Sirve para probar la LÓGICA del servidor (validaciones, idempotencia, orden) sin Google.
   NO prueba la plataforma real (permisos, cuotas, redirecciones de /exec). */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.filas = []; this.max = 1000; this.formato = null; this.congeladas = 0; }
  getMaxRows() { return this.max; }
  getLastRow() { return this.filas.length; }
  setFrozenRows(n) { this.congeladas = n; }
  appendRow(v) { this.filas.push(v.slice()); }
  getRange(r, c, nr, nc) {
    const s = this; nr = nr || 1; nc = nc || 1;
    const api = {
      setValues(vals) { for (let i = 0; i < nr; i++) { const fila = (s.filas[r - 1 + i] = s.filas[r - 1 + i] || []); for (let j = 0; j < nc; j++) fila[c - 1 + j] = vals[i][j]; } return api; },
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const fila = s.filas[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(fila[c - 1 + j] === undefined ? '' : fila[c - 1 + j]); o.push(x); } return o; },
      setValue(v) { return api.setValues([[v]]); },
      getValue() { return api.getValues()[0][0]; },
      setFontWeight() { return api; },
      setNumberFormat(f) { s.formato = f; return api; }
    };
    return api;
  }
}

function crear(opts) {
  opts = opts || {};
  const hojas = new Map();
  const props = { TOKEN: opts.token === undefined ? 'tok-de-prueba' : opts.token };
  const libro = {
    getSheetByName: n => hojas.get(n) || null,
    insertSheet: n => { const h = new Hoja(n); hojas.set(n, h); return h; }
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libro, openById: () => libro },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ texto: t, setMimeType() { return this; } }) },
    Utilities: { getUuid: () => '12345678-1234-1234-1234-123456789012' },
    Logger: { log() {} },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx);
  const salida = o => JSON.parse(o.texto);
  return {
    hojas, props, libro,
    get: parametros => salida(ctx.doGet({ parameter: parametros })),
    post: cuerpo => salida(ctx.doPost({ postData: { contents: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } })),
    configurar: () => ctx.configurar()
  };
}
module.exports = { crear };
