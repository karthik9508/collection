import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, CardContent } from '@/components/ui/card';
import { getCustomers, getBills, getBusinessProfile, Customer, Bill, generateDemoData } from '@/services/db';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useNavigation } from 'expo-router';

export default function DashboardScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const navigation = useNavigation();

  // Scroll insets
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
  };

  // State
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [estimates, setEstimates] = useState<Bill[]>([]);
  const [currency, setCurrency] = useState('₹');
  const [bizName, setBizName] = useState('Business ERP');
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Reload dashboard on focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadDashboardData();
    });
    loadDashboardData();
    return unsubscribe;
  }, [navigation]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const activeCust = await getCustomers();
      const activeBills = await getBills(false);
      const activeEsts = await getBills(true);
      const profile = await getBusinessProfile();

      setCustomers(activeCust);
      setBills(activeBills);
      setEstimates(activeEsts);
      setCurrency(profile.currency || '₹');
      setBizName(profile.name || 'Business ERP');
      setIsOnline(isFirebaseConfigured());
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalSales = bills.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const totalReceived = bills.reduce((sum, b) => sum + Number(b.amount_paid), 0);
  const totalOutstanding = totalSales - totalReceived;
  const totalEstimatesAmt = estimates.reduce((sum, b) => sum + Number(b.total_amount), 0);

  // Recent transactions (merged bills and estimates)
  const allTx = [
    ...bills.map(b => ({ ...b, type: 'Sales Bill' })),
    ...estimates.map(e => ({ ...e, type: 'Estimate' }))
  ].sort((a, b) => b.bill_date.localeCompare(a.bill_date)).slice(0, 4);

  // Quick Action triggers
  const handleQuickAction = (tabName: string) => {
    // Expo router navigation
    navigation.navigate(tabName as any);
  };

  const handleSeedData = async () => {
    setLoading(true);
    await generateDemoData();
    await loadDashboardData();
  };

  const getStatusColor = (status: string, isEstimate: boolean) => {
    if (isEstimate) return '#5856d6'; // purple
    if (status === 'Paid') return '#34c759'; // green
    if (status === 'Partially Paid') return '#ff9500'; // orange
    return '#ff3b30'; // red
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

  if (loading && bills.length === 0) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#007aff" />
        <ThemedText style={{ marginTop: Spacing.three }} themeColor="textSecondary">
          Loading ERP Dashboard...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>

        {/* Dashboard Header */}
        <ThemedView style={styles.headerSection}>
          <View>
            <ThemedText type="subtitle">📊 {bizName}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.welcomeText}>
              Welcome back! Here is your business accounting summary.
            </ThemedText>
          </View>
          <View style={[styles.syncBadge, { backgroundColor: isOnline ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 149, 0, 0.1)' }]}>
            <View style={[styles.dot, { backgroundColor: isOnline ? '#34c759' : '#ff9500' }]} />
            <ThemedText type="code" style={{ fontSize: 10, color: isOnline ? '#34c759' : '#ff9500' }}>
              {isOnline ? 'CLOUD-SYNC' : 'LOCAL-OFFLINE'}
            </ThemedText>
          </View>
        </ThemedView>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard} variant="elevated">
            <CardContent style={styles.kpiContent}>
              <ThemedText type="smallBold" themeColor="textSecondary">TOTAL SALES</ThemedText>
              <ThemedText type="subtitle" style={styles.kpiValue}>
                {currency} {totalSales.toLocaleString()}
              </ThemedText>
              <ThemedText type="code" style={{ color: '#34c759', fontSize: 11 }}>
                Received: {currency}{totalReceived.toLocaleString()}
              </ThemedText>
            </CardContent>
          </Card>

          <Card style={styles.kpiCard} variant="elevated">
            <CardContent style={[styles.kpiContent, { borderLeftColor: '#ff3b30', borderLeftWidth: 4 }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">TOTAL OUTSTANDING</ThemedText>
              <ThemedText type="subtitle" style={[styles.kpiValue, { color: '#ff3b30' }]}>
                {currency} {totalOutstanding.toLocaleString()}
              </ThemedText>
              <ThemedText type="code" style={{ color: '#ff9500', fontSize: 11 }}>
                Accounts Receivable
              </ThemedText>
            </CardContent>
          </Card>

          <Card style={styles.kpiCard} variant="elevated">
            <CardContent style={styles.kpiContent}>
              <ThemedText type="smallBold" themeColor="textSecondary">TOTAL ESTIMATES</ThemedText>
              <ThemedText type="subtitle" style={[styles.kpiValue, { color: '#5856d6' }]}>
                {currency} {totalEstimatesAmt.toLocaleString()}
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11 }}>
                {estimates.length} Pending Proposals
              </ThemedText>
            </CardContent>
          </Card>

          <Card style={styles.kpiCard} variant="elevated">
            <CardContent style={styles.kpiContent}>
              <ThemedText type="smallBold" themeColor="textSecondary">CUSTOMERS</ThemedText>
              <ThemedText type="subtitle" style={styles.kpiValue}>
                {customers.length}
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 11 }}>
                Active Accounts
              </ThemedText>
            </CardContent>
          </Card>
        </View>

        {/* Banners for Blank States */}
        {bills.length === 0 && (
          <Card style={styles.onboardingCard} variant="outlined">
            <CardContent style={styles.onboardingContent}>
              <ThemedText style={styles.onboardingEmoji}>🚀</ThemedText>
              <ThemedText type="default" style={styles.onboardingTitle}>
                Welcome to your Mobile ERP!
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.onboardingText}>
                Get started instantly by generating demo billing data or creating your first customer!
              </ThemedText>
              <View style={styles.onboardingRow}>
                <Pressable onPress={handleSeedData} style={[styles.actionBtn, { backgroundColor: '#5856d6' }]}>
                  <ThemedText type="smallBold" style={styles.btnText}>Seed Demo Data ⚡</ThemedText>
                </Pressable>
                <Pressable onPress={() => handleQuickAction('customers')} style={[styles.actionBtn, { backgroundColor: '#007aff' }]}>
                  <ThemedText type="smallBold" style={styles.btnText}>Add Customer 👤</ThemedText>
                </Pressable>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Panel */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          QUICK ACTIONS
        </ThemedText>
        <View style={styles.actionsPanel}>
          <Pressable onPress={() => handleQuickAction('bills')} style={[styles.actionCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.actionIcon}>📝</ThemedText>
            <ThemedText type="smallBold">New Sales Bill</ThemedText>
          </Pressable>

          <Pressable onPress={() => handleQuickAction('estimates')} style={[styles.actionCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.actionIcon}>📊</ThemedText>
            <ThemedText type="smallBold">New Estimate</ThemedText>
          </Pressable>

          <Pressable onPress={() => handleQuickAction('customers')} style={[styles.actionCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.actionIcon}>👤</ThemedText>
            <ThemedText type="smallBold">Customers Ledger</ThemedText>
          </Pressable>

          <Pressable onPress={() => handleQuickAction('settings')} style={[styles.actionCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.actionIcon}>⚙️</ThemedText>
            <ThemedText type="smallBold">ERP Config</ThemedText>
          </Pressable>
        </View>

        {/* Recent Transactions List */}
        {allTx.length > 0 && (
          <View style={styles.recentSection}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              RECENT BILLS & ESTIMATES
            </ThemedText>
            {allTx.map((tx) => {
              const cust = customers.find(c => c.id === tx.customer_id);
              const txColor = getStatusColor(tx.status, tx.is_estimate);
              return (
                <Card key={tx.id} style={styles.txCard} variant="outlined">
                  <CardContent style={styles.txCardContent}>
                    <View style={styles.txLeft}>
                      <View style={[styles.txBadge, { backgroundColor: tx.is_estimate ? 'rgba(88, 86, 214, 0.1)' : 'rgba(0, 122, 255, 0.1)' }]}>
                        <ThemedText type="smallBold" style={{ fontSize: 10, color: tx.is_estimate ? '#5856d6' : '#007aff' }}>
                          {tx.is_estimate ? 'EST' : 'BILL'}
                        </ThemedText>
                      </View>
                      <View style={styles.txInfo}>
                        <ThemedText type="smallBold">{tx.bill_number}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {cust ? cust.name : 'Unknown Customer'} • {tx.bill_date}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.txRight}>
                      <ThemedText type="smallBold">
                        {currency} {Number(tx.total_amount).toLocaleString()}
                      </ThemedText>
                      <View style={[styles.statusBadge, { backgroundColor: `${txColor}20` }]}>
                        <ThemedText type="code" style={{ fontSize: 10, color: txColor }}>
                          {tx.is_estimate ? 'Quote' : tx.status}
                        </ThemedText>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}

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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: Spacing.two,
  },
  welcomeText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '47%',
    minWidth: 150,
  },
  kpiContent: {
    gap: Spacing.one,
  },
  kpiValue: {
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 26,
    marginVertical: Spacing.half,
  },
  sectionLabel: {
    marginTop: Spacing.two,
  },
  actionsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionCard: {
    width: '48%',
    height: 80,
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionIcon: {
    fontSize: 24,
  },
  onboardingCard: {
    borderColor: '#007aff',
    borderStyle: 'dashed',
    borderWidth: 2,
    marginVertical: Spacing.two,
  },
  onboardingContent: {
    alignItems: 'center',
    textAlign: 'center',
    gap: Spacing.two,
  },
  onboardingEmoji: {
    fontSize: 48,
  },
  onboardingTitle: {
    fontWeight: '700',
  },
  onboardingText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  onboardingRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  btnText: {
    color: '#ffffff',
  },
  recentSection: {
    gap: Spacing.two,
  },
  txCard: {
    marginVertical: 0,
  },
  txCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  txBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  txInfo: {
    gap: Spacing.half,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
});
