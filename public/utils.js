const CATEGORIAS = [
  // Profesionales del hogar
  'Electricidad', 'Gasfitería', 'Carpintería', 'Pintura', 'Jardinería',
  'Mecánica Automotriz', 'Construcción', 'Climatización', 'Cerrajería',
  'Limpieza de Casas', 'Aseo y Limpieza', 'Plomería',
  // Artículos y productos
  'Artículos de Aseo', 'Artículos del Hogar', 'Venta de Productos',
  // Alojamiento y turismo
  'Hostal', 'Hotel', 'Cabaña / Arriendo Temporal', 'Apart Hotel',
  // Transporte
  'Transporte y Fletes', 'Taxi / Transfer', 'Uber / App de Transporte',
  // Profesionales técnicos y servicios
  'Computación y Tecnología', 'Clases Particulares',
  'Belleza y Cuidado Personal', 'Salud y Bienestar',
  'Fotografía y Video', 'Cocina y Catering',
  'Centro de Eventos Infantiles',
  // Profesionales universitarios
  'Abogado', 'Arquitecto', 'Contador / Auditor', 'Ingeniero',
  'Médico / Especialista', 'Psicólogo', 'Nutricionista', 'Kinesiólogo',
  'Enfermero / Técnico en Salud', 'Diseñador Gráfico', 'Otro'
];

const COMUNAS = [
  'Rancagua', 'Machalí', 'Graneros', 'Codegua', 'Requínoa', 'Rengo',
  'San Vicente', 'Peumo', 'Pichidegua', 'Las Cabras', 'Quinta de Tilcoco',
  'Olivar', 'Mostazal', 'Coinco', 'Coltauco', 'Doñihue', 'San Fernando',
  'Chimbarongo', 'Nancagua', 'Placilla', 'Lolol', 'Peralillo',
  'Santa Cruz', 'Palmilla', 'Pumanque', 'Pichilemu', 'Navidad',
  'Litueche', 'La Estrella', 'Marchigüe', 'Paredones'
];

function formatMoney(amount) {
  return `$${Number(amount).toLocaleString('es-CL')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAlert(container, message, type = 'danger') {
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  if (type !== 'danger') setTimeout(() => { container.innerHTML = ''; }, 5000);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

async function checkAuth() {
  try { return await apiFetch('/api/auth/me'); }
  catch { return null; }
}

function populateSelect(select, options, defaultText = 'Seleccionar...') {
  select.innerHTML = `<option value="">${defaultText}</option>`;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt; o.textContent = opt;
    select.appendChild(o);
  });
}
