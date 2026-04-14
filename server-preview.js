const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');

const app = express();

// ===================== PLANES =====================
const COSTO_PRO   = 9990;
const COSTO_ELITE = 24990;
const COSTO_LEAD  = { basico: 1000, pro: 500, elite: 0 };
const MAX_COMUNAS = { basico: 3, pro: 10, elite: 31 };

// ===================== EMAIL =====================
const EMAIL_FROM = 'gracielalira@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

let transporter = null;
if (EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_FROM, pass: EMAIL_PASS }
  });
  console.log('✅ Notificaciones por email activadas');
} else {
  console.log('⚠️  Email no configurado — agrega EMAIL_PASS para activar notificaciones');
}

async function enviarEmail(to, subject, html) {
  if (!transporter) return;
  try {
    await transporter.sendMail({ from: `"Soluciona Ya" <${EMAIL_FROM}>`, to, subject, html });
    console.log(`📧 Email enviado a ${to}: ${subject}`);
  } catch(e) { console.error('Error email:', e.message); }
}

function emailNuevaSolicitud(profEmail, profNombre, solicitud) {
  return enviarEmail(profEmail,
    `📋 Nueva solicitud en tu categoría: ${solicitud.categoria}`,
    `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e6ed;border-radius:12px;">
      <h2 style="color:#1a2744;">Hola ${profNombre},</h2>
      <p>Hay una nueva solicitud en tu categoría <strong>${solicitud.categoria}</strong> en <strong>${solicitud.comuna}</strong>.</p>
      <div style="background:#f4f6f9;border-radius:8px;padding:16px;margin:16px 0;">
        <strong>${solicitud.titulo}</strong><br>
        <span style="color:#6b7280;font-size:.9rem;">${solicitud.descripcion}</span>
        ${solicitud.presupuesto ? `<br><br>💰 Presupuesto: <strong>${solicitud.presupuesto}</strong>` : ''}
      </div>
      <a href="http://localhost:3000/dashboard-profesional.html" style="background:#c9920a;color:white;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">Ver solicitud →</a>
      <p style="color:#6b7280;font-size:.8rem;margin-top:20px;">Soluciona Ya — Sexta Región</p>
    </div>`
  );
}

function emailContactoDesbloqueado(clienteEmail, clienteNombre, profNombre, solicitudTitulo) {
  return enviarEmail(clienteEmail,
    `📞 Un profesional quiere contactarte: ${profNombre}`,
    `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e6ed;border-radius:12px;">
      <h2 style="color:#1a2744;">Hola ${clienteNombre},</h2>
      <p>El profesional <strong>${profNombre}</strong> está interesado en tu solicitud:</p>
      <div style="background:#f4f6f9;border-radius:8px;padding:16px;margin:16px 0;"><strong>${solicitudTitulo}</strong></div>
      <p>Pronto te contactará directamente.</p>
      <a href="http://localhost:3000/dashboard-cliente.html" style="background:#1a2744;color:white;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">Ver mis solicitudes →</a>
      <p style="color:#6b7280;font-size:.8rem;margin-top:20px;">Soluciona Ya — Sexta Región</p>
    </div>`
  );
}

function emailNuevaEvaluacion(profEmail, profNombre, estrellas, comentario, clienteNombre) {
  return enviarEmail(profEmail,
    `⭐ Nueva evaluación de ${clienteNombre}`,
    `<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e6ed;border-radius:12px;">
      <h2 style="color:#1a2744;">Hola ${profNombre},</h2>
      <p><strong>${clienteNombre}</strong> te evaluó con <strong>${'⭐'.repeat(estrellas)} (${estrellas}/5)</strong>.</p>
      ${comentario ? `<div style="background:#f4f6f9;border-radius:8px;padding:16px;margin:16px 0;font-style:italic;">"${comentario}"</div>` : ''}
      <a href="http://localhost:3000/dashboard-profesional.html" style="background:#c9920a;color:white;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:700;display:inline-block;">Ver mi perfil →</a>
      <p style="color:#6b7280;font-size:.8rem;margin-top:20px;">Soluciona Ya — Sexta Región</p>
    </div>`
  );
}

// ===================== BASE DE DATOS =====================
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    plan_fecha TEXT,
    plan_expira TEXT,
    comunas_habilitadas TEXT DEFAULT 'Rancagua',
    verificado INTEGER NOT NULL DEFAULT 0,
    cv_experiencia TEXT,
    cv_educacion TEXT,
    cv_habilidades TEXT,
    cv_disponibilidad TEXT,
    sitio_activo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fotos_trabajo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profesional_id INTEGER NOT NULL,
    titulo TEXT,
    datos TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    categoria TEXT NOT NULL,
    comuna TEXT NOT NULL,
    presupuesto TEXT,
    activa INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS contactos_desbloqueados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profesional_id INTEGER NOT NULL,
    solicitud_id INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'nuevo',
    nota TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(profesional_id, solicitud_id)
  );
  CREATE TABLE IF NOT EXISTS evaluaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profesional_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    solicitud_id INTEGER NOT NULL,
    estrellas INTEGER NOT NULL CHECK(estrellas BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(cliente_id, solicitud_id)
  );
  CREATE TABLE IF NOT EXISTS transacciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    monto INTEGER NOT NULL,
    descripcion TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS publicidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    telefono TEXT NOT NULL,
    url TEXT,
    imagen TEXT,
    color_fondo TEXT DEFAULT '#1a2744',
    color_texto TEXT DEFAULT '#ffffff',
    plan TEXT NOT NULL DEFAULT 'semana',
    activo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    expira TEXT
  );
