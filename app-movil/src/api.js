// Cambia esta URL por la IP de tu computador cuando pruebes en celular
// Ejemplo: 'http://192.168.0.2:3000'
// En producción: 'https://tu-dominio.com'
export const API_URL = 'http://192.168.0.2:3000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

export const api = {
  me:             ()         => apiFetch('/api/auth/me'),
  login:          (body)     => apiFetch('/api/auth/login',    { method: 'POST', body }),
  registro:       (body)     => apiFetch('/api/auth/registro', { method: 'POST', body }),
  logout:         ()         => apiFetch('/api/auth/logout',   { method: 'POST' }),

  solicitudes:    ()         => apiFetch('/api/solicitudes'),
  crearSolicitud: (body)     => apiFetch('/api/solicitudes',   { method: 'POST', body }),

  profesionales:  ()         => apiFetch('/api/profesionales/publicos'),
  perfil:         (id)       => apiFetch(`/api/perfil/${id}`),
  miPerfil:       ()         => apiFetch('/api/perfil/me'),
  actualizarPerfil:(body)    => apiFetch('/api/perfil/me',     { method: 'PUT', body }),

  desbloquear:    (id)       => apiFetch('/api/wallet/desbloquear', { method: 'POST', body: { solicitudId: id } }),
  saldo:          ()         => apiFetch('/api/wallet/saldo'),
  transacciones:  ()         => apiFetch('/api/wallet/transacciones'),

  publicidad:     ()         => apiFetch('/api/publicidad'),
};
