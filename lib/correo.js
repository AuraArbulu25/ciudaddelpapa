// Utilidades compartidas por las funciones de /api. Envía correos con Resend (https://resend.com).

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

// Para asuntos y nombres: sin saltos de línea.
function oneLine(value, max) {
  return clean(value, max).replace(/[\r\n]+/g, ' ');
}

function isEmail(value) {
  return /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(String(value || ''));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch (e) {
    return {};
  }
}

function config() {
  const { RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAIL } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !isEmail(ADMIN_EMAIL)) return null;
  return { key: RESEND_API_KEY, from: EMAIL_FROM, admin: ADMIN_EMAIL };
}

async function sendMail(cfg, { to, cc, replyTo, subject, text }) {
  const payload = { from: cfg.from, to: [to], subject, text };
  if (cc) payload.cc = [cc];
  if (replyTo) payload.reply_to = replyTo;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${await r.text()}`);
}

function fail(res, status, error) {
  res.status(status).json({ ok: false, error });
}

module.exports = { clean, oneLine, isEmail, readBody, config, sendMail, fail };