`);

// ===================== DATOS DE EJEMPLO =====================
const hashDemo = bcrypt.hashSync('demo1234', 10);

// Clientes
db.prepare(`INSERT INTO usuarios (nombre,email,password,tipo,telefono,comunas_habilitadas) VALUES (?,?,?,?,?,NULL)`).run('María González','maria@demo.cl',hashDemo,'cliente','+56 9 8765 4321');
db.prepare(`INSERT INTO usuarios (nombre,email,password,tipo,telefono,comunas_habilitadas) VALUES (?,?,?,?,?,NULL)`).run('Pedro Fuentes','pedro@demo.cl',hashDemo,'cliente','+56 9 6543 2100');

// Plan Básico — Carlos (solo Rancagua, Machalí, Graneros)
db.prepare(`INSERT INTO usuarios (nombre,email,password,tipo,telefono,categoria,descripcion,saldo,plan_tipo,comunas_habilitadas) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
  'Carlos Ramírez','carlos@demo.cl',hashDemo,'profesional','+56 9 1234 5678',
  'Electricidad','Electricista certificado con 10 años de experiencia en Rancagua.',
  5000,'basico','Rancagua,Machalí,Graneros'
);

// Plan Pro — Juan (10 comunas zona sur y costera)
db.prepare(`INSERT INTO usuarios (nombre,email,password,tipo,telefono,categoria,descripcion,saldo,plan_activo,plan_tipo,plan_fecha,plan_expira,comunas_habilitadas) VALUES (?,?,?,?,?,?,?,?,1,?,datetime('now'),datetime('now','+30 days'),?)`).run(
  'Juan Sepúlveda','juan@demo.cl',hashDemo,'profesional','+56 9 9876 5432',
  'Gasfitería','Gasfiter certificado Gas SEC. Atiendo toda la zona costera y central de la Sexta Región.',
  8000,'pro','Pichilemu,Navidad,Litueche,La Estrella,Marchigüe,Paredones,San Fernando,Santa Cruz,Palmilla,Pumanque'
);

// Plan Élite — Ana (todas las comunas, verificada)
db.prepare(`INSERT INTO usuarios (nombre,email,password,tipo,telefono,categoria,descripcion,saldo,plan_activo,plan_tipo,plan_fecha,plan_expira,comunas_habilitadas,verificado,sitio_activo,cv_experiencia,cv_habilidades,cv_disponibilidad) VALUES (?,?,?,?,?,?,?,?,1,?,datetime('now'),datetime('now','+30 days'),NULL,1,1,?,?,?)`).run(
  'Ana Morales','ana@demo.cl',hashDemo,'profesional','+56 9 1111 2222',
  'Abogado','Abogada con 15 años en derecho civil, laboral y familia. Atiendo toda la Sexta Región.',
  0,'elite',
  '15 años de ejercicio de la abogacía. Socia fundadora de estudio jurídico en Rancagua. Especialista en derecho laboral y de familia.',
  'Derecho civil, Laboral, Familia, Herencias, Contratos',
  'Lunes a Viernes 9:00 - 18:00, Sábados con cita previa'
);

// Solicitudes en distintas comunas (para generar ranking)
const solicitudesDemo = [
  [1,'Necesito electricista urgente','Tengo 3 enchufes que no funcionan en el living y cocina.','Electricidad','Rancagua','$30.000 - $50.000'],
  [1,'Gasfiter para instalación de lavadora','Necesito instalar llave de paso y conexión para lavadora.','Gasfitería','Machalí','$20.000 - $35.000'],
  [1,'Pintura interior departamento','Pintar 3 piezas y living, paredes lisas.','Pintura','Rancagua','$150.000 - $200.000'],
  [2,'Abogado para divorcio','Necesito asesoría legal para proceso de divorcio.','Abogado','Pichilemu','$80.000 - $150.000'],
  [2,'Gasfiter urgente, fuga de agua','Cañería rota bajo el lavaplatos, agua cayendo.','Gasfitería','Pichilemu','$25.000 - $40.000'],
  [1,'Carpintero para closet a medida','Closet empotrado en dormitorio principal.','Carpintería','Rancagua','$200.000 - $350.000'],
  [2,'Electricista para tablero eléctrico','Corte de luz frecuente, revisar tablero.','Electricidad','San Fernando','$40.000 - $70.000'],
  [1,'Limpieza de casa completa','Limpieza profunda 3 dormitorios, 2 baños, cocina.','Limpieza de Casas','Santa Cruz','$60.000 - $90.000'],
  [2,'Abogado para contrato arriendo','Redactar contrato arriendo propiedad.','Abogado','Rancagua','$50.000 - $80.000'],
  [1,'Jardinero mantención mensual','Jardín 200 m2, poda y corte de césped.','Jardinería','Machalí','$30.000/mes'],
  [2,'Electricista instalación cocina','Instalar cocina eléctrica y campana.','Electricidad','Rancagua','$35.000 - $55.000'],
  [1,'Psicólogo atención adultos','Busco psicólogo para terapia individual, adultos.','Psicólogo','Pichilemu',null],
  [2,'Hostal para semana santa','Necesito 3 noches para 4 personas.','Hostal','Pichilemu','$120.000 - $180.000'],
  [1,'Taxi transfer aeropuerto','Transfer ida y vuelta Rancagua - Santiago.','Taxi / Transfer','Rancagua','$45.000'],
  [2,'Contador declaración de renta','Declaración de renta persona natural.','Contador / Auditor','San Fernando','$30.000 - $50.000'],
];
for (const s of solicitudesDemo) {
  db.prepare(`INSERT INTO solicitudes (cliente_id,titulo,descripcion,categoria,comuna,presupuesto) VALUES (?,?,?,?,?,?)`).run(...s);
}

