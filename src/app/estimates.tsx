import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  Platform,
  ActivityIndicator,
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
  getBills,
  getBillItems,
  createBill,
  deleteBill,
  convertEstimateToBill,
  getBusinessProfile,
  Customer,
  Bill,
  BillItem,
  BusinessProfile,
} from '@/services/db';
import { useNavigation } from 'expo-router';
import { exportDocumentAsPDF, exportDocumentAsPNG } from '@/services/print-service';

export default function EstimatesScreen() {
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
  const [estimates, setEstimates] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState('₹');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewEstimateVisible, setViewEstimateVisible] = useState(false);

  // Estimate Creator Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [estimateNumber, setEstimateNumber] = useState('');
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Line Items in Creation Form
  const [lineItems, setLineItems] = useState<Omit<BillItem, 'id' | 'bill_id'>[]>([]);

  // Individual Add Item State
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState('1');
  const [itemPriceInput, setItemPriceInput] = useState('');
  const [itemTaxInput, setItemTaxInput] = useState('18');
  const [itemDiscInput, setItemDiscInput] = useState('0');

  // Selected estimate to view details
  const [selectedEstimate, setSelectedEstimate] = useState<Bill | null>(null);
  const [selectedEstimateItems, setSelectedEstimateItems] = useState<BillItem[]>([]);
  const [selectedEstimateCustomer, setSelectedEstimateCustomer] = useState<Customer | null>(null);
  const [estimateDetailsLoading, setEstimateDetailsLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);

  const handleExportPDF = async () => {
    if (!selectedEstimate) return;
    setPdfLoading(true);
    try {
      const success = await exportDocumentAsPDF(
        selectedEstimate,
        selectedEstimateCustomer,
        selectedEstimateItems,
        bizProfile
      );
      if (!success) {
        alert('Failed to generate PDF document.');
      }
    } catch (e) {
      alert('Failed to generate/share PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportPNG = async () => {
    if (!selectedEstimate) return;
    setPngLoading(true);
    try {
      const success = await exportDocumentAsPNG(
        selectedEstimate,
        selectedEstimateCustomer,
        selectedEstimateItems,
        bizProfile
      );
      if (!success) {
        alert('Failed to generate PNG image.');
      }
    } catch (e) {
      alert('Failed to generate/share PNG.');
    } finally {
      setPngLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadEstimatesData();
    });
    loadEstimatesData();
    return unsubscribe;
  }, [navigation]);

  const loadEstimatesData = async () => {
    setLoading(true);
    try {
      const activeEstimates = await getBills(true); // only estimates
      const activeCusts = await getCustomers();
      const profile = await getBusinessProfile();

      setEstimates(activeEstimates);
      setCustomers(activeCusts);
      setBizProfile(profile);
      setCurrency(profile.currency || '₹');

      // Pre-fill next estimate code
      setEstimateNumber(`EST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Line item adding to form list
  const handleAddLineItem = () => {
    if (!itemNameInput.trim() || !itemPriceInput.trim()) {
      alert('Item Name and Unit Price are required.');
      return;
    }

    const qty = Number(itemQtyInput) || 1;
    const rate = Number(itemPriceInput) || 0;
    const taxPct = Number(itemTaxInput) || 0;
    const discPct = Number(itemDiscInput) || 0;

    // Calculations
    const gross = qty * rate;
    const itemDisc = gross * (discPct / 100);
    const taxable = gross - itemDisc;
    const itemTax = taxable * (taxPct / 100);
    const finalTotal = taxable + itemTax;

    const newItem: Omit<BillItem, 'id' | 'bill_id'> = {
      item_name: itemNameInput.trim(),
      quantity: qty,
      price: rate,
      tax_rate: taxPct,
      discount_rate: discPct,
      total: Number(finalTotal.toFixed(2)),
    };

    setLineItems([...lineItems, newItem]);

    // Reset inputs
    setItemNameInput('');
    setItemQtyInput('1');
    setItemPriceInput('');
    setItemDiscInput('0');
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedSubtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const calculatedTaxAmount = lineItems.reduce((sum, item) => {
    const gross = item.quantity * item.price;
    const disc = gross * (item.discount_rate / 100);
    return sum + ((gross - disc) * (item.tax_rate / 100));
  }, 0);
  const calculatedDiscount = lineItems.reduce((sum, item) => {
    return sum + ((item.quantity * item.price) * (item.discount_rate / 100));
  }, 0);
  const calculatedGrandTotal = calculatedSubtotal - calculatedDiscount + calculatedTaxAmount;

  // Estimate Submit
  const handleCreateEstimate = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (!estimateNumber.trim()) {
      alert('Estimate quote number is required.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one line item to the estimate.');
      return;
    }

    try {
      await createBill(
        {
          bill_number: estimateNumber.trim(),
          customer_id: selectedCustomerId,
          bill_date: estimateDate,
          due_date: dueDate.trim() || undefined,
          subtotal: Number(calculatedSubtotal.toFixed(2)),
          discount: Number(calculatedDiscount.toFixed(2)),
          tax_amount: Number(calculatedTaxAmount.toFixed(2)),
          total_amount: Number(calculatedGrandTotal.toFixed(2)),
          amount_paid: 0,
          status: 'Unpaid',
          is_estimate: true,
          notes: notes.trim() || undefined,
        },
        lineItems
      );

      // Reset
      setSelectedCustomerId('');
      setLineItems([]);
      setNotes('');
      setCreateModalVisible(false);

      alert('Proposal Estimate successfully created! 📊');
      loadEstimatesData();
    } catch (e) {
      alert('Failed to save estimate quotation.');
    }
  };

  // View Details
  const handleOpenEstimateDetails = async (est: Bill) => {
    setSelectedEstimate(est);
    setEstimateDetailsLoading(true);
    setViewEstimateVisible(true);

    const client = customers.find(c => c.id === est.customer_id) || null;
    setSelectedEstimateCustomer(client);

    try {
      const items = await getBillItems(est.id);
      setSelectedEstimateItems(items);
    } catch (e) {
      alert('Error reading estimate rows.');
    } finally {
      setEstimateDetailsLoading(false);
    }
  };

  // 1-Click Convert proposal to Sales Invoice
  const handleConvertProposal = async () => {
    if (!selectedEstimate) return;
    
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newBillNum = `INV-${year}-${rand}`;

    const confirmConvert = () => {
      convertEstimateToBill(selectedEstimate.id, newBillNum).then((success) => {
        if (success) {
          setViewEstimateVisible(false);
          alert(`Proposal successfully converted to Sales Invoice ${newBillNum}! 📝`);
          // Navigate to Bills tab
          navigation.navigate('bills' as any);
        } else {
          alert('Failed to convert estimate.');
        }
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Would you like to instantly convert this Estimate to a real Sales Bill with invoice number ${newBillNum}?`)) {
        confirmConvert();
      }
    } else {
      Alert.alert(
        'Convert to Sales Invoice',
        `Would you like to instantly convert this Estimate to a real Sales Bill with invoice number ${newBillNum}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Convert to Bill', style: 'default', onPress: confirmConvert }
        ]
      );
    }
  };

  const handleDeleteEstimate = (id: string) => {
    const confirmDelete = () => {
      deleteBill(id).then(() => {
        setViewEstimateVisible(false);
        alert('Estimate deleted.');
        loadEstimatesData();
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this estimate proposal?')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Estimate',
        'Delete this estimate proposal?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete }
        ]
      );
    }
  };

  const alert = (msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Estimating', msg);
    }
  };

  // Filters
  const filteredEstimates = estimates.filter(
    (b) =>
      b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customers.find((c) => c.id === b.customer_id)?.name || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

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
          
          {/* Header Row */}
          <ThemedView style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">📊 Estimates & Quotes</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.headerSubtext}>
                Create proforma quotations for clients. Convert them to official sales bills in one-click.
              </ThemedText>
            </View>
            <Pressable onPress={() => setCreateModalVisible(true)} style={styles.addBtn}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>+ Create Quote</ThemedText>
            </Pressable>
          </ThemedView>

          {/* Search bar */}
          <Input
            placeholder="🔍 Search quotes by quote number or customer name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {loading ? (
            <ActivityIndicator size="large" color="#007aff" style={{ marginTop: Spacing.four }} />
          ) : filteredEstimates.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText themeColor="textSecondary">
                No active estimates or proposals. Click "+ Create Quote" to build one!
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.billsList}>
              {filteredEstimates.map((b) => {
                const client = customers.find(c => c.id === b.customer_id);
                return (
                  <Card key={b.id} style={styles.billCard} variant="outlined" onPress={() => handleOpenEstimateDetails(b)}>
                    <CardContent style={styles.billCardContent}>
                      <View style={styles.billLeft}>
                        <ThemedText type="smallBold" style={styles.billNumber}>{b.bill_number}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          👤 {client ? client.name : 'Unknown Customer'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          📅 Created: {b.bill_date}
                        </ThemedText>
                      </View>
                      <View style={styles.billRight}>
                        <ThemedText type="default" style={{ fontWeight: '700', color: '#5856d6' }}>
                          {currency} {Number(b.total_amount).toLocaleString()}
                        </ThemedText>
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
                          <ThemedText type="code" style={{ fontSize: 10, color: '#5856d6', fontWeight: '700' }}>
                            QUOTATION
                          </ThemedText>
                        </View>
                        <ThemedText type="code" style={{ fontSize: 9, color: '#007aff', marginTop: Spacing.half }}>
                          Convert to Bill ➡️
                        </ThemedText>
                      </View>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          )}

        </ThemedView>
      </ScrollView>

      {/* --- CREATE ESTIMATE MODAL --- */}
      <Modal visible={createModalVisible} onClose={() => setCreateModalVisible(false)} title="📊 Create Proforma Quote">
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.one }}>
          Select Customer *
        </ThemedText>
        {customers.length === 0 ? (
          <Pressable 
            onPress={() => {
              setCreateModalVisible(false);
              alert('Please register at least one Customer in the Customers tab first!');
            }}
            style={{ padding: Spacing.three, backgroundColor: '#fee2e2', borderRadius: Spacing.two, marginBottom: Spacing.two }}
          >
            <ThemedText type="smallBold" style={{ color: '#b91c1c', textAlign: 'center' }}>
              ⚠️ No Customers Found. Tap to close and add a customer first!
            </ThemedText>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two }}>
            {customers.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCustomerId(c.id)}
                style={[
                  styles.custSelectBtn,
                  { backgroundColor: theme.backgroundElement, marginRight: 0, marginBottom: Spacing.one },
                  selectedCustomerId === c.id && { borderColor: '#007aff', borderWidth: 2 },
                ]}>
                <ThemedText type="smallBold">{c.name}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.twoColumn}>
          <Input label="Quote Number *" placeholder="e.g. EST-001" value={estimateNumber} onChangeText={setEstimateNumber} containerStyle={{ flex: 1, marginRight: Spacing.two }} />
          <Input label="Quote Date" placeholder="YYYY-MM-DD" value={estimateDate} onChangeText={setEstimateDate} containerStyle={{ flex: 1 }} />
        </View>

        {/* --- LINE ITEM FORM BUILDER --- */}
        <Card style={styles.innerBuilderCard} variant="outlined">
          <CardHeader style={{ paddingBottom: 0 }}>
            <ThemedText type="smallBold" style={{ color: '#5856d6' }}>🛒 Add Quote Row</ThemedText>
          </CardHeader>
          <CardContent style={{ gap: Spacing.one }}>
            <Input placeholder="Item / Service Name (e.g. SEO Audit)" value={itemNameInput} onChangeText={setItemNameInput} />
            <View style={styles.twoColumn}>
              <Input placeholder="Qty" value={itemQtyInput} onChangeText={setItemQtyInput} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: Spacing.two }} />
              <Input placeholder="Price / Rate" value={itemPriceInput} onChangeText={setItemPriceInput} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </View>
            <View style={styles.twoColumn}>
              <Input placeholder="Tax %" value={itemTaxInput} onChangeText={setItemTaxInput} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: Spacing.two }} />
              <Input placeholder="Discount %" value={itemDiscInput} onChangeText={setItemDiscInput} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </View>
            <Pressable onPress={handleAddLineItem} style={[styles.inlineAddBtn, { backgroundColor: '#5856d6' }]}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>Add Row to Quote</ThemedText>
            </Pressable>
          </CardContent>
        </Card>

        {/* Active Items Table */}
        {lineItems.length > 0 && (
          <View style={styles.activeRowsWrapper}>
            <ThemedText type="smallBold" themeColor="textSecondary">PROPOSAL ROWS</ThemedText>
            {lineItems.map((item, idx) => (
              <View key={idx} style={[styles.lineItemRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={{ flex: 1.5 }}>
                  <ThemedText type="smallBold">{item.item_name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.quantity} x {currency}{item.price} (Tax: {item.tax_rate}%, Disc: {item.discount_rate}%)
                  </ThemedText>
                </View>
                <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                  <ThemedText type="smallBold">{currency} {item.total}</ThemedText>
                  <Pressable onPress={() => handleRemoveLineItem(idx)} style={styles.deleteRowBtn}>
                    <ThemedText type="code" style={{ color: '#ff3b30', fontSize: 10 }}>Remove</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Totals Summary */}
        <View style={[styles.totalsSummary, { borderTopColor: theme.backgroundSelected }]}>
          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">Subtotal</ThemedText>
            <ThemedText type="smallBold">{currency} {calculatedSubtotal.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">Discount</ThemedText>
            <ThemedText type="smallBold" style={{ color: '#34c759' }}>- {currency} {calculatedDiscount.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">Sales Tax (GST/VAT)</ThemedText>
            <ThemedText type="smallBold" style={{ color: '#ff9500' }}>+ {currency} {calculatedTaxAmount.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText type="default" style={{ fontWeight: '700' }}>Grand Total</ThemedText>
            <ThemedText type="default" style={{ fontWeight: '700', color: '#5856d6' }}>
              {currency} {calculatedGrandTotal.toFixed(2)}
            </ThemedText>
          </View>
        </View>

        <Input label="Terms / Quote comments" placeholder="Validity period, payment terms" value={notes} onChangeText={setNotes} />

        <Pressable onPress={handleCreateEstimate} style={[styles.modalSubmitBtn, { backgroundColor: '#5856d6', marginTop: Spacing.three }]}>
          <ThemedText type="smallBold" style={styles.btnTextWhite}>Save & Register Proposal</ThemedText>
        </Pressable>
      </Modal>

      {/* --- PROFORMA ESTIMATE DETAIL SHEET MODAL --- */}
      <Modal visible={viewEstimateVisible} onClose={() => setViewEstimateVisible(false)} title="📜 Proforma Estimate Quote">
        {estimateDetailsLoading ? (
          <ActivityIndicator size="large" color="#007aff" />
        ) : selectedEstimate ? (
          <View style={styles.invoicePaper}>
            
            {/* Header branding */}
            <View style={[styles.paperHeader, { borderBottomColor: theme.backgroundSelected }]}>
              <View>
                <ThemedText type="subtitle" style={{ fontSize: 24 }}>{bizProfile?.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{bizProfile?.address}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Ph: {bizProfile?.phone} • {bizProfile?.email}</ThemedText>
                {bizProfile?.tax_number && <ThemedText type="code" style={{ fontSize: 10, marginTop: Spacing.half }}>GSTIN/VAT: {bizProfile?.tax_number}</ThemedText>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <ThemedText type="smallBold" style={{ color: '#5856d6', fontSize: 12 }}>PROFORMA QUOTE</ThemedText>
                <ThemedText type="smallBold">{selectedEstimate.bill_number}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{selectedEstimate.bill_date}</ThemedText>
              </View>
            </View>

            {/* Bill To Info */}
            <View style={styles.paperBillingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" themeColor="textSecondary">PROPOSAL PREPARED FOR:</ThemedText>
                <ThemedText type="smallBold">{selectedEstimateCustomer?.name}</ThemedText>
                {selectedEstimateCustomer?.address && <ThemedText type="small" themeColor="textSecondary">{selectedEstimateCustomer.address}</ThemedText>}
                {selectedEstimateCustomer?.phone && <ThemedText type="small" themeColor="textSecondary">Ph: {selectedEstimateCustomer.phone}</ThemedText>}
              </View>
            </View>

            {/* Line Items (Optimized Mobile Layout) */}
            <View style={styles.tableWrapper}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two, letterSpacing: 0.5 }}>
                ESTIMATED ITEMS
              </ThemedText>

              {selectedEstimateItems.map((item) => (
                <View key={item.id} style={[styles.tableDataRow, { borderBottomColor: theme.backgroundSelected, justifyContent: 'space-between', paddingVertical: Spacing.two }]}>
                  <View style={{ flex: 1.2, gap: Spacing.half }}>
                    <ThemedText type="smallBold" style={{ fontSize: 13.5 }}>{item.item_name}</ThemedText>
                    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                      <ThemedText type="small" themeColor="textSecondary">Qty: {item.quantity}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Rate: {currency}{item.price}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Tax: {item.tax_rate}%</ThemedText>
                    </View>
                  </View>
                  <View style={{ flex: 0.6, alignItems: 'flex-end' }}>
                    <ThemedText type="smallBold" style={{ fontSize: 13.5 }}>{currency}{Number(item.total).toFixed(2)}</ThemedText>
                  </View>
                </View>
              ))}
            </View>

            {/* Calculations block */}
            <View style={styles.paperTotalsBlock}>
              <View style={styles.paperTotalRow}>
                <ThemedText type="small" themeColor="textSecondary">Subtotal</ThemedText>
                <ThemedText type="smallBold">{currency} {Number(selectedEstimate.subtotal).toFixed(2)}</ThemedText>
              </View>
              {Number(selectedEstimate.discount) > 0 && (
                <View style={styles.paperTotalRow}>
                  <ThemedText type="small" themeColor="textSecondary">Discount</ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#34c759' }}>- {currency} {Number(selectedEstimate.discount).toFixed(2)}</ThemedText>
                </View>
              )}
              <View style={styles.paperTotalRow}>
                <ThemedText type="small" themeColor="textSecondary">Estimated Taxes</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#ff9500' }}>+ {currency} {Number(selectedEstimate.tax_amount).toFixed(2)}</ThemedText>
              </View>
              <View style={[styles.paperTotalRow, { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', paddingTop: Spacing.one }]}>
                <ThemedText type="default" style={{ fontWeight: '700' }}>Grand Total</ThemedText>
                <ThemedText type="default" style={{ fontWeight: '700', color: '#5856d6' }}>
                  {currency} {Number(selectedEstimate.total_amount).toFixed(2)}
                </ThemedText>
              </View>
            </View>

            {/* Notes */}
            {selectedEstimate.notes && (
              <View style={[styles.paperNotesBlock, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="code" style={{ fontSize: 10 }}>ESTIMATE COMMENTS:</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{selectedEstimate.notes}</ThemedText>
              </View>
            )}

            {/* Share/Export Quote PDF Button */}
            <Pressable 
              onPress={handleExportPDF} 
              disabled={pdfLoading}
              style={[styles.modalSubmitBtn, { backgroundColor: '#5856d6', marginTop: Spacing.four, opacity: pdfLoading ? 0.7 : 1 }]}
            >
              <ThemedText type="smallBold" style={styles.btnTextWhite}>
                {pdfLoading ? 'Generating PDF...' : '📤 Share/Export Quote PDF'}
              </ThemedText>
            </Pressable>

            {/* Share/Export Quote PNG Image Button */}
            <Pressable 
              onPress={handleExportPNG} 
              disabled={pngLoading}
              style={[styles.modalSubmitBtn, { backgroundColor: '#e040fb', marginTop: Spacing.four, opacity: pngLoading ? 0.7 : 1 }]}
            >
              <ThemedText type="smallBold" style={styles.btnTextWhite}>
                {pngLoading ? 'Generating PNG...' : '🖼️ Share/Export Quote PNG Image'}
              </ThemedText>
            </Pressable>

            {/* Conversion Triggers */}
            <View style={{ gap: Spacing.two, marginTop: Spacing.four }}>
              <Pressable onPress={handleConvertProposal} style={[styles.modalSubmitBtn, { backgroundColor: '#34c759' }]}>
                <ThemedText type="smallBold" style={styles.btnTextWhite}>⚡ Convert to Official Sales Bill</ThemedText>
              </Pressable>
              
              <Pressable onPress={() => handleDeleteEstimate(selectedEstimate.id)} style={[styles.modalSubmitBtn, { backgroundColor: '#ff3b30' }]}>
                <ThemedText type="smallBold" style={styles.btnTextWhite}>🗑️ Delete/Discard Estimate</ThemedText>
              </Pressable>
            </View>

          </View>
        ) : null}
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
    backgroundColor: '#5856d6',
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
  billsList: {
    gap: Spacing.two,
  },
  billCard: {
    marginVertical: 0,
  },
  billCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLeft: {
    gap: Spacing.half,
    flex: 1.2,
  },
  billNumber: {
    fontSize: 16,
  },
  billRight: {
    alignItems: 'flex-end',
    flex: 0.8,
    gap: Spacing.half,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
  custSelectBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    marginRight: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
    borderWidth: 2,
  },
  twoColumn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  innerBuilderCard: {
    marginVertical: Spacing.two,
    alignSelf: 'stretch',
    borderColor: '#5856d6',
  },
  inlineAddBtn: {
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  activeRowsWrapper: {
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deleteRowBtn: {
    paddingVertical: Spacing.half,
  },
  totalsSummary: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    marginVertical: Spacing.two,
    gap: Spacing.one,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSubmitBtn: {
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextWhite: {
    color: '#ffffff',
  },
  invoicePaper: {
    gap: Spacing.four,
  },
  paperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  paperBillingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableWrapper: {
    marginVertical: Spacing.two,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.one,
    borderBottomWidth: 2,
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  paperTotalsBlock: {
    alignSelf: 'flex-end',
    width: '65%',
    gap: Spacing.one,
  },
  paperTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperNotesBlock: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
});
