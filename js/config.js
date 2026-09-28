/* ─────────────────────────────────────────────────────────────
   CONFIGURACIÓN — es el único archivo que tienes que editar.

   backend:
     "local"       Todo se guarda solo en el navegador de cada persona. No requiere nada más.
                   Sirve para probar y para capacitar; NO consolida entre dependencias.
     "appsscript"  Recomendado. Un Google Sheet como base de datos, vía un Apps Script
                   (carpeta apps-script/). Todos ven lo mismo. Ver docs/CONEXION-GOOGLE.md
     "form"        Alternativa sin código: un Google Form recibe cada registro y una hoja
                   publicada como CSV lo devuelve al panel. Ver docs/CONEXION-GOOGLE.md §B
   ───────────────────────────────────────────────────────────── */
window.SIM_CONFIG = {
  backend: "appsscript",

  // Opción "appsscript": URL de la implementación web (termina en /exec) y token compartido.
  // El token solo evita que cualquiera que encuentre la URL escriba por accidente;
  // como este sitio es público, NO es una medida de seguridad. No pongas datos sensibles.
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbwTIgi7rJX7S83y-xfnLfvFLdbnGNQmLmwWDAwEkyUrTtS5rZNpYn4ImpebRKdToCc/exec",
  token: "642885ad42ef47279a4f",

  // Opción "form": URL de envío del formulario (…/formResponse), campos entry.XXXX
  // y, para LEER, el CSV publicado de la hoja de respuestas.
  form: {
    actionUrl: "",   // https://docs.google.com/forms/d/e/<ID>/formResponse
    csvUrl: "",      // https://docs.google.com/spreadsheets/d/e/<ID>/pub?output=csv
    campos: {        // id de cada pregunta del formulario → "entry.123456789"
      tipo: "", codigo: "", dependencia: "", autor: "",
      url: "", tipo_enlace: "", descripcion: "", opciones_ok: "", id: "", fecha: ""
    }
  },

  refrescoSegundos: 45,
  entidad: "Alcaldía de Gachancipá"
};