// Publicidades demo
db.prepare(`INSERT INTO publicidades (empresa,descripcion,telefono,url,color_fondo,color_texto,plan,activo,expira) VALUES (?,?,?,?,?,?,?,1,datetime('now','+30 days'))`).run(
  'Ferretería El Tornillo',
  'Todo en materiales de construcción y ferretería. Despacho a toda la Sexta Región.',
  '+56 9 7654 3210', null, '#1a2744', '#ffffff', 'mes'
);
db.prepare(`INSERT INTO publicidades (empresa,descripcion,telefono,url,color_fondo,color_texto,plan,activo,expira) VALUES (?,?,?,?,?,?,?,1,datetime('now','+7 days'))`).run(
  'Hotel Pichilemu Mar',
  '¡Temporada alta! Habitaciones con vista al mar. Reservas directas con 10% dcto.',
  '+56 9 1122 3344', null, '#b8860b', '#ffffff', 'semana'
);

// ===================== MIDDLEWARE =====================
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Generar íconos PWA dinámicamente
function generarIconoPNG(size) {
  // SVG del ícono -> base64 PNG via Buffer
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size*0.18}" fill="#00a651"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial Black, sans-serif" font-weight="900" font-size="${size*0.42}"
      fill="white">SY</text>
    <text x="50%" y="82%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="${size*0.1}" fill="rgba(255,255,255,0.7)">SOLUCIONA YA</text>
  </svg>`;
  return Buffer.from(svg);
}

app.get('/icon-:size.png', (req, res) => {
  const size = parseInt(req.params.size) || 192;
  const svg = generarIconoPNG(size);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});
app.use(session({ secret: 'preview-secret', resave: false, saveUninitialized: false }));

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
      ? ((Array.isArray(comunas) ? comunas : []).slice(0, 3).join(',') || 'Rancagua')
      : null;
    const r = db.prepare(`INSERT INTO usuarios (nombre,email,password,tipo,telefono,categoria,descripcion,comunas_habilitadas) VALUES (?,?,?,?,?,?,?,?)`).run(
      nombre, email, hashed, tipo, telefono, categoria||null, descripcion||null, comunasStr
    );
    req.session.userId = r.lastInsertRowid;
    req.session.nombre = nombre;
    req.session.tipo = tipo;
    res.json({ ok: true, tipo, nombre });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email ya registrado' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    req.session.userId = user.id;
    req.session.nombre = user.nombre;
    req.session.tipo = user.tipo;
    res.json({ ok: true, tipo: user.tipo, nombre: user.nombre });
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/auth/me', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id,nombre,email,tipo,telefono,categoria,descripcion,saldo,plan_activo,plan_tipo,plan_fecha,plan_expira,comunas_habilitadas,verificado FROM usuarios WHERE id=?').get(req.session.userId);
  const comunas_list = u.comunas_habilitadas ? u.comunas_habilitadas.split(',').map(c => c.trim()).filter(Boolean) : null;
  res.json({ ...u, comunas_list });
});

// ===================== SOLICITUDES =====================
app.get('/api/solicitudes', requireAuth, (req, res) => {
  const { categoria, comuna, buscar } = req.query;
  let q = `SELECT s.id,s.titulo,s.descripcion,s.categoria,s.comuna,s.presupuesto,s.created_at,u.nombre as cliente_nombre FROM solicitudes s JOIN usuarios u ON s.cliente_id=u.id WHERE s.activa=1`;
  const p = [];
  if (categoria) { q += ' AND s.categoria=?'; p.push(categoria); }
  if (comuna) { q += ' AND s.comuna=?'; p.push(comuna); }
  if (buscar) { q += ' AND (s.titulo LIKE ? OR s.descripcion LIKE ?)'; p.push(`%${buscar}%`,`%${buscar}%`); }

  // Profesionales solo ven sus comunas habilitadas (a menos que sea elite)
  if (req.session.tipo === 'profesional' && !comuna) {
    const prof = db.prepare('SELECT plan_tipo, comunas_habilitadas FROM usuarios WHERE id=?').get(req.session.userId);
    if (prof && prof.plan_tipo !== 'elite' && prof.comunas_habilitadas) {
      const comunas = prof.comunas_habilitadas.split(',').map(c => c.trim()).filter(Boolean);
      if (comunas.length) {
        q += ` AND s.comuna IN (${comunas.map(() => '?').join(',')})`;
        p.push(...comunas);
      }
    }
  }

  q += ' ORDER BY s.created_at DESC';
  const rows = db.prepare(q).all(...p);

  if (req.session.tipo === 'profesional') {
    const set = new Set(db.prepare('SELECT solicitud_id FROM contactos_desbloqueados WHERE profesional_id=?').all(req.session.userId).map(d=>d.solicitud_id));
    rows.forEach(s => s.desbloqueado = set.has(s.id));
  }
  res.json(rows);
});

app.get('/api/mis-solicitudes', requireCliente, (req, res) => {
  const r = db.prepare(`SELECT s.*,(SELECT COUNT(*) FROM contactos_desbloqueados WHERE solicitud_id=s.id) as vistas FROM solicitudes s WHERE s.cliente_id=? AND s.activa=1 ORDER BY s.created_at DESC`).all(req.session.userId);
  res.json(r);
});

app.post('/api/solicitudes', requireCliente, async (req, res) => {
  const { titulo, descripcion, categoria, comuna, presupuesto } = req.body;
  if (!titulo||!descripcion||!categoria||!comuna) return res.status(400).json({ error: 'Faltan campos' });
  const r = db.prepare(`INSERT INTO solicitudes (cliente_id,titulo,descripcion,categoria,comuna,presupuesto) VALUES (?,?,?,?,?,?)`).run(req.session.userId,titulo,descripcion,categoria,comuna,presupuesto||null);
  const solicitud = { id: r.lastInsertRowid, titulo, descripcion, categoria, comuna, presupuesto };
  // Notificar profesionales con esa categoría y la commune en su cobertura
  const profs = db.prepare(`SELECT email,nombre,plan_tipo,comunas_habilitadas FROM usuarios WHERE tipo='profesional' AND categoria=?`).all(categoria);
  for (const prof of profs) {
    const lista = prof.plan_tipo === 'elite' ? null : (prof.comunas_habilitadas || '').split(',').map(c=>c.trim());
    if (!lista || lista.includes(comuna)) {
      emailNuevaSolicitud(prof.email, prof.nombre, solicitud);
    }
  }
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.delete('/api/solicitudes/:id', requireCliente, (req, res) => {
  const s = db.prepare('SELECT id FROM solicitudes WHERE id=? AND cliente_id=?').get(req.params.id, req.session.userId);
  if (!s) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE solicitudes SET activa=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===================== WALLET =====================
app.post('/api/wallet/recargar', requireProfesional, (req, res) => {
  const { monto } = req.body;
  if (![5000,10000,20000,50000].includes(Number(monto))) return res.status(400).json({ error: 'Monto inválido' });
  db.prepare('UPDATE usuarios SET saldo=saldo+? WHERE id=?').run(monto, req.session.userId);
  db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(req.session.userId,'recarga',monto,`Recarga $${Number(monto).toLocaleString('es-CL')}`);
  const u = db.prepare('SELECT saldo FROM usuarios WHERE id=?').get(req.session.userId);
  res.json({ ok: true, saldo: u.saldo });
});

app.post('/api/wallet/desbloquear/:solicitudId', requireProfesional, async (req, res) => {
  const sid = parseInt(req.params.solicitudId);
  if (db.prepare('SELECT id FROM contactos_desbloqueados WHERE profesional_id=? AND solicitud_id=?').get(req.session.userId,sid))
    return res.status(400).json({ error: 'Ya desbloqueaste esta solicitud' });
  const sol = db.prepare(`SELECT s.*,u.nombre,u.telefono,u.email,u.id as cliente_id FROM solicitudes s JOIN usuarios u ON s.cliente_id=u.id WHERE s.id=? AND s.activa=1`).get(sid);
  if (!sol) return res.status(404).json({ error: 'No encontrada' });
  const user = db.prepare('SELECT saldo,plan_tipo,nombre FROM usuarios WHERE id=?').get(req.session.userId);
  const costo = COSTO_LEAD[user.plan_tipo] || COSTO_LEAD.basico;
  if (user.saldo < costo) return res.status(400).json({ error: `Saldo insuficiente. Necesitas ${costo > 0 ? formatMoneyServer(costo) : '$0'} en tu billetera.` });
  db.transaction(() => {
    if (costo > 0) db.prepare('UPDATE usuarios SET saldo=saldo-? WHERE id=?').run(costo, req.session.userId);
    db.prepare('INSERT INTO contactos_desbloqueados (profesional_id,solicitud_id) VALUES (?,?)').run(req.session.userId,sid);
    const desc = costo === 0 ? `Contacto #${sid} (gratis, Plan Élite)` :
                 costo < 1000 ? `Contacto #${sid} (50% dcto, Plan Pro)` :
                 `Contacto #${sid}`;
    db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(req.session.userId,'desbloqueo',-costo,desc);
  })();
  // Email al cliente
  const cliente = db.prepare('SELECT nombre,email FROM usuarios WHERE id=?').get(sol.cliente_id);
  if (cliente) emailContactoDesbloqueado(cliente.email, cliente.nombre, user.nombre, sol.titulo);
  res.json({ ok: true, contacto: { nombre: sol.nombre, telefono: sol.telefono, email: sol.email }, saldo: user.saldo - costo, costo });
});

