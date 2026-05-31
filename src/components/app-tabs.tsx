import { Tabs } from 'expo-router';
import { useColorScheme, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const renderTabBarIcon = (symbol: string) => {
    return () => (
      <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ fontSize: 19 }}>{symbol}</Text>
      </View>
    );
  };

  // Dynamically compute optimized height and padding adjusted for native screen notches
  const bottomInsetPadding = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = 48 + bottomInsetPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
          height: tabHeight,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: insets.bottom > 0 ? 0 : 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: renderTabBarIcon('🏠'),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: renderTabBarIcon('👤'),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: renderTabBarIcon('📝'),
        }}
      />
      <Tabs.Screen
        name="estimates"
        options={{
          title: 'Estimates',
          tabBarIcon: renderTabBarIcon('📊'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: renderTabBarIcon('⚙️'),
        }}
      />
    </Tabs>
  );
}
