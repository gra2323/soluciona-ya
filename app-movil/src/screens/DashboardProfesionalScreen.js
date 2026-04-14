import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal
} from 'react-native';
import { colors, radius, shadow } from '../theme';
import { api } from '../api';

export default function DashboardProfesionalScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null); // solicitud a desbloquear

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [me, sols, w] = await Promise.all([api.me(), api.solicitudes(), api.saldo()]);
      setUser(me);
      setSolicitudes(sols);
      setSaldo(w.saldo || 0);
    } catch (e) {
      if (e.message.includes('autenticado')) navigation.replace('Auth');
    } finally { setLoading(false); }
  }

  async function desbloquear(sol) {
    try {
      await api.desbloquear(sol.id);
      setConfirmModal(null);
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function cerrarSesion() {
    await api.logout().catch(() => {});
    navigation.replace('Auth');
  }

  const planColor = { elite: '#92400e', pro: '#1d4ed8', basico: colors.textLight };
  const planBg    = { elite: '#fef3c7', pro: '#dbeafe', basico: '#f3f4f6' };
  const planLabel = { elite: '👑 ÉLITE', pro: '⭐ PRO', basico: 'Básico' };
  const costoPlan = { basico: '$1.000', pro: '$500', elite: 'Gratis' };

  if (loading) return <ActivityIndicator style={{ flex: 1, marginTop: 100 }} color={colors.primary} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerName}>{user?.nombre}</Text>
          <View style={[s.planBadge, { backgroundColor: planBg[user?.plan_tipo || 'basico'] }]}>
            <Text style={[s.planBadgeText, { color: planColor[user?.plan_tipo || 'basico'] }]}>
              {planLabel[user?.plan_tipo || 'basico']}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={s.saldoText}>Saldo: ${saldo.toLocaleString('es-CL')}</Text>
          <TouchableOpacity onPress={cerrarSesion}><Text style={s.salir}>Salir</Text></TouchableOpacity>
        </View>
      </View>

      {/* Info plan */}
      <View style={s.infoBanner}>
        <Text style={s.infoBannerText}>
          Costo por contacto: <Text style={{ fontWeight: '800' }}>{costoPlan[user?.plan_tipo || 'basico']}</Text>
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Planes')}>
          <Text style={s.infoBannerLink}>Mejorar plan →</Text>
        </TouchableOpacity>
      </View>

      {/* Solicitudes */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={s.sectionTitle}>Solicitudes disponibles ({solicitudes.length})</Text>
        {!solicitudes.length && (
          <View style={s.empty}><Text style={s.emptyText}>No hay solicitudes en tu zona</Text></View>
        )}
        {solicitudes.map(sol => (
          <View key={sol.id} style={[s.card, sol.desbloqueada && s.cardDesbloqueada]}>
            <Text style={s.cardTitulo}>{sol.titulo}</Text>
            <Text style={s.cardMeta}>{sol.categoria} · {sol.comuna}</Text>
            {sol.descripcion ? <Text style={s.cardDesc} numberOfLines={2}>{sol.descripcion}</Text> : null}
            {sol.presupuesto > 0 && <Text style={s.cardPres}>Presupuesto: ${sol.presupuesto?.toLocaleString('es-CL')}</Text>}

            {sol.desbloqueada ? (
              <View style={s.contactBox}>
                <Text style={s.contactLabel}>Datos de contacto</Text>
                <Text style={s.contactData}>📞 {sol.cliente_telefono}</Text>
                <Text style={s.contactData}>✉️ {sol.cliente_email}</Text>
              </View>
            ) : (
              <TouchableOpacity style={s.btnDesbloquear} onPress={() => setConfirmModal(sol)}>
                <Text style={s.btnDesbloquearText}>🔓 Desbloquear contacto — {costoPlan[user?.plan_tipo || 'basico']}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Modal confirmar desbloqueo */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Desbloquear contacto</Text>
            <Text style={s.modalText}>
              ¿Desbloquear "{confirmModal?.titulo}"?{'\n'}
              Se descontará {costoPlan[user?.plan_tipo || 'basico']} de tu saldo.
            </Text>
            <View style={s.modalButtons}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setConfirmModal(null)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnConfirm} onPress={() => desbloquear(confirmModal)}>
                <Text style={s.btnConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.primary, padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  planBadgeText: { fontSize: 12, fontWeight: '700' },
  saldoText: { color: 'rgba(255,255,255,.9)', fontSize: 13, fontWeight: '600' },
  salir: { color: 'rgba(255,255,255,.6)', fontSize: 13 },

  infoBanner: { backgroundColor: '#e8f5e9', padding: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoBannerText: { fontSize: 13, color: colors.text },
  infoBannerLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.textLight },

  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, ...shadow, borderLeftWidth: 4, borderLeftColor: colors.primaryDark },
  cardDesbloqueada: { borderLeftColor: colors.secondary },
  cardTitulo: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: colors.textLight },
  cardDesc: { fontSize: 13, color: '#4b5563', marginTop: 6, lineHeight: 18 },
  cardPres: { fontSize: 13, color: colors.primary, marginTop: 4 },

  btnDesbloquear: { marginTop: 12, backgroundColor: colors.primary, padding: 11, borderRadius: radius.full, alignItems: 'center' },
  btnDesbloquearText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  contactBox: { marginTop: 12, backgroundColor: '#e8f5e9', borderRadius: radius.sm, padding: 12 },
  contactLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  contactData: { fontSize: 14, color: colors.text, marginBottom: 4 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 24, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  modalText: { fontSize: 14, color: colors.textLight, lineHeight: 22, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, padding: 13, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  btnCancelText: { fontWeight: '700', color: colors.textLight },
  btnConfirm: { flex: 1, padding: 13, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center' },
  btnConfirmText: { fontWeight: '700', color: '#fff' },
});
