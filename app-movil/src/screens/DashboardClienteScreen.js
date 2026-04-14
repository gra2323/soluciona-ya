import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { colors, radius, shadow } from '../theme';
import { api } from '../api';

const COMUNAS = [
  'Rancagua','Machalí','Graneros','Rengo','San Vicente','San Fernando',
  'Santa Cruz','Pichilemu','Chimbarongo','Peumo','Mostazal','Codegua',
];

const CATEGORIAS = [
  'Electricidad','Gasfitería','Carpintería','Pintura','Jardinería',
  'Construcción','Climatización','Cerrajería','Limpieza de Casas',
  'Transporte y Fletes','Computación y Tecnología','Centro de Eventos Infantiles',
  'Abogado','Médico / Especialista','Otro'
];

export default function DashboardClienteScreen({ navigation }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', categoria: '', comuna: '', presupuesto: '' });
  const [sending, setSending] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const data = await api.solicitudes();
      setSolicitudes(data);
    } catch (e) {
      if (e.message.includes('autenticado')) navigation.replace('Auth');
    } finally { setLoading(false); }
  }

  async function enviarSolicitud() {
    if (!form.titulo || !form.categoria || !form.comuna)
      return Alert.alert('Completa título, categoría y comuna');
    setSending(true);
    try {
      await api.crearSolicitud(form);
      setModal(false);
      setForm({ titulo: '', descripcion: '', categoria: '', comuna: '', presupuesto: '' });
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSending(false); }
  }

  async function cerrarSesion() {
    await api.logout().catch(() => {});
    navigation.replace('Auth');
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Mis solicitudes</Text>
        <TouchableOpacity onPress={cerrarSesion}>
          <Text style={s.salir}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Botón nueva solicitud */}
      <TouchableOpacity style={s.btnNueva} onPress={() => setModal(true)}>
        <Text style={s.btnNuevaText}>+ Nueva solicitud</Text>
      </TouchableOpacity>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {!solicitudes.length && (
            <View style={s.empty}><Text style={s.emptyText}>Aún no tienes solicitudes</Text></View>
          )}
          {solicitudes.map(sol => (
            <View key={sol.id} style={s.card}>
              <Text style={s.cardTitulo}>{sol.titulo}</Text>
              <Text style={s.cardMeta}>{sol.categoria} · {sol.comuna}</Text>
              {sol.presupuesto > 0 && <Text style={s.cardPres}>Presupuesto: ${sol.presupuesto?.toLocaleString('es-CL')}</Text>}
              <View style={s.cardFooter}>
                <Text style={s.cardDate}>{new Date(sol.created_at).toLocaleDateString('es-CL')}</Text>
                <Text style={sol.total_contactos > 0 ? s.badgeGreen : s.badgeGray}>
                  {sol.total_contactos || 0} contacto{sol.total_contactos !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal nueva solicitud */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={s.modal} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nueva solicitud</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>Título *</Text>
          <TextInput style={s.input} placeholder="Ej: Necesito electricista urgente" value={form.titulo} onChangeText={v => set('titulo', v)} />

          <Text style={s.label}>Descripción</Text>
          <TextInput style={[s.input, { height: 80 }]} multiline placeholder="Describe el trabajo..." value={form.descripcion} onChangeText={v => set('descripcion', v)} />

          <Text style={s.label}>Categoría *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {CATEGORIAS.map(c => (
              <TouchableOpacity key={c} style={[s.chip, form.categoria === c && s.chipActive]} onPress={() => set('categoria', c)}>
                <Text style={form.categoria === c ? s.chipTextActive : s.chipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Comuna *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {COMUNAS.map(c => (
              <TouchableOpacity key={c} style={[s.chip, form.comuna === c && s.chipActive]} onPress={() => set('comuna', c)}>
                <Text style={form.comuna === c ? s.chipTextActive : s.chipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Presupuesto (opcional)</Text>
          <TextInput style={s.input} placeholder="Ej: 50000" keyboardType="numeric" value={form.presupuesto} onChangeText={v => set('presupuesto', v)} />

          <TouchableOpacity style={s.btnEnviar} onPress={enviarSolicitud} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnEnviarText}>Publicar solicitud</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primary, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  salir: { color: 'rgba(255,255,255,.8)', fontSize: 14 },
  btnNueva: { margin: 16, backgroundColor: colors.secondary, padding: 14, borderRadius: radius.full, alignItems: 'center' },
  btnNuevaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.textLight, fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, ...shadow, borderLeftWidth: 4, borderLeftColor: colors.primary },
  cardTitulo: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardMeta: { fontSize: 13, color: colors.textLight },
  cardPres: { fontSize: 13, color: colors.primary, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  cardDate: { fontSize: 12, color: colors.textLight },
  badgeGreen: { fontSize: 12, fontWeight: '700', color: '#059669', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGray:  { fontSize: 12, fontWeight: '700', color: colors.textLight, backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },

  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: { fontSize: 20, color: colors.textLight },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: colors.text },
  input: { backgroundColor: '#f9fafb', borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 14, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff', marginRight: 8 },
  chipActive: { borderColor: colors.primary, backgroundColor: '#e8f5e9' },
  chipText: { fontSize: 13, color: colors.textLight },
  chipTextActive: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  btnEnviar: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.full, alignItems: 'center', marginTop: 8 },
  btnEnviarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
