import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator
} from 'react-native';
import { colors, radius, shadow } from '../theme';
import { api } from '../api';

export default function DirectorioScreen({ navigation }) {
  const [profs, setProfs] = useState([]);
  const [filtrado, setFiltrado] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.profesionales().then(data => {
      setProfs(data);
      setFiltrado(data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = buscar.toLowerCase();
    setFiltrado(profs.filter(p =>
      !q || p.nombre?.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q)
    ));
  }, [buscar, profs]);

  const planColor = { elite: '#92400e', pro: '#1d4ed8', basico: colors.textLight };
  const planBg    = { elite: '#fef3c7', pro: '#dbeafe', basico: '#f3f4f6' };
  const planLabel = { elite: '👑 ÉLITE', pro: '⭐ PRO', basico: '' };

  return (
    <View style={s.container}>
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍  Buscar profesional o categoría..."
          value={buscar}
          onChangeText={setBuscar}
          placeholderTextColor={colors.textLight}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={filtrado}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={<Text style={s.empty}>No se encontraron profesionales</Text>}
          renderItem={({ item: p }) => {
            const plan = p.plan_tipo || 'basico';
            const initials = p.nombre?.charAt(0).toUpperCase() || '?';
            return (
              <TouchableOpacity
                style={[s.card, plan === 'elite' && s.cardElite, plan === 'pro' && s.cardPro]}
                onPress={() => p.sitio_activo && navigation.navigate('Perfil', { id: p.id })}
              >
                {planLabel[plan] ? (
                  <View style={[s.ribbon, { backgroundColor: planBg[plan] }]}>
                    <Text style={[s.ribbonText, { color: planColor[plan] }]}>{planLabel[plan]}</Text>
                  </View>
                ) : null}
                <View style={s.cardTop}>
                  <View style={[s.avatar, plan === 'elite' && s.avatarElite, plan === 'pro' && s.avatarPro]}>
                    <Text style={s.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nombre}>{p.nombre}</Text>
                    <Text style={s.categoria}>{p.categoria}</Text>
                  </View>
                </View>
                {p.descripcion ? <Text style={s.desc} numberOfLines={2}>{p.descripcion}</Text> : null}
                <View style={s.footer}>
                  <Text style={s.stars}>{'★'.repeat(Math.round(parseFloat(p.promedio||0)))}{'☆'.repeat(5-Math.round(parseFloat(p.promedio||0)))}</Text>
                  {p.sitio_activo
                    ? <Text style={s.verPerfil}>Ver perfil →</Text>
                    : <Text style={s.sinSitio}>Sin sitio público</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchBar: { padding: 16, backgroundColor: colors.primary, paddingTop: 8 },
  searchInput: { backgroundColor: '#fff', borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 11, fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textLight },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, ...shadow, borderWidth: 2, borderColor: 'transparent', position: 'relative', overflow: 'hidden' },
  cardElite: { borderColor: '#b8860b' },
  cardPro:   { borderColor: 'rgba(201,146,10,.4)' },
  ribbon: { position: 'absolute', top: 10, right: 0, paddingHorizontal: 10, paddingVertical: 3, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  ribbonText: { fontSize: 11, fontWeight: '700' },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarElite: { backgroundColor: '#92400e' },
  avatarPro:   { backgroundColor: '#1d4ed8' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  nombre: { fontWeight: '800', fontSize: 15, color: colors.text },
  categoria: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  desc: { fontSize: 13, color: '#4b5563', lineHeight: 18, marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  stars: { color: '#f59e0b', fontSize: 14 },
  verPerfil: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  sinSitio: { fontSize: 12, color: colors.textLight },
});