app.get('/api/contacto/:solicitudId', requireProfesional, (req, res) => {
  const sid = parseInt(req.params.solicitudId);
  if (!db.prepare('SELECT id FROM contactos_desbloqueados WHERE profesional_id=? AND solicitud_id=?').get(req.session.userId,sid))
    return res.status(403).json({ error: 'Debes desbloquear primero' });
  const r = db.prepare(`SELECT u.nombre,u.telefono,u.email FROM solicitudes s JOIN usuarios u ON s.cliente_id=u.id WHERE s.id=?`).get(sid);
  res.json(r);
});

app.get('/api/transacciones', requireProfesional, (req, res) => {
  res.json(db.prepare('SELECT * FROM transacciones WHERE usuario_id=? ORDER BY created_at DESC LIMIT 30').all(req.session.userId));
});

// ===================== ESTADÍSTICAS COMUNAS =====================
app.get('/api/stats/comunas', (req, res) => {
  const rows = db.prepare(`SELECT comuna, COUNT(*) as total FROM solicitudes WHERE activa=1 GROUP BY comuna ORDER BY total DESC`).all();
  res.json(rows);
});

// ===================== PROFESIONALES =====================
// Élite primero, luego Pro, luego Básico ("1er lugar en búsqueda")
app.get('/api/profesionales', requireAuth, (req, res) => {
  const { categoria } = req.query;
  let q = `SELECT id,nombre,categoria,descripcion,plan_tipo,verificado,created_at FROM usuarios WHERE tipo='profesional'`;
  const p = [];
  if (categoria) { q += ' AND categoria=?'; p.push(categoria); }
  q += ` ORDER BY CASE plan_tipo WHEN 'elite' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END, created_at DESC`;
  res.json(db.prepare(q).all(...p));
});

