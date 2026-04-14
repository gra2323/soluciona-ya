const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// ===================== PLANES =====================
const COSTO_PRO   = 9990;
const COSTO_ELITE = 24990;
const COSTO_LEAD  = { basico: 1000, pro: 500, elite: 0 };
const MAX_COMUNAS = { basico: 3, pro: 10, elite: 31 };

// ===================== EMAIL =====================
const EMAIL_FROM = process.env.EMAIL_FROM || 'gracielalira@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
let transporter = null;
if (EMAIL_PASS) {
  transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_FROM, pass: EMAIL_PASS } });
}

async function enviarEmail(to, subject, html) {
  if (!transporter) return;
  try { await transporter.sendMail({ from: `"Soluciona Ya" <${EMAIL_FROM}>`, to, subject, html }); }
  catch(e) { console.error('Email error:', e.message); }
}

function emailNuevaSolicitud(profEmail, profNombre, sol) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return enviarEmail(profEmail, `📋 Nueva solicitud: ${sol.categoria}`,
    `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e6ed;border-radius:12px;">
      <h2 style="color:#00a651;">Hola ${profNombre},</h2>
      <p>Nueva solicitud en <strong>${sol.categoria}</strong> — <strong>${sol.comuna}</strong></p>
      <div style="background:#f4f6f9;border-radius:8px;padding:16px;margin:16px 0;"><strong>${sol.titulo}</strong></div>
      <a href="${appUrl}/dashboard-profesional.html" style="background:#00a651;color:white;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">Ver solicitud →</a>
    </div>`);
}

function emailContactoDesbloqueado(clienteEmail, clienteNombre, profNombre, titulo) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return enviarEmail(clienteEmail, `📞 ${profNombre} quiere contactarte`,
    `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e6ed;border-radius:12px;">
      <h2 style="color:#00a651;">Hola ${clienteNombre},</h2>
      <p><strong>${profNombre}</strong> está interesado en tu solicitud: <strong>${titulo}</strong></p>
      <a href="${appUrl}/dashboard-cliente.html" style="background:#00a651;color:white;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">Ver mis solicitudes →</a>
    </div>`);
}

function emailNuevaEvaluacion(profEmail, profNombre, estrellas, comentario, clienteNombre) {
  return enviarEmail(profEmail, `⭐ Nueva evaluación de ${clienteNombre}`,
    `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e6ed;border-radius:12px;">
      <h2 style="color:#00a651;">Hola ${profNombre},</h2>
      <p>${clienteNombre} te dio <strong>${estrellas} estrellas</strong>.</p>
      ${comentario ? `<p style="background:#f4f6f9;padding:12px;border-radius:8px;">"${comentario}"</p>` : ''}
    </div>`);
}

