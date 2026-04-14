import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, FlatList
} from 'react-native';
import { colors, radius, shadow } from '../theme';
import { api } from '../api';

const CATEGORIAS_ICONS = {
  'Electricidad': '⚡', 'Gasfitería': '🔧', 'Carpintería': '🪵',
  'Pintura': '🎨', 'Jardinería': '🌿', 'Limpieza de Casas': '🏠',
  'Construcción': '🏗️', 'Climatización': '❄️', 'Cerrajería': '🔑',
  'Mecánica Automotriz': '🚗', 'Transporte y Fletes': '🚚',
  'Computación y Tecnología': '💻', 'Clases Particulares': '📚',
  'Belleza y Cuidado Personal': '💇', 'Fotografía y Video': '📷',
  'Cocina y Catering': '🍽️', 'Abogado': '⚖️', 'Médico / Especialista': '🩺',
  'Centro de Eventos Infantiles': '🎈', 'Psicólogo': '🧠',
};

export default function HomeScreen({ navigation }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    api.publicidad().then(setAds).catch(() => {});
  }, []);

  const categorias = Object.entries(CATEGORIAS_ICONS);

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.heroEmoji}>🏘️</Text>
        <Text style={s.heroTitle}>
          Soluciona <Text style={s.heroTitleGold}>Ya</Text>
        </Text>
        <Text style={s.heroSub}>Profesionales y servicios en la Sexta Región</Text>
        <View style={s.heroButtons}>
          <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('Auth', { tipo: 'cliente' })}>
            <Text style={s.btnPrimaryText}>🔍 Necesito un profesional</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => navigation.navigate('Auth', { tipo: 'profesional' })}>
            <Text style={s.btnOutlineText}>💼 Ofrezco servicios</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        {[['31', 'Comunas'], ['18+', 'Categorías'], ['$1.000', 'Por lead'], ['100%', 'Gratis clientes']].map(([n, l]) => (
          <View key={l} style={s.statItem}>
            <Text style={s.statNum}>{n}</Text>
            <Text style={s.statLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Categorías */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Categorías</Text>
        <View style={s.catGrid}>
          {categorias.map(([nombre, icon]) => (
            <TouchableOpacity
              key={nombre}
              style={s.catItem}
              onPress={() => navigation.navigate('Directorio', { categoria: nombre })}
            >
              <Text style={s.catIcon}>{icon}</Text>
              <Text style={s.catName}>{nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Publicidad */}
      {ads.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>📢 Destacados</Text>
          {ads.map(ad => (
            <View key={ad.id} style={[s.adCard, { backgroundColor: ad.color_fondo || colors.primaryDark }]}>
              <Text style={[s.adEmpresa, { color: ad.color_texto || '#fff' }]}>{ad.empresa}</Text>
              <Text style={[s.adDesc, { color: ad.color_texto || '#fff' }]}>{ad.descripcion}</Text>
              <Text style={[s.adTel, { color: ad.color_texto || '#fff' }]}>📞 {ad.telefono}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { backgroundColor: colors.primary, padding: 32, alignItems: 'center', paddingTop: 48 },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heroTitleGold: { color: colors.gold },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,.85)', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  heroButtons: { gap: 12, width: '100%' },
  btnPrimary: { backgroundColor: colors.secondary, padding: 14, borderRadius: radius.full, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline: { borderWidth: 2, borderColor: 'rgba(255,255,255,.7)', padding: 14, borderRadius: radius.full, alignItems: 'center' },
  btnOutlineText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  statsRow: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16, ...shadow },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 10, color: colors.textLight, marginTop: 2, textAlign: 'center' },

  section: { padding: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 14 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catItem: { width: '30%', backgroundColor: '#fff', borderRadius: radius.md, padding: 12, alignItems: 'center', ...shadow },
  catIcon: { fontSize: 26, marginBottom: 6 },
  catName: { fontSize: 11, fontWeight: '600', textAlign: 'center', color: colors.text },

  adCard: { borderRadius: radius.md, padding: 18, marginBottom: 10 },
  adEmpresa: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  adDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8, opacity: .9 },
  adTel: { fontSize: 13, fontWeight: '700' },
});
