// Genera la carpeta public/ a partir de src/ y del contenido que se edita en el CMS:
//   content/sitio.json        textos de la página
//   content/temas/*.json      lista de temas
//   content/iniciativas/*.json una iniciativa por archivo
//   content/datos.json        cifras y gráficos sobre Chiclayo
// Solo pasan a la web los campos públicos: los contactos de los responsables nunca se publican.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');
const warnings = [];

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    throw new Error(`${rel} no se pudo leer como JSON: ${e.message}`);
  }
}

function readCollection(dir) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, rel: `${dir}/${f}`, data: readJson(`${dir}/${f}`) }));
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function list(value, key) {
  if (!Array.isArray(value)) {
    warnings.push(`content/sitio.json: "${key}" debería ser una lista.`);
    return [];
  }
  return value;
}

// --- Temas ---------------------------------------------------------------
const temaFiles = readCollection('content/temas')
  .filter(({ data }) => String(data.nombre || '').trim());
temaFiles.sort((a, b) => (Number(a.data.orden) || 999) - (Number(b.data.orden) || 999)
  || a.data.nombre.localeCompare(b.data.nombre, 'es'));
const temas = temaFiles.map(({ data }) => data.nombre.trim());

// El campo "tema" de una iniciativa guarda la ruta del archivo del tema (así lo escribe el CMS).
// También se acepta el nombre del tema o el nombre del archivo, por si se edita a mano.
function temaName(value, from) {
  const v = String(value || '').trim();
  const hit = temaFiles.find(({ rel, file, data }) =>
    v === rel || v === file || v === file.replace(/\.json$/, '') || v === data.nombre.trim());
  if (hit) return hit.data.nombre.trim();
  warnings.push(`${from}: el tema "${v}" no existe en content/temas. La iniciativa no aparecerá al filtrar por tema.`);
  return v;
}

// --- Iniciativas ---------------------------------------------------------
const iniciativas = readCollection('content/iniciativas')
  .filter(({ data }) => data.publicada !== false)
  .map(({ file, rel, data }) => ({
    id: file.replace(/\.json$/, ''),
    titulo: String(data.titulo || ''),
    tema: temaName(data.tema, rel),
    estado: String(data.estado || 'Idea'),
    resumen: String(data.resumen || ''),
    impulsa: String(data.impulsa || ''),
    lugar: String(data.lugar || ''),
    necesita: String(data.necesita || ''),
    ejemplo: data.ejemplo === true,
  }))
  .sort((a, b) => (a.ejemplo - b.ejemplo) || a.titulo.localeCompare(b.titulo, 'es'));

// --- Textos de la página -------------------------------------------------
const sitio = readJson('content/sitio.json');

const blocks = {
  razones: () => list(sitio.razones, 'razones')
    .map((x) => `<li><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></li>`).join('\n      '),
  para_quien: () => list(sitio.para_quien, 'para_quien')
    .map((x) => `<li><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></li>`).join('\n      '),
  pasos: () => list(sitio.pasos, 'pasos')
    .map((x) => `<li><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></li>`).join('\n      '),
  criterios: () => list(sitio.criterios, 'criterios')
    .map((x) => `<li>${esc(x)}</li>`).join('\n        '),
  preguntas: () => list(sitio.preguntas, 'preguntas')
    .map((x) => `<details><summary>${esc(x.pregunta)}</summary><p>${esc(x.respuesta)}</p></details>`).join('\n        '),
  // Párrafos separados por una línea en blanco.
  sobre_texto: () => String(sitio.sobre_texto || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n      '),
};

// --- Cifras y gráficos ---------------------------------------------------
const datosRaw = readJson('content/datos.json');
const datos = {
  cifras: (Array.isArray(datosRaw.cifras) ? datosRaw.cifras : []).map((c) => ({
    valor: String(c.valor || ''), etiqueta: String(c.etiqueta || ''),
    fuente: String(c.fuente || ''), fuente_url: /^https?:\/\//.test(c.fuente_url || '') ? c.fuente_url : '',
  })),
  graficos: (Array.isArray(datosRaw.graficos) ? datosRaw.graficos : []).map((g, i) => {
    const items = (Array.isArray(g.items) ? g.items : [])
      .map((it) => ({ etiqueta: String(it.etiqueta || ''), valor: Number(it.valor) }))
      .filter((it) => Number.isFinite(it.valor));
    if (!items.length) warnings.push(`content/datos.json: el gráfico ${i + 1} no tiene valores numéricos.`);
    if (!g.fuente) warnings.push(`content/datos.json: el gráfico "${g.titulo || i + 1}" no indica su fuente.`);
    return {
      titulo: String(g.titulo || ''), texto: String(g.texto || ''),
      tipo: g.tipo === 'partes' ? 'partes' : 'barras', unidad: String(g.unidad || ''),
      items, fuente: String(g.fuente || ''), fuente_url: /^https?:\/\//.test(g.fuente_url || '') ? g.fuente_url : '',
    };
  }),
};
datos.cifras.forEach((c, i) => { if (!c.fuente) warnings.push(`content/datos.json: la cifra ${i + 1} no indica su fuente.`); });

// --- Armado --------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });

const htmlPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(/\{\{\{(\w+)\}\}\}/g, (m, key) => {
  if (!blocks[key]) throw new Error(`src/index.html usa {{{${key}}}}, que build.js no conoce.`);
  return blocks[key]();
});
html = html.replace(/\{\{(\w+)\}\}/g, (m, key) => {
  if (sitio[key] == null || String(sitio[key]).trim() === '') warnings.push(`content/sitio.json: falta el texto "${key}".`);
  return esc(sitio[key]);
});

// "<" se escapa para que ningún texto pueda cerrar la etiqueta <script>.
const asJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
for (const [marker, value] of [['__INICIATIVAS__', iniciativas], ['__TEMAS__', temas], ['__DATOS__', datos]]) {
  if (!html.includes(marker)) throw new Error(`src/index.html no contiene el marcador ${marker}`);
  html = html.replace(marker, () => asJson(value));
}

fs.writeFileSync(htmlPath, html);

warnings.forEach((w) => console.warn(`Aviso: ${w}`));
console.log(`Sitio generado en public/ con ${iniciativas.length} iniciativas y ${temas.length} temas.`);