// ===================== BASE DE DATOS =====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      tipo TEXT NOT NULL,
      telefono TEXT NOT NULL,
      categoria TEXT,
      descripcion TEXT,
      saldo INTEGER NOT NULL DEFAULT 0,
      plan_activo INTEGER NOT NULL DEFAULT 0,
      plan_tipo TEXT NOT NULL DEFAULT 'basico',
      plan_fecha TIMESTAMP,
      plan_expira TIMESTAMP,
      comunas_habilitadas TEXT DEFAULT 'Rancagua',
      verificado INTEGER NOT NULL DEFAULT 0,
      cv_experiencia TEXT,
      cv_educacion TEXT,
      cv_habilidades TEXT,
      cv_disponibilidad TEXT,
      sitio_activo INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fotos_trabajo (
      id SERIAL PRIMARY KEY,
      profesional_id INTEGER NOT NULL REFERENCES usuarios(id),
      titulo TEXT,
      datos TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS solicitudes (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      categoria TEXT NOT NULL,
      comuna TEXT NOT NULL,
      presupuesto TEXT,
      activa INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS contactos_desbloqueados (
      id SERIAL PRIMARY KEY,
      profesional_id INTEGER NOT NULL REFERENCES usuarios(id),
      solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
      estado TEXT NOT NULL DEFAULT 'nuevo',
      nota TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(profesional_id, solicitud_id)
    );
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id SERIAL PRIMARY KEY,
      profesional_id INTEGER NOT NULL REFERENCES usuarios(id),
      cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
      solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
      estrellas INTEGER NOT NULL CHECK(estrellas BETWEEN 1 AND 5),
      comentario TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(cliente_id, solicitud_id)
    );
    CREATE TABLE IF NOT EXISTS transacciones (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      tipo TEXT NOT NULL,
      monto INTEGER NOT NULL,
      descripcion TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS publicidades (
      id SERIAL PRIMARY KEY,
      empresa TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      telefono TEXT NOT NULL,
      url TEXT,
      imagen TEXT,
      color_fondo TEXT DEFAULT '#1a2744',
      color_texto TEXT DEFAULT '#ffffff',
      plan TEXT NOT NULL DEFAULT 'semana',
      activo INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      expira TIMESTAMP
    );
  `);
  console.log('✅ Base de datos lista');
}

// ===================== MIDDLEWARE =====================
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'soluciona-ya-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Íconos PWA
function generarIconoPNG(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size*0.18}" fill="#00a651"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial Black, sans-serif" font-weight="900" font-size="${size*0.42}" fill="white">SY</text>
    <text x="50%" y="82%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="${size*0.1}" fill="rgba(255,255,255,0.7)">SOLUCIONA YA</text>
  </svg>`;
  return Buffer.from(svg);
}
app.get('/icon-:size.png', (req, res) => {
  const size = parseInt(req.params.size) || 192;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(generarIconoPNG(size));
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}
function requireProfesional(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  if (req.session.tipo !== 'profesional') return res.status(403).json({ error: 'Solo profesionales' });
  next();
}
function requireCliente(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  if (req.session.tipo !== 'cliente') return res.status(403).json({ error: 'Solo clientes' });
  next();
}
function validarTelefonoChileno(tel) {
  return /^(\+?56)?0?9\d{8}$/.test(tel.replace(/\s/g, ''));
}
function formatMoneyServer(n) { return `$${Number(n).toLocaleString('es-CL')}`; }

// ===================== AUTH =====================
app.post('/api/auth/registro', async (req, res) => {
  try {
    const { nombre, email, password, tipo, telefono, categoria, descripcion, comunas } = req.body;
    if (!nombre || !email || !password || !tipo || !telefono)
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    if (!validarTelefonoChileno(telefono))
      return res.status(400).json({ error: 'Teléfono inválido. Usa formato chileno: +56 9 XXXX XXXX' });
    if (tipo === 'profesional' && !categoria)
      return res.status(400).json({ error: 'Indica tu categoría' });
    const hashed = await bcrypt.hash(password, 10);
    const comunasStr = tipo === 'profesional'
      ? ((Array.isArray(comunas) ? comunas : []).slice(0, 3).join(',') || 'Rancagua') : null;
    const r = await query(
      `INSERT INTO usuarios (nombre,email,password,tipo,telefono,categoria,descripcion,comunas_habilitadas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [nombre, email, hashed, tipo, telefono, categoria||null, descripcion||null, comunasStr]
    );
    const id = r.rows[0].id;
    req.session.userId = id;
    req.session.nombre = nombre;
    req.session.tipo = tipo;
    res.json({ ok: true, tipo, nombre });
  } catch(e) {
    if (e.message.includes('unique') || e.message.includes('UNIQUE'))
      return res.status(400).json({ error: 'Email ya registrado' });
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    req.session.userId = user.id;
    req.session.nombre = user.nombre;
    req.session.tipo = user.tipo;
    res.json({ ok: true, tipo: user.tipo, nombre: user.nombre });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const r = await query('SELECT id,nombre,email,tipo,telefono,categoria,descripcion,saldo,plan_activo,plan_tipo,plan_fecha,plan_expira,comunas_habilitadas,verificado FROM usuarios WHERE id=$1', [req.session.userId]);
  const u = r.rows[0];
  if (!u) return res.status(401).json({ error: 'No autenticado' });
  const comunas_list = u.comunas_habilitadas ? u.comunas_habilitadas.split(',').map(c=>c.trim()).filter(Boolean) : null;
  res.json({ ...u, comunas_list });
});

// ===================== SOLICITUDES =====================
app.get('/api/solicitudes', requireAuth, async (req, res) => {
  const { categoria, comuna, buscar } = req.query;
  let q = `SELECT s.id,s.titulo,s.descripcion,s.categoria,s.comuna,s.presupuesto,s.created_at,u.nombre as cliente_nombre FROM solicitudes s JOIN usuarios u ON s.cliente_id=u.id WHERE s.activa=1`;
  const p = [];
  let idx = 1;
  if (categoria) { q += ` AND s.categoria=$${idx++}`; p.push(categoria); }
  if (comuna)    { q += ` AND s.comuna=$${idx++}`; p.push(comuna); }
  if (buscar)    { q += ` AND (s.titulo ILIKE $${idx} OR s.descripcion ILIKE $${idx})`; p.push(`%${buscar}%`); idx++; }

  if (req.session.tipo === 'profesional' && !comuna) {
    const pr = await query('SELECT plan_tipo, comunas_habilitadas FROM usuarios WHERE id=$1', [req.session.userId]);
    const prof = pr.rows[0];
    if (prof && prof.plan_tipo !== 'elite' && prof.comunas_habilitadas) {
      const comunas = prof.comunas_habilitadas.split(',').map(c=>c.trim()).filter(Boolean);
      if (comunas.length) {
        q += ` AND s.comuna = ANY($${idx++})`;
        p.push(comunas);
      }
    }
  }
  q += ' ORDER BY s.created_at DESC';
  const rows = (await query(q, p)).rows;

  if (req.session.tipo === 'profesional') {
    const desbr = await query('SELECT solicitud_id FROM contactos_desbloqueados WHERE profesional_id=$1', [req.session.userId]);
    const set = new Set(desbr.rows.map(d=>d.solicitud_id));
    rows.forEach(s => s.desbloqueado = set.has(s.id));
  }
  res.json(rows);
});

app.get('/api/mis-solicitudes', requireCliente, async (req, res) => {
  const r = await query(`SELECT s.*,(SELECT COUNT(*) FROM contactos_desbloqueados WHERE solicitud_id=s.id) as vistas FROM solicitudes s WHERE s.cliente_id=$1 AND s.activa=1 ORDER BY s.created_at DESC`, [req.session.userId]);
  res.json(r.rows);
});

app.post('/api/solicitudes', requireCliente, async (req, res) => {
  const { titulo, descripcion, categoria, comuna, presupuesto } = req.body;
  if (!titulo||!descripcion||!categoria||!comuna) return res.status(400).json({ error: 'Faltan campos' });
  const r = await query(`INSERT INTO solicitudes (cliente_id,titulo,descripcion,categoria,comuna,presupuesto) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.session.userId,titulo,descripcion,categoria,comuna,presupuesto||null]);
  const solicitud = { id: r.rows[0].id, titulo, descripcion, categoria, comuna, presupuesto };
  const profs = (await query(`SELECT email,nombre,plan_tipo,comunas_habilitadas FROM usuarios WHERE tipo='profesional' AND categoria=$1`, [categoria])).rows;
  for (const prof of profs) {
    const lista = prof.plan_tipo === 'elite' ? null : (prof.comunas_habilitadas||'').split(',').map(c=>c.trim());
    if (!lista || lista.includes(comuna)) emailNuevaSolicitud(prof.email, prof.nombre, solicitud);
  }
  res.json({ ok: true, id: r.rows[0].id });
});

app.delete('/api/solicitudes/:id', requireCliente, async (req, res) => {
  const s = (await query('SELECT id FROM solicitudes WHERE id=$1 AND cliente_id=$2', [req.params.id, req.session.userId])).rows[0];
  if (!s) return res.status(404).json({ error: 'No encontrada' });
  await query('UPDATE solicitudes SET activa=0 WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===================== WALLET =====================
app.get('/api/wallet/saldo', requireAuth, async (req, res) => {
  const r = await query('SELECT saldo FROM usuarios WHERE id=$1', [req.session.userId]);
  res.json({ saldo: r.rows[0]?.saldo || 0 });
});

app.post('/api/wallet/recargar', requireProfesional, async (req, res) => {
  const { monto } = req.body;
  if (![5000,10000,20000,50000].includes(Number(monto))) return res.status(400).json({ error: 'Monto inválido' });
  await query('UPDATE usuarios SET saldo=saldo+$1 WHERE id=$2', [monto, req.session.userId]);
  await query('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES ($1,$2,$3,$4)', [req.session.userId,'recarga',monto,`Recarga ${formatMoneyServer(monto)}`]);
  const u = (await query('SELECT saldo FROM usuarios WHERE id=$1', [req.session.userId])).rows[0];
  res.json({ ok: true, saldo: u.saldo });
});

app.post('/api/wallet/desbloquear/:solicitudId', requireProfesional, async (req, res) => {
  const sid = parseInt(req.params.solicitudId);
  const ya = (await query('SELECT id FROM contactos_desbloqueados WHERE profesional_id=$1 AND solicitud_id=$2', [req.session.userId,sid])).rows[0];
  if (ya) return res.status(400).json({ error: 'Ya desbloqueaste esta solicitud' });
  const sol = (await query(`SELECT s.*,u.nombre,u.telefono,u.email,u.id as cliente_id FROM solicitudes s JOIN usuarios u ON s.cliente_id=u.id WHERE s.id=$1 AND s.activa=1`, [sid])).rows[0];
  if (!sol) return res.status(404).json({ error: 'No encontrada' });
  const user = (await query('SELECT saldo,plan_tipo,nombre FROM usuarios WHERE id=$1', [req.session.userId])).rows[0];
  const costo = COSTO_LEAD[user.plan_tipo] || COSTO_LEAD.basico;
  if (user.saldo < costo) return res.status(400).json({ error: `Saldo insuficiente. Necesitas ${formatMoneyServer(costo)}.` });
  if (costo > 0) await query('UPDATE usuarios SET saldo=saldo-$1 WHERE id=$2', [costo, req.session.userId]);
  await query('INSERT INTO contactos_desbloqueados (profesional_id,solicitud_id) VALUES ($1,$2)', [req.session.userId,sid]);
  const desc = costo === 0 ? `Contacto #${sid} (gratis, Plan Élite)` : costo < 1000 ? `Contacto #${sid} (50% dcto, Plan Pro)` : `Contacto #${sid}`;
  await query('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES ($1,$2,$3,$4)', [req.session.userId,'desbloqueo',-costo,desc]);
  const cliente = (await query('SELECT nombre,email FROM usuarios WHERE id=$1', [sol.cliente_id])).rows[0];
  if (cliente) emailContactoDesbloqueado(cliente.email, cliente.nombre, user.nombre, sol.titulo);
  res.json({ ok: true, contacto: { nombre: sol.nombre, telefono: sol.telefono, email: sol.email }, costo });
});

app.get('/api/contacto/:solicitudId', requireProfesional, async (req, res) => {
  const sid = parseInt(req.params.solicitudId);
  const d = (await query('SELECT id FROM contactos_desbloqueados WHERE profesional_id=$1 AND solicitud_id=$2', [req.session.userId,sid])).rows[0];
  if (!d) return res.status(403).json({ error: 'Debes desbloquear primero' });
  const r = (await query(`SELECT u.nombre,u.telefono,u.email FROM solicitudes s JOIN usuarios u ON s.cliente_id=u.id WHERE s.id=$1`, [sid])).rows[0];
  res.json(r);
});

app.get('/api/transacciones', requireProfesional, async (req, res) => {
  const r = await query('SELECT * FROM transacciones WHERE usuario_id=$1 ORDER BY created_at DESC LIMIT 30', [req.session.userId]);
  res.json(r.rows);
});

// ===================== STATS COMUNAS =====================
app.get('/api/stats/comunas', async (req, res) => {
  const r = await query(`SELECT comuna, COUNT(*) as total FROM solicitudes WHERE activa=1 GROUP BY comuna ORDER BY total DESC`);
  res.json(r.rows);
});

// ===================== PROFESIONALES =====================
app.get('/api/profesionales', requireAuth, async (req, res) => {
  const { categoria } = req.query;
  let q = `SELECT id,nombre,categoria,descripcion,plan_tipo,verificado,created_at FROM usuarios WHERE tipo='profesional'`;
  const p = [];
  if (categoria) { q += ' AND categoria=$1'; p.push(categoria); }
  q += ` ORDER BY CASE plan_tipo WHEN 'elite' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END, created_at DESC`;
  const r = await query(q, p);
  res.json(r.rows);
});

app.get('/api/profesionales/publicos', async (req, res) => {
  const r = await query(`
    SELECT u.id, u.nombre, u.categoria, u.descripcion,
           u.plan_tipo, u.verificado, u.sitio_activo, u.created_at,
           ROUND(AVG(ev.estrellas)::numeric,1) as promedio,
           COUNT(ev.id) as total_eval
    FROM usuarios u
    LEFT JOIN evaluaciones ev ON ev.profesional_id = u.id
    WHERE u.tipo = 'profesional'
    GROUP BY u.id
    ORDER BY CASE u.plan_tipo WHEN 'elite' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END,
             promedio DESC NULLS LAST, u.created_at DESC`);
  res.json(r.rows);
});

app.post('/api/auth/descripcion', requireAuth, async (req, res) => {
  const { descripcion } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'Falta descripción' });
  await query('UPDATE usuarios SET descripcion=$1 WHERE id=$2', [descripcion, req.session.userId]);
  res.json({ ok: true });
});

// ===================== PLANES =====================
app.post('/api/plan/suscribir', requireProfesional, async (req, res) => {
  const { tipo } = req.body;
  if (!['pro','elite'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  const costo = tipo === 'pro' ? COSTO_PRO : COSTO_ELITE;
  await query(`UPDATE usuarios SET plan_tipo=$1, plan_activo=1, plan_fecha=NOW(), plan_expira=NOW() + INTERVAL '30 days' WHERE id=$2`, [tipo, req.session.userId]);
  if (tipo === 'elite') await query('UPDATE usuarios SET comunas_habilitadas=NULL WHERE id=$1', [req.session.userId]);
  await query('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES ($1,$2,$3,$4)', [req.session.userId,'plan',-costo,`Plan ${tipo} — 30 días`]);
  const u = (await query('SELECT plan_tipo,plan_expira,comunas_habilitadas FROM usuarios WHERE id=$1', [req.session.userId])).rows[0];
  const comunas_list = u.comunas_habilitadas ? u.comunas_habilitadas.split(',').map(c=>c.trim()).filter(Boolean) : null;
  res.json({ ok: true, plan_tipo: u.plan_tipo, plan_expira: u.plan_expira, comunas_list });
});

// ===================== COMUNAS =====================
app.post('/api/perfil/comunas', requireProfesional, async (req, res) => {
  const { comunas } = req.body;
  if (!Array.isArray(comunas)) return res.status(400).json({ error: 'comunas debe ser array' });
  const user = (await query('SELECT plan_tipo FROM usuarios WHERE id=$1', [req.session.userId])).rows[0];
  const maxC = MAX_COMUNAS[user.plan_tipo] || 3;
  const limited = comunas.slice(0, maxC).filter(Boolean);
  await query('UPDATE usuarios SET comunas_habilitadas=$1 WHERE id=$2', [limited.join(','), req.session.userId]);
  res.json({ ok: true, comunas_habilitadas: limited });
});

// ===================== FOTOS =====================
app.get('/api/fotos', requireProfesional, async (req, res) => {
  const r = await query('SELECT id,titulo,datos,created_at FROM fotos_trabajo WHERE profesional_id=$1 ORDER BY created_at DESC', [req.session.userId]);
  res.json(r.rows);
});
app.post('/api/fotos', requireProfesional, async (req, res) => {
  const user = (await query('SELECT plan_activo,plan_tipo FROM usuarios WHERE id=$1', [req.session.userId])).rows[0];
  if (!user.plan_activo && user.plan_tipo === 'basico') return res.status(403).json({ error: 'Necesitas un plan para subir fotos' });
  const { titulo, datos } = req.body;
  if (!datos) return res.status(400).json({ error: 'Falta imagen' });
  const cnt = (await query('SELECT COUNT(*) as c FROM fotos_trabajo WHERE profesional_id=$1', [req.session.userId])).rows[0];
  if (parseInt(cnt.c) >= 10) return res.status(400).json({ error: 'Máximo 10 fotos' });
  const r = await query('INSERT INTO fotos_trabajo (profesional_id,titulo,datos) VALUES ($1,$2,$3) RETURNING id', [req.session.userId,titulo||'Mi trabajo',datos]);
  res.json({ ok: true, id: r.rows[0].id });
});
app.delete('/api/fotos/:id', requireProfesional, async (req, res) => {
  await query('DELETE FROM fotos_trabajo WHERE id=$1 AND profesional_id=$2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});
app.get('/api/fotos/profesional/:id', requireAuth, async (req, res) => {
  const r = await query('SELECT id,titulo,datos,created_at FROM fotos_trabajo WHERE profesional_id=$1 ORDER BY created_at DESC', [req.params.id]);
  res.json(r.rows);
});

// ===================== SEGUIMIENTO =====================
app.get('/api/solicitud/:id/profesionales', requireCliente, async (req, res) => {
  const sol = (await query('SELECT id FROM solicitudes WHERE id=$1 AND cliente_id=$2', [req.params.id, req.session.userId])).rows[0];
  if (!sol) return res.status(403).json({ error: 'No autorizado' });
  const r = await query(`
    SELECT u.id, u.nombre, u.categoria, u.descripcion, cd.estado,
           ev.estrellas, ev.comentario
    FROM contactos_desbloqueados cd
    JOIN usuarios u ON cd.profesional_id = u.id
    LEFT JOIN evaluaciones ev ON ev.profesional_id = u.id AND ev.solicitud_id = cd.solicitud_id AND ev.cliente_id = $1
    WHERE cd.solicitud_id = $2`, [req.session.userId, req.params.id]);
  res.json(r.rows);
});

app.patch('/api/contacto/:solicitudId/estado', requireProfesional, async (req, res) => {
  const { estado, nota } = req.body;
  const validos = ['nuevo','contactado','cotizado','en_trabajo','finalizado','sin_respuesta'];
  if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  await query('UPDATE contactos_desbloqueados SET estado=$1, nota=$2 WHERE profesional_id=$3 AND solicitud_id=$4', [estado,nota||null,req.session.userId,req.params.solicitudId]);
  res.json({ ok: true });
});

app.get('/api/mis-contactos-detalle', requireProfesional, async (req, res) => {
  const r = await query(`
    SELECT cd.solicitud_id, cd.estado, cd.nota, cd.created_at,
           s.titulo, s.descripcion, s.categoria, s.comuna, s.presupuesto,
           u.nombre as cliente_nombre, u.telefono as cliente_tel, u.email as cliente_email,
           ev.estrellas as eval_estrellas, ev.comentario as eval_comentario
    FROM contactos_desbloqueados cd
    JOIN solicitudes s ON cd.solicitud_id = s.id
    JOIN usuarios u ON s.cliente_id = u.id
    LEFT JOIN evaluaciones ev ON ev.solicitud_id = cd.solicitud_id AND ev.profesional_id = cd.profesional_id
    WHERE cd.profesional_id = $1
    ORDER BY cd.created_at DESC`, [req.session.userId]);
  res.json(r.rows);
});

// ===================== EVALUACIONES =====================
app.post('/api/evaluar/:solicitudId', requireCliente, async (req, res) => {
  const { estrellas, comentario, profesionalId } = req.body;
  if (!estrellas || estrellas < 1 || estrellas > 5) return res.status(400).json({ error: 'Estrellas inválidas' });
  if (!profesionalId) return res.status(400).json({ error: 'Falta profesionalId' });
  const desb = (await query('SELECT id FROM contactos_desbloqueados WHERE profesional_id=$1 AND solicitud_id=$2', [profesionalId, req.params.solicitudId])).rows[0];
  if (!desb) return res.status(403).json({ error: 'Este profesional no desbloqueó esta solicitud' });
  try {
    await query('INSERT INTO evaluaciones (profesional_id,cliente_id,solicitud_id,estrellas,comentario) VALUES ($1,$2,$3,$4,$5)',
      [profesionalId, req.session.userId, req.params.solicitudId, estrellas, comentario||null]);
    const prof = (await query('SELECT email,nombre FROM usuarios WHERE id=$1', [profesionalId])).rows[0];
    const cliente = (await query('SELECT nombre FROM usuarios WHERE id=$1', [req.session.userId])).rows[0];
    if (prof && cliente) emailNuevaEvaluacion(prof.email, prof.nombre, estrellas, comentario, cliente.nombre);
    res.json({ ok: true });
  } catch(e) {
    if (e.message.includes('unique')) return res.status(400).json({ error: 'Ya evaluaste este trabajo' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/evaluaciones/:profesionalId', async (req, res) => {
  const rows = (await query(`
    SELECT ev.estrellas, ev.comentario, ev.created_at,
           u.nombre as cliente_nombre, s.titulo as solicitud_titulo
    FROM evaluaciones ev
    JOIN usuarios u ON ev.cliente_id = u.id
    JOIN solicitudes s ON ev.solicitud_id = s.id
    WHERE ev.profesional_id = $1
    ORDER BY ev.created_at DESC`, [req.params.profesionalId])).rows;
  const promedio = rows.length ? (rows.reduce((a,r)=>a+parseInt(r.estrellas),0)/rows.length).toFixed(1) : null;
  res.json({ evaluaciones: rows, promedio, total: rows.length });
});

// ===================== MINI SITIO =====================
app.post('/api/perfil/cv', requireProfesional, async (req, res) => {
  const { cv_experiencia, cv_educacion, cv_habilidades, cv_disponibilidad, sitio_activo } = req.body;
  await query(`UPDATE usuarios SET cv_experiencia=$1,cv_educacion=$2,cv_habilidades=$3,cv_disponibilidad=$4,sitio_activo=$5 WHERE id=$6`,
    [cv_experiencia||null,cv_educacion||null,cv_habilidades||null,cv_disponibilidad||null,sitio_activo?1:0,req.session.userId]);
  res.json({ ok: true });
});

app.get('/api/perfil/publico/:id', async (req, res) => {
  const u = (await query(`SELECT id,nombre,categoria,descripcion,cv_experiencia,cv_educacion,cv_habilidades,cv_disponibilidad,sitio_activo,plan_tipo,verificado,created_at FROM usuarios WHERE id=$1 AND tipo='profesional'`, [req.params.id])).rows[0];
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  const fotos = (await query('SELECT id,titulo,datos FROM fotos_trabajo WHERE profesional_id=$1 ORDER BY created_at DESC', [req.params.id])).rows;
  const evRows = (await query(`SELECT ev.estrellas,ev.comentario,ev.created_at,u.nombre as cliente_nombre FROM evaluaciones ev JOIN usuarios u ON ev.cliente_id=u.id WHERE ev.profesional_id=$1 ORDER BY ev.created_at DESC LIMIT 10`, [req.params.id])).rows;
  const promedio = evRows.length ? (evRows.reduce((a,r)=>a+parseInt(r.estrellas),0)/evRows.length).toFixed(1) : null;
  res.json({ ...u, fotos, evaluaciones: evRows, promedio, total: evRows.length });
});

// ===================== ADMIN =====================
app.get('/api/admin/usuarios', async (req, res) => {
  const r = await query(`SELECT id,nombre,email,tipo,telefono,categoria,saldo,plan_activo,plan_tipo,plan_expira,verificado,comunas_habilitadas,created_at FROM usuarios ORDER BY tipo, created_at DESC`);
  res.json(r.rows);
});
app.get('/api/admin/stats-comunas', async (req, res) => {
  const r = await query(`SELECT comuna, COUNT(*) as total FROM solicitudes GROUP BY comuna ORDER BY total DESC`);
  res.json(r.rows);
});
app.post('/api/admin/acreditar', async (req, res) => {
  const { userId, monto } = req.body;
  if (!userId || !monto || monto < 1000) return res.status(400).json({ error: 'Datos inválidos' });
  await query('UPDATE usuarios SET saldo=saldo+$1 WHERE id=$2', [monto, userId]);
  await query('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES ($1,$2,$3,$4)', [userId,'recarga',monto,`Recarga manual: ${formatMoneyServer(monto)}`]);
  res.json({ ok: true });
});
app.post('/api/admin/activar-suscripcion', async (req, res) => {
  const { userId, tipo } = req.body;
  if (!userId || !['pro','elite'].includes(tipo)) return res.status(400).json({ error: 'Datos inválidos' });
  await query(`UPDATE usuarios SET plan_tipo=$1,plan_activo=1,plan_fecha=NOW(),plan_expira=NOW()+INTERVAL '30 days' WHERE id=$2`, [tipo, userId]);
  if (tipo === 'elite') await query('UPDATE usuarios SET comunas_habilitadas=NULL,verificado=1 WHERE id=$1', [userId]);
  const costo = tipo === 'pro' ? 9990 : 24990;
  await query('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES ($1,$2,$3,$4)', [userId,'plan',-costo,`Plan ${tipo} activado por admin`]);
  res.json({ ok: true });
});

// ===================== PUBLICIDAD =====================
app.get('/api/publicidad', async (req, res) => {
  const r = await query(`SELECT id,empresa,descripcion,telefono,url,imagen,color_fondo,color_texto,plan FROM publicidades WHERE activo=1 AND (expira IS NULL OR expira > NOW()) ORDER BY CASE plan WHEN 'mes' THEN 1 ELSE 2 END, created_at ASC`);
  res.json(r.rows);
});
app.post('/api/publicidad/solicitar', async (req, res) => {
  const { empresa, descripcion, telefono, url, imagen, color_fondo, color_texto, plan } = req.body;
  if (!empresa || !descripcion || !telefono) return res.status(400).json({ error: 'Faltan campos' });
  if (!validarTelefonoChileno(telefono)) return res.status(400).json({ error: 'Teléfono inválido' });
  if (!['semana','mes'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
  const r = await query(`INSERT INTO publicidades (empresa,descripcion,telefono,url,imagen,color_fondo,color_texto,plan) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [empresa,descripcion,telefono,url||null,imagen||null,color_fondo||'#1a2744',color_texto||'#ffffff',plan]);
  res.json({ ok: true, id: r.rows[0].id });
});
app.get('/api/admin/publicidades', async (req, res) => {
  const r = await query('SELECT * FROM publicidades ORDER BY created_at DESC');
  res.json(r.rows);
});
app.post('/api/admin/publicidad/activar', async (req, res) => {
  const { id, dias } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta id' });
  await query(`UPDATE publicidades SET activo=1,expira=NOW()+INTERVAL '${parseInt(dias||30)} days' WHERE id=$1`, [id]);
  res.json({ ok: true });
});
app.post('/api/admin/publicidad/desactivar', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta id' });
  await query('UPDATE publicidades SET activo=0 WHERE id=$1', [id]);
  res.json({ ok: true });
});
app.delete('/api/admin/publicidad/:id', async (req, res) => {
  await query('DELETE FROM publicidades WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ===================== QR =====================
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
app.get('/qr', async (req, res) => {
  const appUrl = process.env.APP_URL || `http://${getLocalIP()}:${PORT}`;
  const qrDataUrl = await QRCode.toDataURL(appUrl, { width: 280, margin: 2, color: { dark: '#006633', light: '#ffffff' } });
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>QR — Soluciona Ya</title><link rel="stylesheet" href="/style.css"></head>
<body style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f4f6f9;padding:24px;">
  <nav class="navbar" style="position:fixed;top:0;left:0;right:0;"><a href="/" class="navbar-brand">🏘️ Soluciona <span class="brand-ya">Ya</span></a></nav>
  <div style="background:white;border-radius:20px;padding:40px;box-shadow:0 8px 40px rgba(0,0,0,.12);text-align:center;max-width:360px;width:100%;margin-top:80px;">
    <div style="font-size:2.5rem;margin-bottom:10px;">📱</div>
    <h1 style="font-size:1.4rem;font-weight:900;margin-bottom:6px;">Abre en tu celular</h1>
    <p style="color:#6b7280;font-size:.9rem;margin-bottom:24px;">Escanea con la cámara</p>
    <img src="${qrDataUrl}" style="width:240px;height:240px;border-radius:12px;border:3px solid #00a651;" alt="QR">
    <div style="margin-top:20px;background:#f0fdf4;border-radius:12px;padding:14px;">
      <div style="font-size:.75rem;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">URL</div>
      <div style="font-size:1rem;font-weight:800;color:#006633;font-family:monospace;">${appUrl}</div>
    </div>
  </div>
</body></html>`);
});

// ===================== INICIO =====================
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Soluciona Ya en http://localhost:${PORT}`));
}).catch(e => { console.error('Error DB:', e); process.exit(1); });
