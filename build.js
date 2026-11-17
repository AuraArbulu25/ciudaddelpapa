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
const TEXTO_ENLACE = {
  whatsapp: 'Escribir por WhatsApp', mapa: 'Ver el mapa', web: 'Visitar la web', redes: 'Ver en redes sociales',
  documento: 'Ver el documento', formulario: 'Inscribirme', otro: 'Abrir enlace',
};
const isUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim());
const arr = (v) => (Array.isArray(v) ? v : []);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const fechaLarga = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

function enlacesDe(data, rel) {
  return arr(data.enlaces).map((l) => {
    const tipo = TEXTO_ENLACE[l.tipo] ? l.tipo : 'otro';
    let url = String(l.url || '').trim();
    // Para WhatsApp basta con escribir el número: se convierte en un enlace wa.me.
    if (tipo === 'whatsapp' && url && !isUrl(url)) {
      const digits = url.replace(/\D/g, '');
      url = digits.length >= 9 ? `https://wa.me/${digits.length === 9 ? '51' + digits : digits}` : '';
    }
    if (!url) return null;
    if (!isUrl(url)) { warnings.push(`${rel}: el enlace "${l.url}" no es una dirección web válida (debe empezar por https://).`); return null; }
    return { tipo, url, texto: String(l.texto || '').trim() || TEXTO_ENLACE[tipo] };
  }).filter(Boolean);
}

function metaDe(data, rel) {
  const m = data.meta || {};
  const objetivo = Number(m.objetivo), actual = Number(m.actual);
  if (!m.descripcion && !m.objetivo) return null;
  if (!(objetivo > 0) || !Number.isFinite(actual)) { warnings.push(`${rel}: la meta necesita un objetivo mayor que 0 y un avance numérico.`); return null; }
  return { descripcion: String(m.descripcion || ''), objetivo, actual };
}

function fotoSrc(img) {
  const v = String(img || '').trim();
  if (isUrl(v)) return v;
  if (/^\/?[\w\-./]+\.(jpe?g|png|webp|gif|avif)$/i.test(v) && !v.includes('..')) return v.replace(/^\//, '');
  return '';
}

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
    enlaces: enlacesDe(data, rel),
    meta: metaDe(data, rel),
    // Solo para la página de la iniciativa:
    _fotos: arr(data.fotos).map((f) => ({ src: fotoSrc(f.imagen), pie: String(f.pie || '') })).filter((f) => f.src),
    _avances: arr(data.avances).filter((x) => String(x.texto || '').trim())
      .map((x) => ({ fecha: isDate(x.fecha) ? x.fecha : '', texto: String(x.texto) }))
      .sort((x, y) => y.fecha.localeCompare(x.fecha)),
    _proxima: data.proxima && isDate(data.proxima.fecha) ? {
      fecha: data.proxima.fecha, hora: String(data.proxima.hora || ''), lugar: String(data.proxima.lugar || ''), detalle: String(data.proxima.detalle || ''),
    } : null,
    _mapa: isUrl(data.mapa_url) && /^https:/i.test(data.mapa_url) ? data.mapa_url.trim() : '',
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
const publicas = iniciativas.map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => !k.startsWith('_'))));
for (const [marker, value] of [['__INICIATIVAS__', publicas], ['__TEMAS__', temas], ['__DATOS__', datos]]) {
  if (!html.includes(marker)) throw new Error(`src/index.html no contiene el marcador ${marker}`);
  html = html.replace(marker, () => asJson(value));
}

fs.writeFileSync(htmlPath, html);

// --- Una página por iniciativa: public/iniciativas/<id>/index.html --------
const SITE = String(sitio.url_sitio || 'https://ciudaddelpapa.com').replace(/\/+$/, '');
const tplPath = path.join(OUT, 'iniciativa.html');
const tpl = fs.readFileSync(tplPath, 'utf8');
fs.rmSync(tplPath);
const UP = '../../';
const local = (src) => (isUrl(src) ? src : UP + src);
const absolute = (src) => (isUrl(src) ? src : `${SITE}/${src}`);

