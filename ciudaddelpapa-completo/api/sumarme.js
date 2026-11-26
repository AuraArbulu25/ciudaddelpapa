// POST /api/sumarme — alguien quiere sumarse a una iniciativa.
// Envía un correo al responsable (contacto_correo de la iniciativa) con copia al equipo,
// y una confirmación a la persona si dejó su correo.
const fs = require('fs');
const path = require('path');
const { clean, oneLine, isEmail, readBody, config, sendMail, fail } = require('../lib/correo');

const DIR = path.join(process.cwd(), 'content', 'iniciativas');

function findInitiative(id) {
  // Se compara contra el listado real de archivos: el id nunca se usa para armar una ruta.
  const file = fs.readdirSync(DIR).find((f) => f === `${id}.json`);
  return file ? JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')) : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Método no permitido.');
  const b = readBody(req);
  if (b.web) return res.status(200).json({ ok: true }); // campo trampa: lo llenan los bots

  const nombre = oneLine(b.nombre, 120);
  const correo = oneLine(b.correo, 200);
  const telefono = oneLine(b.telefono, 40);
  const distrito = oneLine(b.distrito, 120);
  const ayuda = clean(b.ayuda, 2000);

  if (!nombre) return fail(res, 400, 'Escribe tu nombre.');
  if (!correo && !telefono) return fail(res, 400, 'Deja un correo o un teléfono para que puedan contactarte.');
  if (correo && !isEmail(correo)) return fail(res, 400, 'Revisa el correo: parece incompleto.');
  if (b.acepta !== true) return fail(res, 400, 'Marca la casilla de autorización para enviar tus datos.');

  let ini;
  try {
    ini = findInitiative(clean(b.iniciativa, 120));
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'No pudimos leer la iniciativa. Inténtalo de nuevo en unos minutos.');
  }
  if (!ini || ini.publicada === false) return fail(res, 404, 'No encontramos esa iniciativa.');
  if (ini.ejemplo === true) return fail(res, 400, 'Esta iniciativa es un ejemplo y todavía no recibe solicitudes.');

  const cfg = config();
  if (!cfg) {
    console.error('Faltan RESEND_API_KEY, EMAIL_FROM o ADMIN_EMAIL.');
    return fail(res, 500, 'El envío de correos aún no está configurado. Inténtalo más adelante.');
  }

  const titulo = oneLine(ini.titulo, 150);
  const responsable = isEmail(ini.contacto_correo) ? ini.contacto_correo : cfg.admin;
  const datos = [
    `Nombre: ${nombre}`,
    `Correo: ${correo || 'no indicó'}`,
    `Teléfono o WhatsApp: ${telefono || 'no indicó'}`,
    `Distrito o ciudad: ${distrito || 'no indicó'}`,
    '',
    'Cómo quiere ayudar:',
    ayuda || 'No dejó un mensaje.',
  ].join('\n');

  try {
    await sendMail(cfg, {
      to: responsable,
      cc: responsable === cfg.admin ? null : cfg.admin,
      replyTo: correo || null,
      subject: `Nueva persona quiere sumarse a «${titulo}»`,
      text: `Hola:\n\nUna persona quiere sumarse a la iniciativa «${titulo}» desde ciudaddelpapa.com.\n\n${datos}\n\n`
        + 'Esta persona autorizó el envío de sus datos solo para que la contacten por esta iniciativa. '
        + (correo ? 'Puedes responder directamente a este correo.' : 'Contáctala por teléfono.')
        + '\n\nCiudad del Papa',
    });
  } catch (e) {
    console.error(e);
    return fail(res, 502, 'No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos.');
  }

  if (correo) {
    try {
      await sendMail(cfg, {
        to: correo,
        replyTo: cfg.admin,
        subject: `Recibimos tu solicitud para sumarte a «${titulo}»`,
        text: `Hola, ${nombre}:\n\nEnviamos tus datos a los responsables de «${titulo}». Ellos te contactarán por correo o por teléfono.\n\n`
          + `Esto fue lo que enviaste:\n\n${datos}\n\nSi no hiciste esta solicitud, responde a este correo y la anulamos.\n\nCiudad del Papa\nciudaddelpapa.com`,
      });
    } catch (e) {
      console.error(e); // la solicitud ya llegó al responsable; la copia es secundaria
    }
  }

  res.status(200).json({ ok: true });
};
