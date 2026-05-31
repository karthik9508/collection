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
  getBusinessProfile,
  Customer,
  Bill,
  BillItem,
  BusinessProfile,
} from '@/services/db';
import { useNavigation } from 'expo-router';
import { exportDocumentAsPDF, exportDocumentAsPNG } from '@/services/print-service';

interface NewItemRow {
  item_name: string;
  quantity: string;
  price: string;
  tax_rate: string; // e.g. 18
  discount_rate: string; // e.g. 10
}

export default function BillsScreen() {
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bizProfile, setBizProfile] = useState<BusinessProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState('₹');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [viewInvoiceVisible, setViewInvoiceVisible] = useState(false);

  // Bill Creator Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');

  // Line Items in Creation Form
  const [lineItems, setLineItems] = useState<Omit<BillItem, 'id' | 'bill_id'>[]>([]);

  // Individual Add Item State
  const [itemNameInput, setItemNameInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState('1');
  const [itemPriceInput, setItemPriceInput] = useState('');
  const [itemTaxInput, setItemTaxInput] = useState('18'); // Default 18% GST
  const [itemDiscInput, setItemDiscInput] = useState('0');

  // Selected invoice to view details
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedBillItems, setSelectedBillItems] = useState<BillItem[]>([]);
  const [selectedBillCustomer, setSelectedBillCustomer] = useState<Customer | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);

  const handleExportPDF = async () => {
    if (!selectedBill) return;
    setPdfLoading(true);
    try {
      const success = await exportDocumentAsPDF(
        selectedBill,
        selectedBillCustomer,
        selectedBillItems,
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
    if (!selectedBill) return;
    setPngLoading(true);
    try {
      const success = await exportDocumentAsPNG(
        selectedBill,
        selectedBillCustomer,
        selectedBillItems,
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
      loadBillsData();
    });
    loadBillsData();
    return unsubscribe;
  }, [navigation]);

  const loadBillsData = async () => {
    setLoading(true);
    try {
      const activeBills = await getBills(false); // only sales bills
      const activeCusts = await getCustomers();
      const profile = await getBusinessProfile();

      setBills(activeBills);
      setCustomers(activeCusts);
      setBizProfile(profile);
      setCurrency(profile.currency || '₹');

      // Pre-fill next invoice code
      setBillNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
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

  // Form Calculations
  const calculatedSubtotal = lineItems.reduce((sum, item) => {
    // Subtotal is gross (quantity * price)
    return sum + (item.quantity * item.price);
  }, 0);

  const calculatedTaxAmount = lineItems.reduce((sum, item) => {
    const gross = item.quantity * item.price;
    const disc = gross * (item.discount_rate / 100);
    return sum + ((gross - disc) * (item.tax_rate / 100));
  }, 0);

  const calculatedDiscount = lineItems.reduce((sum, item) => {
    return sum + ((item.quantity * item.price) * (item.discount_rate / 100));
  }, 0);

  const calculatedGrandTotal = calculatedSubtotal - calculatedDiscount + calculatedTaxAmount;

  // Invoice Submit
  const handleCreateInvoice = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (!billNumber.trim()) {
      alert('Invoice bill number is required.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one line item to the bill.');
      return;
    }

    const netPaid = Number(amountPaid) || 0;
    const grandTotal = Number(calculatedGrandTotal.toFixed(2));
    let status: Bill['status'] = 'Unpaid';
    if (netPaid >= grandTotal) status = 'Paid';
    else if (netPaid > 0) status = 'Partially Paid';

    try {
      await createBill(
        {
          bill_number: billNumber.trim(),
          customer_id: selectedCustomerId,
          bill_date: billDate,
          due_date: dueDate.trim() || undefined,
          subtotal: Number(calculatedSubtotal.toFixed(2)),
          discount: Number(calculatedDiscount.toFixed(2)),
          tax_amount: Number(calculatedTaxAmount.toFixed(2)),
          total_amount: grandTotal,
          amount_paid: netPaid,
          status,
          is_estimate: false,
          notes: notes.trim() || undefined,
        },
        lineItems
      );

      // Reset Form
      setSelectedCustomerId('');
      setLineItems([]);
      setAmountPaid('0');
      setNotes('');
      setCreateModalVisible(false);

      alert('Sales Invoice successfully created! 📝');
      loadBillsData();
    } catch (e) {
      alert('Failed to save sales invoice.');
    }
  };

  // View Invoice Detail Sheet
  const handleOpenInvoiceDetails = async (bill: Bill) => {
    setSelectedBill(bill);
    setInvoiceLoading(true);
    setViewInvoiceVisible(true);

    const client = customers.find(c => c.id === bill.customer_id) || null;
    setSelectedBillCustomer(client);

    try {
      const items = await getBillItems(bill.id);
      setSelectedBillItems(items);
    } catch (e) {
      alert('Error reading bill item descriptions.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDeleteInvoice = (id: string) => {
    const confirmDelete = () => {
      deleteBill(id).then(() => {
        setViewInvoiceVisible(false);
        alert('Invoice deleted successfully.');
        loadBillsData();
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to permanently delete this sales bill?')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Invoice',
        'Are you sure you want to permanently delete this sales bill?',
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
      Alert.alert('Invoicing', msg);
    }
  };

  // Filter lists
  const filteredBills = bills.filter(
    (b) =>
      b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customers.find((c) => c.id === b.customer_id)?.name || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    if (status === 'Paid') return '#34c759';
    if (status === 'Partially Paid') return '#ff9500';
    return '#ff3b30';
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
          
          {/* Header Row */}
          <ThemedView style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">📝 Sales Bills</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.headerSubtext}>
                Record trade transactions, calculate sales taxes, and review invoice details.
              </ThemedText>
            </View>
            <Pressable onPress={() => setCreateModalVisible(true)} style={styles.addBtn}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>+ Create Bill</ThemedText>
            </Pressable>
          </ThemedView>

          {/* Search bar */}
          <Input
            placeholder="🔍 Search invoices by number or customer name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {loading ? (
            <ActivityIndicator size="large" color="#007aff" style={{ marginTop: Spacing.four }} />
          ) : filteredBills.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText themeColor="textSecondary">
                No sales bills recorded. Click "+ Create Bill" to make one!
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.billsList}>
              {filteredBills.map((b) => {
                const client = customers.find(c => c.id === b.customer_id);
                const statusColor = getStatusColor(b.status);
                return (
                  <Card key={b.id} style={styles.billCard} variant="outlined" onPress={() => handleOpenInvoiceDetails(b)}>
                    <CardContent style={styles.billCardContent}>
                      <View style={styles.billLeft}>
                        <ThemedText type="smallBold" style={styles.billNumber}>{b.bill_number}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          👤 {client ? client.name : 'Unknown Customer'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          📅 Date: {b.bill_date}
                        </ThemedText>
                      </View>
                      <View style={styles.billRight}>
                        <ThemedText type="default" style={{ fontWeight: '700' }}>
                          {currency} {Number(b.total_amount).toLocaleString()}
                        </ThemedText>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                          <ThemedText type="code" style={{ fontSize: 10, color: statusColor, fontWeight: '700' }}>
                            {b.status}
                          </ThemedText>
                        </View>
                        <ThemedText type="code" style={{ fontSize: 9, color: theme.textSecondary, marginTop: Spacing.half }}>
                          Due: {currency}{Number(b.total_amount - b.amount_paid).toLocaleString()}
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

      {/* --- INVOICE CREATION BUILDER MODAL --- */}
      <Modal visible={createModalVisible} onClose={() => setCreateModalVisible(false)} title="📝 Create Sales Invoice">
        {/* Customer Select dropdown mock */}
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
          <Input label="Invoice Number *" placeholder="e.g. INV-001" value={billNumber} onChangeText={setBillNumber} containerStyle={{ flex: 1, marginRight: Spacing.two }} />
          <Input label="Invoice Date" placeholder="YYYY-MM-DD" value={billDate} onChangeText={setBillDate} containerStyle={{ flex: 1 }} />
        </View>

        {/* --- LINE ITEM FORM BUILDER --- */}
        <Card style={styles.innerBuilderCard} variant="outlined">
          <CardHeader style={{ paddingBottom: 0 }}>
            <ThemedText type="smallBold" style={{ color: '#007aff' }}>🛒 Add Sales Item Line</ThemedText>
          </CardHeader>
          <CardContent style={{ gap: Spacing.one }}>
            <Input placeholder="Item / Service Name (e.g. Web Consulting)" value={itemNameInput} onChangeText={setItemNameInput} />
            <View style={styles.twoColumn}>
              <Input placeholder="Qty" value={itemQtyInput} onChangeText={setItemQtyInput} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: Spacing.two }} />
              <Input placeholder="Price / Rate" value={itemPriceInput} onChangeText={setItemPriceInput} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </View>
            <View style={styles.twoColumn}>
              <Input placeholder="Tax % (e.g. 18)" value={itemTaxInput} onChangeText={setItemTaxInput} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: Spacing.two }} />
              <Input placeholder="Discount %" value={itemDiscInput} onChangeText={setItemDiscInput} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </View>
            <Pressable onPress={handleAddLineItem} style={[styles.inlineAddBtn, { backgroundColor: '#5856d6' }]}>
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>Add Row to Invoice</ThemedText>
            </Pressable>
          </CardContent>
        </Card>

        {/* Active Items Table */}
        {lineItems.length > 0 && (
          <View style={styles.activeRowsWrapper}>
            <ThemedText type="smallBold" themeColor="textSecondary">INVOICE ROWS</ThemedText>
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

        {/* Totals Calculation Summary */}
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
            <ThemedText type="default" style={{ fontWeight: '700', color: '#007aff' }}>
              {currency} {calculatedGrandTotal.toFixed(2)}
            </ThemedText>
          </View>
        </View>

        <Input label="Amount Paid on Creation" placeholder="0.00" value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" />
        <Input label="Notes / Comments" placeholder="Payment terms, bank details" value={notes} onChangeText={setNotes} />

        <Pressable onPress={handleCreateInvoice} style={[styles.modalSubmitBtn, { backgroundColor: '#007aff', marginTop: Spacing.three }]}>
          <ThemedText type="smallBold" style={styles.btnTextWhite}>Save & Register Invoice</ThemedText>
        </Pressable>
      </Modal>

      {/* --- PREMIUM TAX INVOICE DETAIL VIEW MODAL --- */}
      <Modal visible={viewInvoiceVisible} onClose={() => setViewInvoiceVisible(false)} title="📜 Tax Invoice Details">
        {invoiceLoading ? (
          <ActivityIndicator size="large" color="#007aff" />
        ) : selectedBill ? (
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
                <ThemedText type="smallBold" style={{ color: '#ff3b30', fontSize: 12 }}>TAX INVOICE</ThemedText>
                <ThemedText type="smallBold">{selectedBill.bill_number}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{selectedBill.bill_date}</ThemedText>
              </View>
            </View>

            {/* Bill To Info */}
            <View style={styles.paperBillingRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" themeColor="textSecondary">BILL TO:</ThemedText>
                <ThemedText type="smallBold">{selectedBillCustomer?.name}</ThemedText>
                {selectedBillCustomer?.address && <ThemedText type="small" themeColor="textSecondary">{selectedBillCustomer.address}</ThemedText>}
                {selectedBillCustomer?.phone && <ThemedText type="small" themeColor="textSecondary">Ph: {selectedBillCustomer.phone}</ThemedText>}
              </View>
            </View>

            {/* Line Items (Optimized Mobile Layout) */}
            <View style={styles.tableWrapper}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: Spacing.two, letterSpacing: 0.5 }}>
                INVOICED ITEMS
              </ThemedText>

              {selectedBillItems.map((item) => (
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
                <ThemedText type="smallBold">{currency} {Number(selectedBill.subtotal).toFixed(2)}</ThemedText>
              </View>
              {Number(selectedBill.discount) > 0 && (
                <View style={styles.paperTotalRow}>
                  <ThemedText type="small" themeColor="textSecondary">Item Discount</ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#34c759' }}>- {currency} {Number(selectedBill.discount).toFixed(2)}</ThemedText>
                </View>
              )}
              <View style={styles.paperTotalRow}>
                <ThemedText type="small" themeColor="textSecondary">Taxes (GST/VAT)</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#ff9500' }}>+ {currency} {Number(selectedBill.tax_amount).toFixed(2)}</ThemedText>
              </View>
              <View style={[styles.paperTotalRow, { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', paddingTop: Spacing.one }]}>
                <ThemedText type="default" style={{ fontWeight: '700' }}>Net Total</ThemedText>
                <ThemedText type="default" style={{ fontWeight: '700', color: '#007aff' }}>
                  {currency} {Number(selectedBill.total_amount).toFixed(2)}
                </ThemedText>
              </View>
              <View style={styles.paperTotalRow}>
                <ThemedText type="small" themeColor="textSecondary">Amount Paid</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#34c759' }}>{currency} {Number(selectedBill.amount_paid).toFixed(2)}</ThemedText>
              </View>
              <View style={styles.paperTotalRow}>
                <ThemedText type="smallBold" style={{ color: '#ff3b30' }}>Outstanding Balance Due</ThemedText>
                <ThemedText type="smallBold" style={{ color: '#ff3b30' }}>
                  {currency} {Number(selectedBill.total_amount - selectedBill.amount_paid).toFixed(2)}
                </ThemedText>
              </View>
            </View>

            {/* Notes */}
            {selectedBill.notes && (
              <View style={[styles.paperNotesBlock, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="code" style={{ fontSize: 10 }}>NOTES:</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{selectedBill.notes}</ThemedText>
              </View>
            )}

             {/* Share/Export PDF Button */}
            <Pressable 
              onPress={handleExportPDF} 
              disabled={pdfLoading}
              style={[styles.modalSubmitBtn, { backgroundColor: '#007aff', marginTop: Spacing.four, opacity: pdfLoading ? 0.7 : 1 }]}
            >
              <ThemedText type="smallBold" style={styles.btnTextWhite}>
                {pdfLoading ? 'Generating PDF...' : '📤 Share/Export PDF Document'}
              </ThemedText>
            </Pressable>

             {/* Share/Export PNG Image Button */}
            <Pressable 
              onPress={handleExportPNG} 
              disabled={pngLoading}
              style={[styles.modalSubmitBtn, { backgroundColor: '#34c759', marginTop: Spacing.four, opacity: pngLoading ? 0.7 : 1 }]}
            >
              <ThemedText type="smallBold" style={styles.btnTextWhite}>
                {pngLoading ? 'Generating PNG...' : '🖼️ Share/Export PNG Image'}
              </ThemedText>
            </Pressable>

            {/* Delete Invoice Trigger */}
            <Pressable onPress={() => handleDeleteInvoice(selectedBill.id)} style={[styles.modalSubmitBtn, { backgroundColor: '#ff3b30', marginTop: Spacing.four }]}>
              <ThemedText type="smallBold" style={styles.btnTextWhite}>⚠️ Void/Delete Sales Invoice</ThemedText>
            </Pressable>

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
