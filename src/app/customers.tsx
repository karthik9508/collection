import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  Platform,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  getCustomers,
  createCustomer,
  getCustomerStatement,
  createPayment,
  Customer,
  CustomerStatement,
  getBusinessProfile,
} from '@/services/db';
import { useNavigation } from 'expo-router';

export default function CustomersScreen() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState('₹');

  // Modals
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [ledgerModalVisible, setLedgerModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Forms
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustOpening, setNewCustOpening] = useState('0');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer'>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Selected Ledger Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCustomers();
    });
    loadCustomers();
    return unsubscribe;
  }, [navigation]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      const profile = await getBusinessProfile();
      setCustomers(data);
      setCurrency(profile.currency || '₹');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered customer list
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Add customer
  const handleAddCustomer = async () => {
    if (!newCustName.trim()) {
      alert('Customer Name is required!');
      return;
    }

    try {
      await createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        opening_balance: Number(newCustOpening) || 0,
      });

      // Reset
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustAddress('');
      setNewCustOpening('0');
      setAddModalVisible(false);

      alert('Customer successfully created! 👤');
      loadCustomers();
    } catch (e) {
      alert('Failed to create customer.');
    }
  };

  // View Statement/Ledger
  const handleViewLedger = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setStatementLoading(true);
    setLedgerModalVisible(true);
    try {
      const stmt = await getCustomerStatement(customerId);
      setStatement(stmt);
    } catch (e) {
      alert('Failed to load customer statement ledger.');
    } finally {
      setStatementLoading(false);
    }
  };

  // Record Payment
  const handleRecordPayment = async () => {
    if (!selectedCustomerId) return;
    if (!paymentAmount.trim() || Number(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount!');
      return;
    }

    try {
      await createPayment({
        customer_id: selectedCustomerId,
        amount: Number(paymentAmount),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        notes: paymentNotes.trim() || 'Payment received on account',
      });

      // Reset
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentModalVisible(false);
      alert('Payment recorded successfully! 💸');

      // Refresh Statement
      const updatedStmt = await getCustomerStatement(selectedCustomerId);
      setStatement(updatedStmt);
      loadCustomers();
    } catch (e) {
      alert('Failed to record payment.');
    }
  };

  const alert = (msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Customers', msg);
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
    <ThemedView style={[styles.mainView, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentInset={insets}
        contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
        <ThemedView style={styles.container}>
          
          {/* Header row */}
          <ThemedView style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">👤 Customers Directory</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.headerSubtext}>
                Manage active client profiles and view detailed debit/credit statements.
              </ThemedText>
            </View>
            <Pressable onPress={() => setAddModalVisible(true)} style={styles.addBtn}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>+ Customer</ThemedText>
            </Pressable>
          </ThemedView>

          {/* Search Input */}
          <Input
            placeholder="🔍 Search customers by name, phone or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {loading ? (
            <ActivityIndicator size="large" color="#007aff" style={{ marginTop: Spacing.four }} />
          ) : filteredCustomers.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText themeColor="textSecondary">
                No customers found. Click "+ Customer" to add one!
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.customersList}>
              {filteredCustomers.map((c) => (
                <Card key={c.id} style={styles.custCard} variant="outlined" onPress={() => handleViewLedger(c.id)}>
                  <CardContent style={styles.custCardContent}>
                    <View style={styles.custInfo}>
                      <ThemedText type="smallBold" style={styles.custName}>{c.name}</ThemedText>
                      {c.phone && <ThemedText type="small" themeColor="textSecondary">📞 {c.phone}</ThemedText>}
                      {c.email && <ThemedText type="small" themeColor="textSecondary">✉️ {c.email}</ThemedText>}
                    </View>
                    <View style={styles.custRight}>
                      <ThemedText type="small" themeColor="textSecondary">Outstanding</ThemedText>
                      {/* Calculate balance dynamically or show opening */}
                      <ThemedText type="smallBold" style={{ color: c.opening_balance > 0 ? '#ff3b30' : '#34c759' }}>
                        {currency} {c.opening_balance.toLocaleString()}
                      </ThemedText>
                      <ThemedText type="code" style={{ fontSize: 10, color: '#007aff', marginTop: Spacing.half }}>
                        View Ledger ➡️
                      </ThemedText>
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
          )}

        </ThemedView>
      </ScrollView>

      {/* --- ADD CUSTOMER MODAL --- */}
      <Modal visible={addModalVisible} onClose={() => setAddModalVisible(false)} title="👤 Create Customer Profile">
        <Input label="Customer / Company Name *" placeholder="e.g. John Doe, Acme Corp" value={newCustName} onChangeText={setNewCustName} />
        <Input label="Phone Number" placeholder="+91 99999 88888" value={newCustPhone} onChangeText={setNewCustPhone} keyboardType="phone-pad" />
        <Input label="Email Address" placeholder="client@example.com" value={newCustEmail} onChangeText={setNewCustEmail} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Address" placeholder="Business street address" value={newCustAddress} onChangeText={setNewCustAddress} multiline />
        <Input label="Opening Balance (Amount they owe us)" placeholder="0.00" value={newCustOpening} onChangeText={setNewCustOpening} keyboardType="numeric" />

        <Pressable onPress={handleAddCustomer} style={[styles.modalSubmitBtn, { backgroundColor: '#007aff' }]}>
          <ThemedText type="smallBold" style={styles.btnTextWhite}>Create Profile</ThemedText>
        </Pressable>
      </Modal>

      {/* --- LEDGER STATEMENT MODAL --- */}
      <Modal visible={ledgerModalVisible} onClose={() => setLedgerModalVisible(false)} title="📋 Account Ledger Statement">
        {statementLoading ? (
          <ActivityIndicator size="large" color="#007aff" />
        ) : statement ? (
          <View style={styles.ledgerWrapper}>
            {/* Summary Cards */}
            <View style={styles.ledgerHeader}>
              <ThemedText type="default" style={{ fontWeight: '700' }}>{statement.customer.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Phone: {statement.customer.phone || 'N/A'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Address: {statement.customer.address || 'N/A'}</ThemedText>
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">Total Invoiced</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#007aff' }}>{currency} {statement.total_billed.toLocaleString()}</ThemedText>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">Total Paid</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#34c759' }}>{currency} {statement.total_paid.toLocaleString()}</ThemedText>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">Net Due</ThemedText>
                <ThemedText type="smallBold" style={{ color: statement.outstanding_balance > 0 ? '#ff3b30' : '#34c759' }}>
                  {currency} {statement.outstanding_balance.toLocaleString()}
                </ThemedText>
              </View>
            </View>

            <Pressable onPress={() => setPaymentModalVisible(true)} style={[styles.addBtn, { alignSelf: 'stretch', height: 44, marginVertical: Spacing.two }]}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>💸 Record Payment Received</ThemedText>
            </Pressable>

            {/* Transactions Log */}
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginVertical: Spacing.one }}>
              TRANSACTION TIMELINE
            </ThemedText>

            {statement.transactions.map((tx) => (
              <View key={tx.id} style={[styles.txRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={styles.txRowLeft}>
                  <ThemedText type="smallBold" style={{ color: tx.type === 'Sales Bill' ? '#007aff' : tx.type === 'Payment' ? '#34c759' : theme.text }}>
                    {tx.type}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Ref: {tx.reference} • {tx.date}</ThemedText>
                  {tx.details && <ThemedText style={styles.txDesc}>{tx.details}</ThemedText>}
                </View>
                <View style={styles.txRowRight}>
                  {tx.debit > 0 && <ThemedText type="smallBold" style={{ color: '#ff3b30' }}>+ {currency}{tx.debit.toLocaleString()} (DR)</ThemedText>}
                  {tx.credit > 0 && <ThemedText type="smallBold" style={{ color: '#34c759' }}>- {currency}{tx.credit.toLocaleString()} (CR)</ThemedText>}
                  <ThemedText type="code" style={{ fontSize: 11, themeColor: 'textSecondary', marginTop: Spacing.half }}>
                    Bal: {currency}{tx.running_balance.toLocaleString()}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText>Could not load ledger.</ThemedText>
        )}
      </Modal>

      {/* --- RECORD PAYMENT MODAL --- */}
      <Modal visible={paymentModalVisible} onClose={() => setPaymentModalVisible(false)} title="💸 Record Cash/UPI Payment">
        <Input label="Amount Received *" placeholder="e.g. 5000" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="numeric" />
        <Input label="Payment Date" placeholder="YYYY-MM-DD" value={paymentDate} onChangeText={setPaymentDate} />

        <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.one }}>
          Payment Mode *
        </ThemedText>
        <View style={styles.modeGrid}>
          {(['Cash', 'UPI', 'Card', 'Bank Transfer'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setPaymentMode(mode)}
              style={[
                styles.modeBtn,
                { backgroundColor: theme.backgroundElement },
                paymentMode === mode && { borderColor: '#007aff', borderWidth: 2 },
              ]}>
              <ThemedText type="smallBold">{mode}</ThemedText>
            </Pressable>
          ))}
        </View>

        <Input label="Notes" placeholder="Payment receipt comments, invoice reference" value={paymentNotes} onChangeText={setPaymentNotes} />

        <Pressable onPress={handleRecordPayment} style={[styles.modalSubmitBtn, { backgroundColor: '#34c759', marginTop: Spacing.three }]}>
          <ThemedText type="smallBold" style={styles.btnTextWhite}>Save Receipt Payment</ThemedText>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  mainView: {
    flex: 1,
  },
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  headerSubtext: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  addBtn: {
    backgroundColor: '#007aff',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.five,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customersList: {
    gap: Spacing.two,
  },
  custCard: {
    marginVertical: 0,
  },
  custCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  custInfo: {
    gap: Spacing.half,
    flex: 1,
  },
  custName: {
    fontSize: 18,
    fontWeight: '700',
  },
  custRight: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  modalSubmitBtn: {
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  btnTextWhite: {
    color: '#ffffff',
  },
  ledgerWrapper: {
    gap: Spacing.three,
  },
  ledgerHeader: {
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  kpiBox: {
    flex: 1,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txRowLeft: {
    flex: 1.2,
    gap: Spacing.half,
  },
  txRowRight: {
    flex: 0.8,
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  txDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: '#60646c',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  modeBtn: {
    flexGrow: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    borderWidth: 2,
  },
});