// Directorio público (sin auth requerida)
app.get('/api/profesionales/publicos', (req, res) => {
  const profs = db.prepare(`
    SELECT u.id, u.nombre, u.categoria, u.descripcion,
           u.plan_tipo, u.verificado, u.sitio_activo, u.created_at,
           ROUND(AVG(ev.estrellas),1) as promedio,
           COUNT(ev.id) as total_eval
    FROM usuarios u
    LEFT JOIN evaluaciones ev ON ev.profesional_id = u.id
    WHERE u.tipo = 'profesional'
    GROUP BY u.id
    ORDER BY
      CASE u.plan_tipo WHEN 'elite' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END,
      promedio DESC NULLS LAST,
      u.created_at DESC
  `).all();
  res.json(profs);
});

app.post('/api/auth/descripcion', requireAuth, (req, res) => {
  const { descripcion } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'Falta la descripción' });
  db.prepare('UPDATE usuarios SET descripcion=? WHERE id=?').run(descripcion, req.session.userId);
  res.json({ ok: true });
});

// ===================== SUSCRIPCIÓN DE PLANES =====================
app.post('/api/plan/suscribir', requireProfesional, (req, res) => {
  const { tipo } = req.body; // 'pro' | 'elite'
  if (!['pro','elite'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  const costo = tipo === 'pro' ? COSTO_PRO : COSTO_ELITE;
  db.prepare(`UPDATE usuarios SET plan_tipo=?, plan_activo=1, plan_fecha=datetime('now'), plan_expira=datetime('now','+30 days') WHERE id=?`).run(tipo, req.session.userId);
  if (tipo === 'elite') {
    db.prepare('UPDATE usuarios SET comunas_habilitadas=NULL WHERE id=?').run(req.session.userId);
  }
  db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(
    req.session.userId, 'plan', -costo, `Suscripción Plan ${tipo === 'pro' ? 'Pro' : 'Élite'} — 30 días`
  );
  const u = db.prepare('SELECT plan_tipo,plan_expira,comunas_habilitadas FROM usuarios WHERE id=?').get(req.session.userId);
  const comunas_list = u.comunas_habilitadas ? u.comunas_habilitadas.split(',').map(c=>c.trim()).filter(Boolean) : null;
  res.json({ ok: true, plan_tipo: u.plan_tipo, plan_expira: u.plan_expira, comunas_list });
});

// Legacy plan endpoint
app.post('/api/plan/activar', requireProfesional, (req, res) => {
  const user = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.session.userId);
  if (user.plan_activo && user.plan_tipo !== 'basico') return res.status(400).json({ error: 'Ya tienes un plan activo' });
  db.prepare(`UPDATE usuarios SET plan_activo=1, plan_fecha=datetime('now') WHERE id=?`).run(req.session.userId);
  db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(
    req.session.userId, 'plan', -15000, 'Activación plan profesional $15.000'
  );
  res.json({ ok: true, plan_activo: true });
});

// ===================== COMUNAS HABILITADAS =====================
app.post('/api/perfil/comunas', requireProfesional, (req, res) => {
  const { comunas } = req.body;
  if (!Array.isArray(comunas)) return res.status(400).json({ error: 'comunas debe ser un array' });
  const user = db.prepare('SELECT plan_tipo FROM usuarios WHERE id=?').get(req.session.userId);
  const maxC = MAX_COMUNAS[user.plan_tipo] || 3;
  const limited = comunas.slice(0, maxC).filter(Boolean);
  db.prepare('UPDATE usuarios SET comunas_habilitadas=? WHERE id=?').run(limited.join(','), req.session.userId);
  res.json({ ok: true, comunas_habilitadas: limited });
});

// ===================== FOTOS =====================
app.get('/api/fotos', requireProfesional, (req, res) => {
  res.json(db.prepare('SELECT id,titulo,datos,created_at FROM fotos_trabajo WHERE profesional_id=? ORDER BY created_at DESC').all(req.session.userId));
});

app.post('/api/fotos', requireProfesional, (req, res) => {
  const user = db.prepare('SELECT plan_activo,plan_tipo FROM usuarios WHERE id=?').get(req.session.userId);
  if (!user.plan_activo && user.plan_tipo === 'basico') return res.status(403).json({ error: 'Necesitas activar un plan para subir fotos' });
  const { titulo, datos } = req.body;
  if (!datos) return res.status(400).json({ error: 'Falta la imagen' });
  const count = db.prepare('SELECT COUNT(*) as c FROM fotos_trabajo WHERE profesional_id=?').get(req.session.userId);
  if (count.c >= 10) return res.status(400).json({ error: 'Máximo 10 fotos permitidas' });
  const r = db.prepare('INSERT INTO fotos_trabajo (profesional_id,titulo,datos) VALUES (?,?,?)').run(req.session.userId, titulo||'Mi trabajo', datos);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.delete('/api/fotos/:id', requireProfesional, (req, res) => {
  db.prepare('DELETE FROM fotos_trabajo WHERE id=? AND profesional_id=?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

app.get('/api/fotos/profesional/:id', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id,titulo,datos,created_at FROM fotos_trabajo WHERE profesional_id=? ORDER BY created_at DESC').all(req.params.id));
});

// ===================== PROFESIONALES DE UNA SOLICITUD =====================
app.get('/api/solicitud/:id/profesionales', requireCliente, (req, res) => {
  const sol = db.prepare('SELECT id FROM solicitudes WHERE id=? AND cliente_id=?').get(req.params.id, req.session.userId);
  if (!sol) return res.status(403).json({ error: 'No autorizado' });
  const profs = db.prepare(`
    SELECT u.id, u.nombre, u.categoria, u.descripcion, cd.estado,
           ev.estrellas, ev.comentario
    FROM contactos_desbloqueados cd
    JOIN usuarios u ON cd.profesional_id = u.id
    LEFT JOIN evaluaciones ev ON ev.profesional_id = u.id AND ev.solicitud_id = cd.solicitud_id AND ev.cliente_id = ?
    WHERE cd.solicitud_id = ?
  `).all(req.session.userId, req.params.id);
  res.json(profs);
});

// ===================== SEGUIMIENTO =====================
app.patch('/api/contacto/:solicitudId/estado', requireProfesional, (req, res) => {
  const { estado, nota } = req.body;
  const validos = ['nuevo','contactado','cotizado','en_trabajo','finalizado','sin_respuesta'];
  if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  db.prepare('UPDATE contactos_desbloqueados SET estado=?, nota=? WHERE profesional_id=? AND solicitud_id=?')
    .run(estado, nota || null, req.session.userId, req.params.solicitudId);
  res.json({ ok: true });
});

app.get('/api/mis-contactos-detalle', requireProfesional, (req, res) => {
  const rows = db.prepare(`
    SELECT cd.solicitud_id, cd.estado, cd.nota, cd.created_at,
           s.titulo, s.descripcion, s.categoria, s.comuna, s.presupuesto,
           u.nombre as cliente_nombre, u.telefono as cliente_tel, u.email as cliente_email,
           ev.estrellas as eval_estrellas, ev.comentario as eval_comentario
    FROM contactos_desbloqueados cd
    JOIN solicitudes s ON cd.solicitud_id = s.id
    JOIN usuarios u ON s.cliente_id = u.id
    LEFT JOIN evaluaciones ev ON ev.solicitud_id = cd.solicitud_id AND ev.profesional_id = cd.profesional_id
    WHERE cd.profesional_id = ?
    ORDER BY cd.created_at DESC
  `).all(req.session.userId);
  res.json(rows);
});

// ===================== EVALUACIONES =====================
app.post('/api/evaluar/:solicitudId', requireCliente, async (req, res) => {
  const { estrellas, comentario, profesionalId } = req.body;
  if (!estrellas || estrellas < 1 || estrellas > 5) return res.status(400).json({ error: 'Estrellas inválidas (1-5)' });
  if (!profesionalId) return res.status(400).json({ error: 'Falta profesionalId' });
  const desb = db.prepare('SELECT id FROM contactos_desbloqueados WHERE profesional_id=? AND solicitud_id=?').get(profesionalId, req.params.solicitudId);
  if (!desb) return res.status(403).json({ error: 'Este profesional no desbloqueó esta solicitud' });
  try {
    db.prepare('INSERT INTO evaluaciones (profesional_id,cliente_id,solicitud_id,estrellas,comentario) VALUES (?,?,?,?,?)').run(
      profesionalId, req.session.userId, req.params.solicitudId, estrellas, comentario || null
    );
    const prof = db.prepare('SELECT email,nombre FROM usuarios WHERE id=?').get(profesionalId);
    const cliente = db.prepare('SELECT nombre FROM usuarios WHERE id=?').get(req.session.userId);
    if (prof && cliente) emailNuevaEvaluacion(prof.email, prof.nombre, estrellas, comentario, cliente.nombre);
    res.json({ ok: true });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ya evaluaste este trabajo' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/evaluaciones/:profesionalId', (req, res) => {
  const rows = db.prepare(`
    SELECT ev.estrellas, ev.comentario, ev.created_at,
           u.nombre as cliente_nombre, s.titulo as solicitud_titulo
    FROM evaluaciones ev
    JOIN usuarios u ON ev.cliente_id = u.id
    JOIN solicitudes s ON ev.solicitud_id = s.id
    WHERE ev.profesional_id = ?
    ORDER BY ev.created_at DESC
  `).all(req.params.profesionalId);
  const promedio = rows.length ? (rows.reduce((a,r)=>a+r.estrellas,0)/rows.length).toFixed(1) : null;
  res.json({ evaluaciones: rows, promedio, total: rows.length });
});

// ===================== MINI SITIO / CV =====================
app.post('/api/perfil/cv', requireProfesional, (req, res) => {
  const { cv_experiencia, cv_educacion, cv_habilidades, cv_disponibilidad, sitio_activo } = req.body;
  db.prepare(`UPDATE usuarios SET cv_experiencia=?, cv_educacion=?, cv_habilidades=?, cv_disponibilidad=?, sitio_activo=? WHERE id=?`)
    .run(cv_experiencia||null, cv_educacion||null, cv_habilidades||null, cv_disponibilidad||null, sitio_activo?1:0, req.session.userId);
  res.json({ ok: true });
});

app.get('/api/perfil/publico/:id', (req, res) => {
  const u = db.prepare(`SELECT id,nombre,categoria,descripcion,cv_experiencia,cv_educacion,cv_habilidades,cv_disponibilidad,sitio_activo,plan_tipo,verificado,created_at FROM usuarios WHERE id=? AND tipo='profesional'`).get(req.params.id);
  if (!u) return res.status(404).json({ error: 'No encontrado' });
  const fotos = db.prepare('SELECT id,titulo,datos FROM fotos_trabajo WHERE profesional_id=? ORDER BY created_at DESC').all(req.params.id);
  const evRows = db.prepare(`SELECT ev.estrellas,ev.comentario,ev.created_at,u.nombre as cliente_nombre FROM evaluaciones ev JOIN usuarios u ON ev.cliente_id=u.id WHERE ev.profesional_id=? ORDER BY ev.created_at DESC LIMIT 10`).all(req.params.id);
  const promedio = evRows.length ? (evRows.reduce((a,r)=>a+r.estrellas,0)/evRows.length).toFixed(1) : null;
  res.json({ ...u, fotos, evaluaciones: evRows, promedio, total: evRows.length });
});

// ===================== ADMIN =====================
app.get('/api/admin/usuarios', (req, res) => {
  const users = db.prepare(`
    SELECT id, nombre, email, tipo, telefono, categoria, saldo,
           plan_activo, plan_tipo, plan_expira, verificado,
           comunas_habilitadas, created_at
    FROM usuarios ORDER BY tipo, created_at DESC
  `).all();
  res.json(users);
});

app.get('/api/admin/stats-comunas', (req, res) => {
  const rows = db.prepare(`SELECT comuna, COUNT(*) as total FROM solicitudes GROUP BY comuna ORDER BY total DESC`).all();
  res.json(rows);
});

app.post('/api/admin/acreditar', (req, res) => {
  const { userId, monto } = req.body;
  if (!userId || !monto || monto < 1000) return res.status(400).json({ error: 'Datos inválidos' });
  db.prepare('UPDATE usuarios SET saldo = saldo + ? WHERE id = ?').run(monto, userId);
  db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(
    userId, 'recarga', monto, `Recarga manual transferencia: ${formatMoneyServer(monto)}`
  );
  res.json({ ok: true });
});

app.post('/api/admin/activar-plan', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Falta userId' });
  db.prepare(`UPDATE usuarios SET plan_activo=1, plan_fecha=datetime('now') WHERE id=?`).run(userId);
  db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(
    userId, 'plan', -15000, 'Plan Profesional activado manualmente'
  );
  res.json({ ok: true });
});

app.post('/api/admin/activar-suscripcion', (req, res) => {
  const { userId, tipo } = req.body; // tipo: 'pro' | 'elite'
  if (!userId || !['pro','elite'].includes(tipo)) return res.status(400).json({ error: 'Datos inválidos' });
  db.prepare(`UPDATE usuarios SET plan_tipo=?, plan_activo=1, plan_fecha=datetime('now'), plan_expira=datetime('now','+30 days') WHERE id=?`).run(tipo, userId);
  if (tipo === 'elite') {
    db.prepare('UPDATE usuarios SET comunas_habilitadas=NULL, verificado=1 WHERE id=?').run(userId);
  }
  const costo = tipo === 'pro' ? 9990 : 24990;
  db.prepare('INSERT INTO transacciones (usuario_id,tipo,monto,descripcion) VALUES (?,?,?,?)').run(
    userId, 'plan', -costo, `Plan ${tipo} activado manualmente por admin (transferencia bancaria)`
  );
  res.json({ ok: true });
});

// ===================== PUBLICIDAD =====================

// Validación teléfono chileno
function validarTelefonoChileno(tel) {
  const limpio = tel.replace(/\s/g, '');
  return /^(\+?56)?0?9\d{8}$/.test(limpio);
}

app.get('/api/publicidad', (req, res) => {
  const ads = db.prepare(`SELECT id,empresa,descripcion,telefono,url,imagen,color_fondo,color_texto,plan FROM publicidades WHERE activo=1 AND (expira IS NULL OR expira > datetime('now')) ORDER BY CASE plan WHEN 'mes' THEN 1 ELSE 2 END, created_at ASC`).all();
  res.json(ads);
});

app.post('/api/publicidad/solicitar', (req, res) => {
  const { empresa, descripcion, telefono, url, imagen, color_fondo, color_texto, plan } = req.body;
  if (!empresa || !descripcion || !telefono) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!validarTelefonoChileno(telefono)) return res.status(400).json({ error: 'Teléfono inválido. Usa formato chileno: +56 9 XXXX XXXX' });
  const planesValidos = ['semana', 'mes'];
  if (!planesValidos.includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
  const r = db.prepare(`INSERT INTO publicidades (empresa,descripcion,telefono,url,imagen,color_fondo,color_texto,plan) VALUES (?,?,?,?,?,?,?,?)`).run(
    empresa, descripcion, telefono, url||null, imagen||null,
    color_fondo||'#1a2744', color_texto||'#ffffff', plan
  );
  res.json({ ok: true, id: r.lastInsertRowid, msg: 'Solicitud recibida. Se activará tras verificar tu pago.' });
});

// Admin publicidad
app.get('/api/admin/publicidades', (req, res) => {
  res.json(db.prepare('SELECT * FROM publicidades ORDER BY created_at DESC').all());
});

app.post('/api/admin/publicidad/activar', (req, res) => {
  const { id, dias } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta id' });
  const d = dias || 30;
  db.prepare(`UPDATE publicidades SET activo=1, expira=datetime('now','+${d} days') WHERE id=?`).run(id);
  res.json({ ok: true });
});

app.post('/api/admin/publicidad/desactivar', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta id' });
  db.prepare('UPDATE publicidades SET activo=0 WHERE id=?').run(id);
  res.json({ ok: true });
});

app.delete('/api/admin/publicidad/:id', (req, res) => {
  db.prepare('DELETE FROM publicidades WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

function formatMoneyServer(n) { return `$${Number(n).toLocaleString('es-CL')}`; }

// ===================== START =====================
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
  const ip = getLocalIP();
  const url = `http://${ip}:3000`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#006633', light: '#ffffff' } });
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escanear QR — Soluciona Ya</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f4f6f9; padding:24px;">
  <nav class="navbar" style="position:fixed; top:0; left:0; right:0;">
    <a href="/" class="navbar-brand">🏘️ Soluciona <span class="brand-ya">Ya</span></a>
  </nav>
  <div style="background:white; border-radius:20px; padding:40px 36px; box-shadow:0 8px 40px rgba(0,0,0,.12); text-align:center; max-width:360px; width:100%; margin-top:80px;">
    <div style="font-size:2.5rem; margin-bottom:10px;">📱</div>
    <h1 style="font-size:1.4rem; font-weight:900; color:#111827; margin-bottom:6px;">Abre en tu celular</h1>
    <p style="color:#6b7280; font-size:.9rem; margin-bottom:24px;">Escanea con la cámara o con Expo Go</p>
    <img src="${qrDataUrl}" style="width:240px; height:240px; border-radius:12px; border:3px solid #00a651;" alt="QR Code">
    <div style="margin-top:20px; background:#f0fdf4; border-radius:12px; padding:14px;">
      <div style="font-size:.75rem; color:#6b7280; font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px;">URL del sitio</div>
      <div style="font-size:1.05rem; font-weight:800; color:#006633; font-family:monospace;">${url}</div>
    </div>
    <div style="margin-top:16px; font-size:.82rem; color:#6b7280; line-height:1.6;">
      📶 Asegúrate de estar en la <strong>misma red WiFi</strong><br>
      🤳 iPhone: cámara nativa · Android: cámara o Expo Go
    </div>
  </div>
</body>
</html>`);
});

app.listen(3000, () => console.log('🚀 Preview en http://localhost:3000'));
