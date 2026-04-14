import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, radius } from '../theme';
import { api } from '../api';

const CATEGORIAS = [
  'Electricidad', 'Gasfitería', 'Carpintería', 'Pintura', 'Jardinería',
  'Mecánica Automotriz', 'Construcción', 'Climatización', 'Cerrajería',
  'Limpieza de Casas', 'Aseo y Limpieza', 'Transporte y Fletes',
  'Computación y Tecnología', 'Clases Particulares', 'Belleza y Cuidado Personal',
  'Fotografía y Video', 'Cocina y Catering', 'Centro de Eventos Infantiles',
  'Abogado', 'Arquitecto', 'Contador / Auditor', 'Médico / Especialista',
  'Psicólogo', 'Nutricionista', 'Diseñador Gráfico', 'Otro'
];

export default function AuthScreen({ route, navigation }) {
  const tipoInicial = route.params?.tipo || 'cliente';
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [tipo, setTipo] = useState(tipoInicial);
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '', categoria: '' });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleLogin() {
    if (!form.email || !form.password) return Alert.alert('Completa email y contraseña');
    setLoading(true);
    try {
      await api.login({ email: form.email, password: form.password });
      navigation.replace('Dashboard');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  }

  async function handleRegistro() {
    if (!form.nombre || !form.email || !form.telefono || !form.password)
      return Alert.alert('Completa todos los campos');
    const telOk = /^(\+?56)?0?9\d{8}$/.test(form.telefono.replace(/\s/g, ''));
    if (!telOk) return Alert.alert('Teléfono inválido', 'Usa formato chileno: +56 9 XXXX XXXX');
    if (tipo === 'profesional' && !form.categoria)
      return Alert.alert('Selecciona una categoría');
    setLoading(true);
    try {
      await api.registro({ ...form, tipo });
      navigation.replace('Dashboard');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <View style={s.header}>
          <Text style={s.logo}>🏘️ Soluciona <Text style={s.logoGold}>Ya</Text></Text>
        </View>

        {/* Tabs login/registro */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, modo === 'login' && s.tabActive]} onPress={() => setModo('login')}>
            <Text style={[s.tabText, modo === 'login' && s.tabTextActive]}>Ingresar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, modo === 'registro' && s.tabActive]} onPress={() => setModo('registro')}>
            <Text style={[s.tabText, modo === 'registro' && s.tabTextActive]}>Registrarse</Text>
          </TouchableOpacity>
        </View>

        {/* Tipo de usuario (solo registro) */}
        {modo === 'registro' && (
          <View style={s.tipoRow}>
            <TouchableOpacity style={[s.tipoBtn, tipo === 'cliente' && s.tipoBtnActive]} onPress={() => setTipo('cliente')}>
              <Text style={tipo === 'cliente' ? s.tipoBtnTextActive : s.tipoBtnText}>👤 Soy cliente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tipoBtn, tipo === 'profesional' && s.tipoBtnActive]} onPress={() => setTipo('profesional')}>
              <Text style={tipo === 'profesional' ? s.tipoBtnTextActive : s.tipoBtnText}>💼 Soy profesional</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Campos */}
        {modo === 'registro' && (
          <TextInput style={s.input} placeholder="Nombre completo" value={form.nombre}
            onChangeText={v => set('nombre', v)} autoCapitalize="words" />
        )}
        <TextInput style={s.input} placeholder="Email" value={form.email}
          onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
        {modo === 'registro' && (
          <TextInput style={s.input} placeholder="Teléfono (+56 9 XXXX XXXX)" value={form.telefono}
            onChangeText={v => set('telefono', v)} keyboardType="phone-pad" />
        )}
        <TextInput style={s.input} placeholder="Contraseña" value={form.password}
          onChangeText={v => set('password', v)} secureTextEntry />

        {/* Categoría solo para profesionales */}
        {modo === 'registro' && tipo === 'profesional' && (
          <View style={s.catContainer}>
            <Text style={s.catLabel}>Categoría principal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
              {CATEGORIAS.map(c => (
                <TouchableOpacity key={c} style={[s.catChip, form.categoria === c && s.catChipActive]}
                  onPress={() => set('categoria', c)}>
                  <Text style={form.categoria === c ? s.catChipTextActive : s.catChipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={s.btnSubmit} onPress={modo === 'login' ? handleLogin : handleRegistro} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> :
            <Text style={s.btnSubmitText}>{modo === 'login' ? 'Ingresar' : 'Crear cuenta gratis'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 28, fontWeight: '900', color: colors.primary },
  logoGold: { color: colors.gold },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md - 2 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '700', color: colors.textLight },
  tabTextActive: { color: '#fff' },

  tipoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tipoBtn: { flex: 1, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, alignItems: 'center', backgroundColor: '#fff' },
  tipoBtnActive: { borderColor: colors.primary, backgroundColor: '#e8f5e9' },
  tipoBtnText: { fontWeight: '600', color: colors.textLight },
  tipoBtnTextActive: { fontWeight: '700', color: colors.primary },

  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 13, marginBottom: 12, fontSize: 15, fontFamily: 'System' },

  catContainer: { marginBottom: 14 },
  catLabel: { fontWeight: '700', fontSize: 13, marginBottom: 8, color: colors.text },
  catScroll: { flexDirection: 'row' },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff', marginRight: 8 },
  catChipActive: { borderColor: colors.primary, backgroundColor: '#e8f5e9' },
  catChipText: { fontSize: 13, color: colors.textLight },
  catChipTextActive: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  btnSubmit: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.full, alignItems: 'center', marginTop: 8 },
  btnSubmitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
