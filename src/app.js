// Comportamiento del sitio. Se usa en la portada y en las páginas de cada iniciativa:
// cada parte solo se activa si su sección existe en la página.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function readJson(id) { var n = $(id); if (!n) return null; try { return JSON.parse(n.textContent); } catch (e) { return null; } }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var ROOT = document.body.getAttribute('data-root') || '';

  function send(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || ''); return j; }); });
  }

  // ---- Formulario para sumarse a una iniciativa -------------------------
  function joinForm(i, n) {
    var f = el('form', 'join'); f.noValidate = true;
    f.innerHTML =
      '<div class="field"><label for="j-nombre-' + n + '">Tu nombre</label><input id="j-nombre-' + n + '" name="nombre" autocomplete="name"></div>' +
      '<div class="field"><label for="j-correo-' + n + '">Correo</label><input id="j-correo-' + n + '" name="correo" type="email" autocomplete="email"></div>' +
      '<div class="field"><label for="j-tel-' + n + '">Teléfono o WhatsApp</label><input id="j-tel-' + n + '" name="tel" type="tel" autocomplete="tel"></div>' +
      '<div class="field"><label for="j-distrito-' + n + '">Distrito o ciudad donde vives</label><input id="j-distrito-' + n + '" name="distrito"></div>' +
      '<div class="field full"><label for="j-ayuda-' + n + '">¿Cómo te gustaría ayudar? (opcional)</label><textarea id="j-ayuda-' + n + '" name="ayuda"></textarea></div>' +
      '<div class="full check"><input type="checkbox" id="j-ok-' + n + '" name="ok"><label for="j-ok-' + n + '">Acepto que mis datos se envíen a los responsables de esta iniciativa, solo para que me contacten.</label></div>' +
      '<div class="hp" aria-hidden="true"><label for="j-web-' + n + '">No completar</label><input id="j-web-' + n + '" name="web" tabindex="-1" autocomplete="off"></div>' +
      '<div class="full"><button class="btn small" type="submit">Sumarme</button></div>' +
      '<div class="out" hidden><strong></strong><pre></pre></div>';
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(f), err = [], out = f.querySelector('.out');
      var correo = (d.get('correo') || '').trim(), tel = (d.get('tel') || '').trim();
      if (!(d.get('nombre') || '').trim()) err.push('· Escribe tu nombre.');
      if (!correo && !tel) err.push('· Deja un correo o un teléfono para que puedan contactarte.');
      if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) err.push('· Revisa el correo: parece incompleto.');
      if (!d.get('ok')) err.push('· Marca la casilla de autorización para enviar tus datos.');
      var strong = out.querySelector('strong'), pre = out.querySelector('pre'), btn = f.querySelector('button');
      out.hidden = false;
      if (err.length) { strong.textContent = 'Falta completar'; pre.textContent = err.join('\n'); return; }
      strong.textContent = 'Enviando…'; pre.textContent = ''; btn.disabled = true;
      send('/api/sumarme', { iniciativa: i.id, nombre: d.get('nombre'), correo: correo, telefono: tel, distrito: d.get('distrito'), ayuda: d.get('ayuda'), acepta: true, web: d.get('web') })
        .then(function () { strong.textContent = 'Solicitud enviada'; pre.textContent = 'Los responsables de «' + i.titulo + '» recibieron tus datos y te contactarán.' + (correo ? '\nTe enviamos una copia a ' + correo + '.' : ''); f.reset(); })
        .catch(function (e) { strong.textContent = 'No pudimos enviar tu solicitud'; pre.textContent = e.message || 'Inténtalo de nuevo en unos minutos.'; })
        .then(function () { btn.disabled = false; });
    });
    return f;
  }

  function progress(meta) {
    if (!meta) return null;
    var pct = Math.max(0, Math.min(100, meta.actual / meta.objetivo * 100));
    var box = el('div', 'goal');
    var head = el('div', 'goal-head');
    head.appendChild(el('span', null, 'Meta: ' + meta.objetivo.toLocaleString('es') + ' ' + meta.descripcion));
    head.appendChild(el('b', null, 'Llevamos ' + meta.actual.toLocaleString('es')));
    var track = el('div', 'goal-track'); track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(meta.objetivo)); track.setAttribute('aria-valuenow', String(meta.actual));
    track.setAttribute('aria-label', meta.descripcion);
    var fill = el('div', 'goal-fill'); fill.style.width = pct.toFixed(1) + '%'; track.appendChild(fill);
    box.appendChild(head); box.appendChild(track);
    return box;
  }

  function linkButtons(enlaces, max) {
    var wrap = el('div', 'links');
    (enlaces || []).slice(0, max || 99).forEach(function (l, k) {
      var a = el('a', 'btn small' + (k ? ' alt' : ''), l.texto); a.href = l.url; a.rel = 'noopener'; a.target = '_blank';
      wrap.appendChild(a);
    });
    return wrap.children.length ? wrap : null;
  }

  // ---- Portada: iniciativas en tarjetas ---------------------------------
  var items = readJson('data');
  if (items && $('list')) {
    var temas = readJson('temas') || [];
    var estados = ['Idea', 'En desarrollo', 'En marcha'];
    var LIMIT = 6, showAll = false;
    var list = $('list'), count = $('count'), q = $('q'), sTema = $('s-tema'), sEstado = $('s-estado'), fTema = $('f-tema');
    var chips = $('chips'), more = $('show-all');
    var fill = function (sel, first, opts) { if (first) sel.appendChild(el('option', null, first)).value = ''; opts.forEach(function (o) { sel.appendChild(el('option', null, o)); }); };
    fill(sTema, 'Todos los temas', temas); fill(sEstado, 'Todos los estados', estados);
    if (fTema) fill(fTema, null, temas.concat(['Otro']));
    var fact = function (dl, k, v) { var d = el('div'); d.appendChild(el('dt', null, k + ':')); d.appendChild(el('dd', null, v)); dl.appendChild(d); };
    var reales = items.filter(function (i) { return !i.ejemplo; });

    // Cifra corta bajo la portada
    var hc = $('hero-count');
    // Se muestra cuando ya hay al menos 3 iniciativas reales; con menos, la cifra no ayuda.
    if (hc && reales.length >= 3) {
      var lugares = {}; reales.forEach(function (i) { if (i.lugar) lugares[i.lugar] = 1; });
      var activas = reales.filter(function (i) { return i.estado !== 'Idea'; }).length;
      hc.textContent = reales.length + (reales.length === 1 ? ' iniciativa publicada' : ' iniciativas publicadas') +
        (activas ? ' · ' + activas + ' en desarrollo o en marcha' : '') +
        ' · ' + Object.keys(lugares).length + (Object.keys(lugares).length === 1 ? ' lugar' : ' lugares');
    }

    // Chips de tema: solo los temas que tienen iniciativas
    var usados = temas.filter(function (t) { return items.some(function (i) { return i.tema === t; }); });
    var chip = function (label, value) {
      var b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', value === sTema.value ? 'true' : 'false');
      b.addEventListener('click', function () { sTema.value = value; showAll = false; render(); });
      chips.appendChild(b); b._v = value;
    };
    if (chips) { chip('Todas', ''); usados.forEach(function (t) { chip(t, t); }); }

    var card = function (i) {
      var href = ROOT + 'iniciativas/' + i.id + '/';
      var li = el('li', 'card-ini' + (i.destacada ? ' featured' : '') + (i.ejemplo ? ' is-ej' : '')), tags = el('div', 'tags');
      if (i.destacada) tags.appendChild(el('span', 'tag hl', 'Destacada'));
      tags.appendChild(el('span', 'tag' + (i.estado === 'En marcha' ? ' on' : i.estado === 'En desarrollo' ? ' dev' : ''), i.estado));
      tags.appendChild(el('span', 'tag', i.tema));
      if (i.ejemplo) tags.appendChild(el('span', 'tag ej', 'Ejemplo'));
      li.appendChild(tags);
      var h = el('h3'), a = el('a', null, i.titulo); a.href = href; h.appendChild(a); li.appendChild(h);
      li.appendChild(el('p', 'sum', i.resumen));
      var dl = el('dl', 'facts'); if (i.impulsa) fact(dl, 'Impulsa', i.impulsa); if (i.lugar) fact(dl, 'Dónde', i.lugar); li.appendChild(dl);
      var g = progress(i.meta); if (g) li.appendChild(g);
      var row = el('div', 'item-actions');
      if (i.ejemplo) {
        var p = el('a', 'btn alt small', 'Hacerla realidad'); p.href = '#presentar'; row.appendChild(p);
      } else {
        var j = el('a', 'btn small', 'Sumarme'); j.href = href + '#sumarme'; row.appendChild(j);
        (i.enlaces || []).slice(0, i.destacada ? 2 : 1).forEach(function (l) {
          var b = el('a', 'btn alt small', l.texto); b.href = l.url; b.rel = 'noopener'; b.target = '_blank'; row.appendChild(b);
        });
      }
      var m = el('a', 'more-link', 'Ver más'); m.href = href; m.setAttribute('aria-label', 'Ver más sobre ' + i.titulo); row.appendChild(m);
      li.appendChild(row);
      return li;
    };

    var render = function () {
      var term = norm(q.value.trim());
      var res = items.filter(function (i) {
        return (!sTema.value || i.tema === sTema.value) && (!sEstado.value || i.estado === sEstado.value) &&
          (!term || norm(i.titulo + ' ' + i.resumen + ' ' + i.lugar + ' ' + i.tema).indexOf(term) > -1);
      });
      if (chips) [].forEach.call(chips.children, function (b) { b.setAttribute('aria-pressed', b._v === sTema.value ? 'true' : 'false'); });
      list.textContent = '';
      var visibles = showAll ? res : res.slice(0, LIMIT);
      visibles.forEach(function (i) { list.appendChild(card(i)); });
      more.hidden = res.length <= LIMIT || showAll;
      more.textContent = 'Ver las ' + res.length + ' iniciativas';
      var note = $('note-ejemplo'); if (note) note.hidden = !visibles.some(function (i) { return i.ejemplo; });
      var filtrado = term || sTema.value || sEstado.value;
      count.textContent = res.length === 0 ? 'No hay iniciativas con esos filtros. La tuya puede ser la primera.'
        : filtrado ? res.length + (res.length === 1 ? ' iniciativa encontrada' : ' iniciativas encontradas') : '';
      count.hidden = !count.textContent;
    };
    more.addEventListener('click', function () { showAll = true; render(); });
    [q, sTema, sEstado].forEach(function (c) { c.addEventListener('input', function () { showAll = false; render(); }); });
    render();
  }

  // ---- Página de una iniciativa: formulario para sumarse -----------------
  var ini = readJson('ini');
  if (ini && $('join-here')) $('join-here').appendChild(joinForm(ini, 'p'));

  // ---- Portada: formulario para presentar una iniciativa ----------------
  var form = $('form');
  if (form) {
    var out = $('out'), outText = $('out-text'), title = $('out-title');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(form), missing = [], btn = form.querySelector('button[type=submit]');
      form.querySelectorAll('[required]').forEach(function (f) { if (!f.value.trim()) missing.push('· ' + form.querySelector('label[for="' + f.id + '"]').textContent); });
      out.hidden = false;
      if (missing.length) { title.textContent = 'Completa estos campos para continuar'; outText.textContent = missing.join('\n'); return; }
      title.textContent = 'Enviando…'; outText.textContent = ''; btn.disabled = true;
      send('/api/proponer', { nombre: d.get('nombre'), contacto: d.get('contacto'), titulo: d.get('titulo'), tema: d.get('tema'), problema: d.get('problema'), propuesta: d.get('propuesta'), web: d.get('web') })
        .then(function () { title.textContent = 'Iniciativa enviada'; outText.textContent = 'Gracias. Revisaremos tu iniciativa y te escribiremos al contacto que dejaste.'; form.reset(); })
        .catch(function (e) { title.textContent = 'No pudimos enviar tu iniciativa'; outText.textContent = e.message || 'Inténtalo de nuevo en unos minutos.'; })
        .then(function () { btn.disabled = false; });
    });
  }

  // ---- Portada: cifras y gráficos ---------------------------------------
  var datos = readJson('datos');
  if (datos && $('charts')) {
    var COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
    var INK = ['#ffffff', '#1b1b1b', '#1b1b1b'];
    var tip = $('tip');
    var fmt = function (v, unidad) {
      var n = Number(v);
      if (unidad === '%') return n.toLocaleString('es', { maximumFractionDigits: 1 }) + ' %';
      var s = n >= 10000 ? n.toLocaleString('es', { notation: 'compact', maximumFractionDigits: 1 }) : n.toLocaleString('es');
      return unidad ? s + ' ' + unidad : s;
    };
    var source = function (c, cls) {
      var p = el(cls || 'p', cls ? null : 'src', 'Fuente: ');
      if (c.fuente_url) { var a = el('a', null, c.fuente); a.href = c.fuente_url; a.rel = 'noopener'; p.appendChild(a); }
      else p.appendChild(document.createTextNode(c.fuente || ''));
      return p;
    };
    var hover = function (node, text) {
      node.tabIndex = 0; node.setAttribute('aria-label', text);
      var show = function (x, y) { tip.textContent = text; tip.style.left = Math.min(x + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (y - 40) + 'px'; tip.classList.add('on'); };
      node.addEventListener('mousemove', function (e) { show(e.clientX, e.clientY); });
      node.addEventListener('mouseleave', function () { tip.classList.remove('on'); });
      node.addEventListener('focus', function () { var r = node.getBoundingClientRect(); show(r.left + r.width / 2, r.top); });
      node.addEventListener('blur', function () { tip.classList.remove('on'); });
    };
    var table = function (g) {
      var d = el('details'); d.appendChild(el('summary', null, 'Ver los datos en tabla'));
      var t = el('table'), h = el('tr');
      h.appendChild(el('th', null, 'Dato')); h.appendChild(el('th', null, 'Valor')); t.appendChild(h);
      (g.items || []).forEach(function (it) { var r = el('tr'); r.appendChild(el('td', null, it.etiqueta)); r.appendChild(el('td', null, fmt(it.valor, g.unidad))); t.appendChild(r); });
      d.appendChild(t); return d;
    };
    var chart = function (g) {
      var its = (g.items || []).filter(function (it) { return isFinite(Number(it.valor)); });
      var box = el('article', 'chart' + (g.tipo === 'partes' ? ' wide' : ''));
      box.appendChild(el('h3', null, g.titulo));
      if (g.texto) box.appendChild(el('p', null, g.texto));
      if (g.tipo === 'partes') {
        var total = its.reduce(function (s, it) { return s + Number(it.valor); }, 0) || 1;
        var parts = el('div', 'parts'); parts.setAttribute('role', 'img');
        parts.setAttribute('aria-label', its.map(function (it) { return it.etiqueta + ' ' + fmt(it.valor, g.unidad); }).join(', '));
        var legend = el('ul', 'legend');
        its.forEach(function (it, k) {
          var share = Number(it.valor) / total;
          var p = el('div', 'part', share >= 0.1 ? fmt(it.valor, g.unidad) : '');
          p.style.flex = share + ' 1 0'; p.style.background = COLORS[k % 3]; p.style.color = INK[k % 3];
          hover(p, it.etiqueta + ': ' + fmt(it.valor, g.unidad));
          parts.appendChild(p);
          var li = el('li'), sw = el('i'); sw.style.background = COLORS[k % 3];
          li.appendChild(sw); li.appendChild(document.createTextNode(it.etiqueta));
          legend.appendChild(li);
        });
        box.appendChild(parts); box.appendChild(legend);
      } else {
        var max = Math.max.apply(null, its.map(function (it) { return Number(it.valor); })) || 1;
        var bars = el('div', 'bars');
        its.forEach(function (it) {
          var row = el('div', 'bar-row'); row.appendChild(el('span', 'lbl', it.etiqueta));
          var track = el('div', 'track'), bar = el('div', 'bar');
          bar.style.width = (Number(it.valor) / max * 60).toFixed(2) + '%';
          hover(bar, it.etiqueta + ': ' + fmt(it.valor, g.unidad));
          track.appendChild(bar); track.appendChild(el('span', 'val', fmt(it.valor, g.unidad)));
          row.appendChild(track); bars.appendChild(row);
        });
        box.appendChild(bars);
      }
      box.appendChild(table(g));
      box.appendChild(source(g));
      return box;
    };
    var stat = function (c) {
      var s = el('div', 'stat'); s.appendChild(el('b', null, c.valor)); s.appendChild(el('span', null, c.etiqueta));
      s.appendChild(source(c, 'small'));
      return s;
    };
    var cifras = datos.cifras || [];
    var hero = $('hero-stats');
    // En el teléfono, el panel de cifras de la portada baja a la sección de cifras para que las iniciativas se vean antes.
    var panel = document.querySelector('.hero-panel'), cifrasSec = document.querySelector('#cifras .sec-head');
    if (panel && cifrasSec && window.matchMedia('(max-width: 880px)').matches) { panel.classList.add('moved'); cifrasSec.parentNode.insertBefore(panel, cifrasSec.nextSibling); }
    if (hero) cifras.slice(0, 3).forEach(function (c) { hero.appendChild(stat(c)); });
    var tiles = $('tiles');
    if (tiles) cifras.slice(3).forEach(function (c) { var t = el('div', 'tile'); t.appendChild(stat(c)); tiles.appendChild(t); });
    // El primer gráfico se ve siempre; los demás quedan en «Ver más cifras».
    var graficos = datos.graficos || [], moreBox = $('more-charts-box');
    graficos.forEach(function (g, k) {
      if (k === 0 || !moreBox) $('charts').appendChild(chart(g));
      else $('more-charts').appendChild(chart(g));
    });
    if (moreBox && graficos.length > 1) moreBox.hidden = false;
  }
})();