for (const i of iniciativas) {
  const url = `${SITE}/iniciativas/${i.id}/`;
  const estadoCls = i.estado === 'En marcha' ? ' on' : i.estado === 'En desarrollo' ? ' dev' : '';
  const parts = {
    og_imagen: i._fotos[0] ? `<meta property="og:image" content="${esc(absolute(i._fotos[0].src))}">` : '',
    etiquetas: `<span class="tag${estadoCls}">${esc(i.estado)}</span><span class="tag">${esc(i.tema)}</span>`
      + (i.ejemplo ? '<span class="tag ej">Ejemplo</span>' : ''),
    meta: i.meta ? `<div class="goal"><div class="goal-head"><span>Meta: ${esc(i.meta.objetivo.toLocaleString('es'))} ${esc(i.meta.descripcion)}</span>`
      + `<b>Llevamos ${esc(i.meta.actual.toLocaleString('es'))}</b></div><div class="goal-track" role="progressbar" aria-label="${esc(i.meta.descripcion)}" `
      + `aria-valuemin="0" aria-valuemax="${i.meta.objetivo}" aria-valuenow="${i.meta.actual}"><div class="goal-fill" style="width:${Math.max(0, Math.min(100, i.meta.actual / i.meta.objetivo * 100)).toFixed(1)}%"></div></div></div>` : '',
    enlaces: i.enlaces.length ? `<div class="links">${i.enlaces.map((l, k) =>
      `<a class="btn${k ? ' alt' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.texto)}</a>`).join('')}</div>` : '',
    mapa: i._mapa ? `<div><h2>Mapa</h2><iframe class="map" src="${esc(i._mapa)}" title="Mapa de ${esc(i.titulo)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : '',
    fotos: i._fotos.length ? `<div><h2>Fotos</h2><div class="gallery">${i._fotos.map((f) =>
      `<figure><img src="${esc(local(f.src))}" alt="${esc(f.pie || i.titulo)}" loading="lazy">${f.pie ? `<figcaption>${esc(f.pie)}</figcaption>` : ''}</figure>`).join('')}</div></div>` : '',
    avances: i._avances.length ? `<ol class="timeline">${i._avances.map((x) =>
      `<li>${x.fecha ? `<time datetime="${x.fecha}">${esc(fechaLarga(x.fecha))}</time>` : ''}<p>${esc(x.texto)}</p></li>`).join('')}</ol>`
      : '<p class="empty">Todavía no hay avances publicados.</p>',
    proxima: i._proxima ? `<div class="card next"><h2>Próxima actividad</h2><p class="when">${esc(fechaLarga(i._proxima.fecha))}${i._proxima.hora ? ` · <span style="white-space:nowrap">${esc(i._proxima.hora)}</span>` : ''}</p>`
      + (i._proxima.lugar ? `<p>${esc(i._proxima.lugar)}</p>` : '') + (i._proxima.detalle ? `<p>${esc(i._proxima.detalle)}</p>` : '') + '</div>' : '',
    necesita: i.necesita ? `<div class="card"><h2>Qué necesita</h2><p>${esc(i.necesita)}</p></div>` : '',
    sumarse: i.ejemplo
      ? `<p>Esta iniciativa es un ejemplo. Si quieres hacerla realidad, preséntala con tu nombre.</p><div><a class="btn alt" href="${UP}#presentar">Presentar esta iniciativa</a></div>`
      : '<p>Deja tus datos y los responsables te contactarán por correo o por teléfono.</p><div id="join-here"></div>',
  };
  const values = {
    titulo: i.titulo, resumen: i.resumen, tema: i.tema, estado: i.estado, impulsa: i.impulsa || '—', lugar: i.lugar || '—',
    url, aviso: sitio.aviso,
    compartir_whatsapp: `https://wa.me/?text=${encodeURIComponent(`${i.titulo} · Súmate en Ciudad del Papa: ${url}`)}`,
  };
  let page = tpl.replace(/\{\{\{(\w+)\}\}\}/g, (m, k) => {
    if (!(k in parts)) throw new Error(`src/iniciativa.html usa {{{${k}}}}, que build.js no conoce.`);
    return parts[k];
  }).replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in values)) throw new Error(`src/iniciativa.html usa {{${k}}}, que build.js no conoce.`);
    return esc(values[k]);
  });
  page = page.replace('__INI__', () => asJson({ id: i.id, titulo: i.titulo }));
  const dir = path.join(OUT, 'iniciativas', i.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page);
}

warnings.forEach((w) => console.warn(`Aviso: ${w}`));
console.log(`Sitio generado en public/ con ${iniciativas.length} iniciativas y ${temas.length} temas.`);
