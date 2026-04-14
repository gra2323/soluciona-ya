import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import HomeScreen               from './src/screens/HomeScreen';
import AuthScreen               from './src/screens/AuthScreen';
import DirectorioScreen         from './src/screens/DirectorioScreen';
import DashboardClienteScreen   from './src/screens/DashboardClienteScreen';
import DashboardProfesionalScreen from './src/screens/DashboardProfesionalScreen';
import { api } from './src/api';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabsCliente() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarStyle: { paddingBottom: 4 }
    }}>
      <Tab.Screen name="MisSolicitudes" component={DashboardClienteScreen}
        options={{ title: 'Solicitudes', tabBarIcon: () => '📋' }} />
      <Tab.Screen name="Directorio" component={DirectorioScreen}
        options={{ title: 'Profesionales', tabBarIcon: () => '👥' }} />
    </Tab.Navigator>
  );
}

function TabsProfesional() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarStyle: { paddingBottom: 4 }
    }}>
      <Tab.Screen name="MisSolicitudesProf" component={DashboardProfesionalScreen}
        options={{ title: 'Solicitudes', tabBarIcon: () => '🔍' }} />
      <Tab.Screen name="Directorio" component={DirectorioScreen}
        options={{ title: 'Directorio', tabBarIcon: () => '👥' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [estado, setEstado] = useState('cargando'); // 'cargando' | 'invitado' | 'cliente' | 'profesional'

  useEffect(() => {
    api.me().then(u => setEstado(u?.tipo || 'invitado')).catch(() => setEstado('invitado'));
  }, []);

  if (estado === 'cargando') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.primary} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {estado === 'invitado' ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="Directorio" component={DirectorioScreen}
              options={{ headerShown: true, title: 'Directorio', headerTintColor: '#fff', headerStyle: { backgroundColor: colors.primary } }} />
          </>
        ) : estado === 'cliente' ? (
          <Stack.Screen name="Dashboard" component={TabsCliente} />
        ) : (
          <Stack.Screen name="Dashboard" component={TabsProfesional} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
