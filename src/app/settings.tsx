import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getFirebaseCredentials,
  initializeFirebase,
  clearFirebaseCredentials,
  isFirebaseConfigured,
} from '@/lib/firebase';
import { getBusinessProfile, saveBusinessProfile, generateDemoData, BusinessProfile } from '@/services/db';

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  // Scroll insets
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
  };

  // State
  const [projectId, setProjectId] = useState('');
  const [isDbOnline, setIsDbOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  const [bizName, setBizName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizTax, setBizTax] = useState('');
  const [currency, setCurrency] = useState('₹');

  // Load configuration on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Firebase credentials
      const creds = await getFirebaseCredentials();
      setProjectId(creds.projectId || '');
      setIsDbOnline(isFirebaseConfigured());

      // Business Profile
      const profile = await getBusinessProfile();
      setBizName(profile.name);
      setBizAddress(profile.address || '');
      setBizPhone(profile.phone || '');
      setBizEmail(profile.email || '');
      setBizTax(profile.tax_number || '');
      setCurrency(profile.currency || '₹');
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  // Handlers
  const handleSaveFirebase = async () => {
    if (!projectId.trim()) {
      alert('Please fill out your Firebase Project ID!');
      return;
    }

    setLoading(true);
    try {
      const client = await initializeFirebase(projectId.trim(), true);
      if (client) {
        setIsDbOnline(true);
        alert('Firebase Firestore successfully connected and saved! 🔥');
      } else {
        setIsDbOnline(false);
        alert('Could not initialize Firebase. Please check your Project ID. ❌');
      }
    } catch (err) {
      setIsDbOnline(false);
      alert('Connection failed. Verify your project ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFirebase = async () => {
    try {
      await clearFirebaseCredentials();
      setProjectId('');
      setIsDbOnline(false);
      alert('Firebase credentials cleared. Switched to offline-first local mode.');
    } catch (e) {
      alert('Failed to clear credentials.');
    }
  };

  const handleSaveProfile = async () => {
    if (!bizName.trim()) {
      alert('Business Name cannot be empty.');
      return;
    }

    const updatedProfile: BusinessProfile = {
      name: bizName.trim(),
      address: bizAddress.trim(),
      phone: bizPhone.trim(),
      email: bizEmail.trim(),
      tax_number: bizTax.trim(),
      currency: currency.trim(),
    };

    try {
      await saveBusinessProfile(updatedProfile);
      alert('Business Profile saved successfully! 🏢');
    } catch (e) {
      alert('Failed to save business profile.');
    }
  };

  const handleGenerateMockData = async () => {
    setLoading(true);
    try {
      await generateDemoData();
      alert('Mock data successfully seeded! Go check your Dashboard, Customers, and Bills! 🚀');
    } catch (e) {
      alert('Failed to seed mock data.');
    } finally {
      setLoading(false);
    }
  };

  const alert = (msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Settings', msg);
    }
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        
        {/* Title */}
        <ThemedView style={styles.headerTitle}>
          <ThemedText type="subtitle">⚙️ Settings</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Manage business profile, database credentials, and seed demonstration data.
          </ThemedText>
        </ThemedView>

        {/* Database Status Banner */}
        <Card style={styles.bannerCard} variant="outlined">
          <CardContent style={styles.bannerContent}>
            <View style={styles.statusIndicator}>
              <View style={[styles.dot, { backgroundColor: isDbOnline ? '#34c759' : '#ff9500' }]} />
              <ThemedText type="smallBold">
                DATABASE: {isDbOnline ? 'Firebase Connected 🔥' : 'Local Offline Mode ⚠️'}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.bannerSubtext}>
              {isDbOnline 
                ? 'Your billing records are syncing live with your cloud Firebase Firestore database!' 
                : 'Using local AsyncStorage fallback. Setup Firebase Project ID below to sync across all devices.'}
            </ThemedText>
          </CardContent>
        </Card>

        {/* 1. Firebase configuration */}
        <Card style={styles.card} variant="elevated">
          <CardHeader>
            <ThemedText type="default">🔥 Firebase Cloud Firestore</ThemedText>
          </CardHeader>
          <CardContent>
            <Input
              label="Firebase Project ID"
              placeholder="e.g. billing-erp-app"
              value={projectId}
              onChangeText={setProjectId}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.actionsRow}>
              {isDbOnline && (
                <Pressable onPress={handleClearFirebase} style={[styles.button, styles.buttonDanger]}>
                  <ThemedText type="smallBold" style={styles.buttonTextWhite}>Disconnect</ThemedText>
                </Pressable>
              )}
              <Pressable 
                onPress={handleSaveFirebase} 
                disabled={loading}
                style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}>
                <ThemedText type="smallBold" style={styles.buttonTextWhite}>
                  {loading ? 'Connecting...' : isDbOnline ? 'Update Credentials' : 'Connect Firebase'}
                </ThemedText>
              </Pressable>
            </View>
          </CardContent>
        </Card>

        {/* 2. Business Profile */}
        <Card style={styles.card} variant="elevated">
          <CardHeader>
            <ThemedText type="default">🏢 Business Branding & Profile</ThemedText>
          </CardHeader>
          <CardContent>
            <Input
              label="Business Name"
              placeholder="e.g. Acme Tech Solutions"
              value={bizName}
              onChangeText={setBizName}
            />
            <Input
              label="Address"
              placeholder="123 Corporate St, Sector 5"
              value={bizAddress}
              onChangeText={setBizAddress}
              multiline
            />
            <View style={styles.twoColumn}>
              <Input
                label="Phone"
                placeholder="+91 98765 43210"
                value={bizPhone}
                onChangeText={setBizPhone}
                keyboardType="phone-pad"
                containerStyle={{ flex: 1, marginRight: Spacing.two }}
              />
              <Input
                label="Email"
                placeholder="billing@acme.com"
                value={bizEmail}
                onChangeText={setBizEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{ flex: 1 }}
              />
            </View>
            <View style={styles.twoColumn}>
              <Input
                label="Tax / GST Number"
                placeholder="GSTIN/VAT details"
                value={bizTax}
                onChangeText={setBizTax}
                autoCapitalize="characters"
                containerStyle={{ flex: 1, marginRight: Spacing.two }}
              />
              <Input
                label="Currency Symbol"
                placeholder="₹, $, €, £"
                value={currency}
                onChangeText={setCurrency}
                maxLength={3}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Pressable onPress={handleSaveProfile} style={[styles.button, styles.buttonPrimary, { marginTop: Spacing.two }]}>
              <ThemedText type="smallBold" style={styles.buttonTextWhite}>Save Profile Details</ThemedText>
            </Pressable>
          </CardContent>
        </Card>

        {/* 3. Utility Utilities */}
        <Card style={styles.card} variant="outlined">
          <CardHeader>
            <ThemedText type="default">⚡ Development & Utilities</ThemedText>
          </CardHeader>
          <CardContent style={styles.utilityContent}>
            <View style={styles.utilityRow}>
              <View style={styles.utilityInfo}>
                <ThemedText type="smallBold">Seed Demo Data</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Populate 5 sample customers, 5 sales bills, and estimates instantly!
                </ThemedText>
              </View>
              <Pressable onPress={handleGenerateMockData} style={[styles.button, styles.buttonAccent]} disabled={loading}>
                <ThemedText type="smallBold" style={styles.buttonTextWhite}>Generate</ThemedText>
              </Pressable>
            </View>
          </CardContent>
        </Card>

      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  headerTitle: {
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  bannerCard: {
    borderColor: '#ff9500',
    backgroundColor: 'rgba(255, 149, 0, 0.05)',
  },
  bannerContent: {
    gap: Spacing.one,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bannerSubtext: {
    lineHeight: 18,
  },
  card: {
    alignSelf: 'stretch',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  button: {
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonPrimary: {
    backgroundColor: '#007aff',
  },
  buttonDanger: {
    backgroundColor: '#ff3b30',
  },
  buttonAccent: {
    backgroundColor: '#5856d6',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonTextWhite: {
    color: '#ffffff',
  },
  twoColumn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  utilityContent: {
    gap: Spacing.three,
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  utilityInfo: {
    flex: 1,
    paddingRight: Spacing.three,
    gap: Spacing.half,
  },
});
