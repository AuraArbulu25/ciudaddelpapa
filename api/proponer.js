// POST /api/proponer — alguien propone una iniciativa nueva.
// Envía la propuesta al equipo (ADMIN_EMAIL), que la revisa y la publica desde el CMS.
const { clean, oneLine, isEmail, readBody, config, sendMail, fail } = require('../lib/correo');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return fail(res, 405, 'Método no permitido.');
  const b = readBody(req);
  if (b.web) return res.status(200).json({ ok: true }); // campo trampa: lo llenan los bots

  const nombre = oneLine(b.nombre, 120);
  const contacto = oneLine(b.contacto, 200);
  const titulo = oneLine(b.titulo, 150);
  const tema = oneLine(b.tema, 60);
  const problema = clean(b.problema, 4000);
  const propuesta = clean(b.propuesta, 4000);

  if (!nombre || !contacto || !titulo || !problema || !propuesta) {
    return fail(res, 400, 'Completa todos los campos del formulario.');
  }

  const cfg = config();
  if (!cfg) {
    console.error('Faltan RESEND_API_KEY, EMAIL_FROM o ADMIN_EMAIL.');
    return fail(res, 500, 'El envío de correos aún no está configurado. Inténtalo más adelante.');
  }

  try {
    await sendMail(cfg, {
      to: cfg.admin,
      replyTo: isEmail(contacto) ? contacto : null,
      subject: `Nueva propuesta: ${titulo}`,
      text: `Nueva propuesta de iniciativa desde ciudaddelpapa.com.\n\nIniciativa: ${titulo}\nTema: ${tema || 'sin tema'}\nPropone: ${nombre}\nContacto: ${contacto}\n\n`
        + `Problema:\n${problema}\n\nPropuesta:\n${propuesta}\n`,
    });
  } catch (e) {
    console.error(e);
    return fail(res, 502, 'No pudimos enviar tu propuesta. Inténtalo de nuevo en unos minutos.');
  }

  res.status(200).json({ ok: true });
};
