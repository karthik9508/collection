import { SafeStorage as AsyncStorage } from '../lib/storage';
import { getFirebase, initializeFirebase } from '../lib/firebase';

// --- TYPE DEFINITIONS ---

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  opening_balance: number;
  created_at?: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  customer_id: string;
  bill_date: string;
  due_date?: string;
  subtotal: number;
  discount: number; // absolute discount
  tax_amount: number; // absolute tax
  total_amount: number;
  amount_paid: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  is_estimate: boolean;
  notes?: string;
  pdf_html?: string; // frozen historic HTML snapshot of generated invoice
  created_at?: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  item_name: string;
  quantity: number;
  price: number;
  tax_rate: number; // e.g. 18 for 18%
  discount_rate: number; // percentage
  total: number;
}

export interface Payment {
  id: string;
  customer_id: string;
  bill_id?: string;
  amount: number;
  payment_date: string;
  payment_mode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  notes?: string;
  created_at?: string;
}

export interface BusinessProfile {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_number?: string; // GST/VAT
  currency: string;
}

export interface StatementItem {
  id: string;
  date: string;
  type: 'Opening Balance' | 'Sales Bill' | 'Payment' | 'Estimate' | 'Converted Bill';
  reference: string; // bill number, receipt id, or label
  debit: number; // additions to outstanding (Bills)
  credit: number; // subtractions from outstanding (Payments)
  running_balance: number;
  details?: string;
}

export interface CustomerStatement {
  customer: Customer;
  opening_balance: number;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
  transactions: StatementItem[];
}

// --- STORAGE KEYS FOR LOCAL FALLBACK ---

const KEYS = {
  CUSTOMERS: 'BILL_ERP_CUSTOMERS_V1',
  BILLS: 'BILL_ERP_BILLS_V1',
  BILL_ITEMS: 'BILL_ERP_BILL_ITEMS_V1',
  PAYMENTS: 'BILL_ERP_PAYMENTS_V1',
  BUSINESS_PROFILE: 'BILL_ERP_BUSINESS_PROFILE_V1',
};

// Helper for generating random IDs (simulates UUID)
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// --- LOCAL STORAGE CORE HELPERS ---

async function getLocalData<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return [];
  }
}

async function saveLocalData<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}

// --- INITIALIZATION ---

export async function initDb(): Promise<boolean> {
  const client = await initializeFirebase();
  return client !== null;
}

// --- BUSINESS PROFILE ---

const DEFAULT_PROFILE: BusinessProfile = {
  name: 'My Business ERP',
  currency: '₹',
  address: '123 Business Avenue, Suite A',
  phone: '+91 98765 43210',
  email: 'billing@mybusiness.com',
  tax_number: '27AAAAA1111A1Z1',
};

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const client = getFirebase();
  if (client) {
    try {
      const data = await client.select('business_profile');
      const doc = data && data.find((p: any) => p.id === 'default');
      if (doc) {
        // Cache locally for offline reliability
        await AsyncStorage.setItem(KEYS.BUSINESS_PROFILE, JSON.stringify(doc));
        return doc as BusinessProfile;
      }
    } catch (err) {
      console.warn('Firebase read business profile failed, loading locally:', err);
    }
  }

  const raw = await AsyncStorage.getItem(KEYS.BUSINESS_PROFILE);
  return raw ? JSON.parse(raw) : DEFAULT_PROFILE;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  // 1. Save locally
  await AsyncStorage.setItem(KEYS.BUSINESS_PROFILE, JSON.stringify(profile));

  // 2. Sync to Firebase if connected
  const client = getFirebase();
  if (client) {
    try {
      await client.insert('business_profile', 'default', profile);
    } catch (err) {
      console.warn('Firebase save business profile failed:', err);
    }
  }
}

// --- CUSTOMERS SERVICE ---

export async function getCustomers(): Promise<Customer[]> {
  const client = getFirebase();
  if (client) {
    try {
      const data = await client.select('customers', {}, 'name.asc');
      return data || [];
    } catch (err) {
      console.warn('Firebase query failed, falling back to local storage:', err);
    }
  }
  const local = await getLocalData<Customer>(KEYS.CUSTOMERS);
  return local.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCustomer(customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
  const customerId = generateId();
  const created_at = new Date().toISOString();

  const newCustomer: Customer = {
    ...customer,
    id: customerId,
    created_at,
  };

  const client = getFirebase();
  if (client) {
    try {
      const saved = await client.insert('customers', customerId, newCustomer);
      if (saved) return saved;
    } catch (err) {
      console.warn('Firebase insert failed, inserting locally:', err);
    }
  }

  const local = await getLocalData<Customer>(KEYS.CUSTOMERS);
  local.push(newCustomer);
  await saveLocalData(KEYS.CUSTOMERS, local);
  return newCustomer;
}

export async function updateCustomer(customer: Customer): Promise<Customer> {
  const client = getFirebase();
  if (client) {
    try {
      const saved = await client.update('customers', customer.id, customer);
      if (saved) return saved;
    } catch (err) {
      console.warn('Firebase update failed, updating locally:', err);
    }
  }

  const local = await getLocalData<Customer>(KEYS.CUSTOMERS);
  const index = local.findIndex((c) => c.id === customer.id);
  if (index !== -1) {
    local[index] = customer;
    await saveLocalData(KEYS.CUSTOMERS, local);
  }
  return customer;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const client = getFirebase();
  if (client) {
    try {
      await client.delete('customers', id);
      
      // Clean up related bills & payments on Cloud (Firebase has no foreign cascade constraints!)
      const relatedBills = await client.select('bills', { customer_id: id });
      for (const bill of relatedBills) {
        await client.delete('bills', bill.id);
        const relatedItems = await client.select('bill_items', { bill_id: bill.id });
        for (const item of relatedItems) {
          await client.delete('bill_items', item.id);
        }
      }
      
      const relatedPayments = await client.select('payments', { customer_id: id });
      for (const pay of relatedPayments) {
        await client.delete('payments', pay.id);
      }
      return true;
    } catch (err) {
      console.warn('Firebase delete failed, deleting locally:', err);
    }
  }

  // Local storage cleanup
  let localCustomers = await getLocalData<Customer>(KEYS.CUSTOMERS);
  localCustomers = localCustomers.filter((c) => c.id !== id);
  await saveLocalData(KEYS.CUSTOMERS, localCustomers);

  let localBills = await getLocalData<Bill>(KEYS.BILLS);
  const billsToDelete = localBills.filter((b) => b.customer_id === id).map((b) => b.id);
  localBills = localBills.filter((b) => b.customer_id !== id);
  await saveLocalData(KEYS.BILLS, localBills);

  let localItems = await getLocalData<BillItem>(KEYS.BILL_ITEMS);
  localItems = localItems.filter((item) => !billsToDelete.includes(item.bill_id));
  await saveLocalData(KEYS.BILL_ITEMS, localItems);

  let localPayments = await getLocalData<Payment>(KEYS.PAYMENTS);
  localPayments = localPayments.filter((p) => p.customer_id !== id);
  await saveLocalData(KEYS.PAYMENTS, localPayments);

  return true;
}

// --- BILLS & ESTIMATES SERVICE ---

export async function getBills(isEstimate = false): Promise<Bill[]> {
  const client = getFirebase();
  if (client) {
    try {
      const data = await client.select('bills', { is_estimate: isEstimate }, 'bill_date.desc');
      return data || [];
    } catch (err) {
      console.warn('Firebase select failed, falling back to local:', err);
    }
  }
  const local = await getLocalData<Bill>(KEYS.BILLS);
  return local
    .filter((b) => b.is_estimate === isEstimate)
    .sort((a, b) => b.bill_date.localeCompare(a.bill_date));
}

export async function getBillItems(billId: string): Promise<BillItem[]> {
  const client = getFirebase();
  if (client) {
    try {
      const data = await client.select('bill_items', { bill_id: billId });
      return data || [];
    } catch (err) {
      console.warn('Firebase select failed, falling back to local:', err);
    }
  }
  const local = await getLocalData<BillItem>(KEYS.BILL_ITEMS);
  return local.filter((item) => item.bill_id === billId);
}

export async function createBill(
  bill: Omit<Bill, 'id' | 'created_at'>,
  items: Omit<BillItem, 'id' | 'bill_id'>[]
): Promise<{ bill: Bill; items: BillItem[] }> {
  const billId = generateId();
  const created_at = new Date().toISOString();

  const newBill: Bill = {
    ...bill,
    id: billId,
    created_at,
  };

  const newItems: BillItem[] = items.map((item) => ({
    ...item,
    id: generateId(),
    bill_id: billId,
  }));

  const client = getFirebase();
  if (client) {
    try {
      // 1. Create bill on Firebase
      const savedBill = await client.insert('bills', billId, newBill);

      if (savedBill) {
        // 2. Insert items sequentially to prevent race overrides
        const insertedItems: BillItem[] = [];
        for (const item of newItems) {
          const inserted = await client.insert('bill_items', item.id, item);
          if (inserted) insertedItems.push(inserted);
        }

        // 3. Create initial payment if amount_paid > 0 and not estimate
        if (bill.amount_paid > 0 && !bill.is_estimate) {
          const payId = generateId();
          await client.insert('payments', payId, {
            id: payId,
            customer_id: bill.customer_id,
            bill_id: billId,
            amount: bill.amount_paid,
            payment_date: bill.bill_date,
            payment_mode: 'Cash',
            notes: `Auto-recorded on Bill #${bill.bill_number}`,
            created_at,
          });
        }

        return { bill: savedBill, items: insertedItems };
      }
    } catch (err) {
      console.warn('Firebase create bill failed, creating locally:', err);
    }
  }

  // Local storage fallback
  const localBills = await getLocalData<Bill>(KEYS.BILLS);
  localBills.push(newBill);
  await saveLocalData(KEYS.BILLS, localBills);

  const localItems = await getLocalData<BillItem>(KEYS.BILL_ITEMS);
  localItems.push(...newItems);
  await saveLocalData(KEYS.BILL_ITEMS, localItems);

  // Auto record payment locally if paid
  if (bill.amount_paid > 0 && !bill.is_estimate) {
    await createPayment({
      customer_id: bill.customer_id,
      bill_id: billId,
      amount: bill.amount_paid,
      payment_date: bill.bill_date,
      payment_mode: 'Cash',
      notes: `Auto-recorded on Bill #${bill.bill_number}`,
    });
  }

  return { bill: newBill, items: newItems };
}

export async function deleteBill(id: string): Promise<boolean> {
  const client = getFirebase();
  if (client) {
    try {
      await client.delete('bills', id);
      
      // Manually clean up bill items and payments connected to this bill
      const items = await client.select('bill_items', { bill_id: id });
      for (const item of items) {
        await client.delete('bill_items', item.id);
      }
      
      const payments = await client.select('payments', { bill_id: id });
      for (const p of payments) {
        await client.delete('payments', p.id);
      }
      return true;
    } catch (err) {
      console.warn('Firebase delete bill failed, deleting locally:', err);
    }
  }

  let localBills = await getLocalData<Bill>(KEYS.BILLS);
  localBills = localBills.filter((b) => b.id !== id);
  await saveLocalData(KEYS.BILLS, localBills);

  let localItems = await getLocalData<BillItem>(KEYS.BILL_ITEMS);
  localItems = localItems.filter((item) => item.bill_id !== id);
  await saveLocalData(KEYS.BILL_ITEMS, localItems);

  let localPayments = await getLocalData<Payment>(KEYS.PAYMENTS);
  localPayments = localPayments.filter((p) => p.bill_id !== id);
  await saveLocalData(KEYS.PAYMENTS, localPayments);
  return true;
}

export async function saveBillHtmlSnapshot(id: string, html: string): Promise<void> {
  const client = getFirebase();
  if (client) {
    try {
      await client.update('bills', id, { pdf_html: html });
    } catch (err) {
      console.warn('Firebase save HTML snapshot failed:', err);
    }
  }

  const localBills = await getLocalData<Bill>(KEYS.BILLS);
  const index = localBills.findIndex((b) => b.id === id);
  if (index !== -1) {
    localBills[index] = {
      ...localBills[index],
      pdf_html: html,
    };
    await saveLocalData(KEYS.BILLS, localBills);
  }
}

export async function convertEstimateToBill(
  estimateId: string,
  newBillNumber: string
): Promise<boolean> {
  const client = getFirebase();
  if (client) {
    try {
      const ests = await client.select('bills', { id: estimateId });
      const est = ests && ests.find(b => b.id === estimateId);

      if (est) {
        await client.update('bills', estimateId, {
          is_estimate: false,
          bill_number: newBillNumber,
          bill_date: new Date().toISOString().split('T')[0],
        });
        return true;
      }
    } catch (err) {
      console.warn('Firebase estimate conversion failed, doing locally:', err);
    }
  }

  // Local storage conversion
  const localBills = await getLocalData<Bill>(KEYS.BILLS);
  const index = localBills.findIndex((b) => b.id === estimateId);
  if (index !== -1) {
    localBills[index].is_estimate = false;
    localBills[index].bill_number = newBillNumber;
    localBills[index].bill_date = new Date().toISOString().split('T')[0];
    await saveLocalData(KEYS.BILLS, localBills);
    return true;
  }
  return false;
}

// --- PAYMENTS SERVICE ---

export async function getPayments(): Promise<Payment[]> {
  const client = getFirebase();
  if (client) {
    try {
      const data = await client.select('payments', {}, 'payment_date.desc');
      return data || [];
    } catch (err) {
      console.warn('Firebase payments select failed, falling back to local:', err);
    }
  }
  const local = await getLocalData<Payment>(KEYS.PAYMENTS);
  return local.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
}

export async function createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  const payId = generateId();
  const created_at = new Date().toISOString();

  const newPayment: Payment = {
    ...payment,
    id: payId,
    created_at,
  };

  const client = getFirebase();
  if (client) {
    try {
      const saved = await client.insert('payments', payId, newPayment);

      if (payment.bill_id) {
        await recalculateBillStatus(payment.bill_id);
      }

      if (saved) return saved;
    } catch (err) {
      console.warn('Firebase payment insert failed, inserting locally:', err);
    }
  }

  // Local storage save
  const localPayments = await getLocalData<Payment>(KEYS.PAYMENTS);
  localPayments.push(newPayment);
  await saveLocalData(KEYS.PAYMENTS, localPayments);

  if (payment.bill_id) {
    await recalculateBillStatusLocal(payment.bill_id);
  }

  return newPayment;
}

export async function deletePayment(id: string): Promise<boolean> {
  const client = getFirebase();
  if (client) {
    try {
      const pays = await client.select('payments', { id });
      const pay = pays && pays.find(p => p.id === id);

      await client.delete('payments', id);

      if (pay && pay.bill_id) {
        await recalculateBillStatus(pay.bill_id);
      }
      return true;
    } catch (err) {
      console.warn('Firebase delete payment failed, deleting locally:', err);
    }
  }

  const localPayments = await getLocalData<Payment>(KEYS.PAYMENTS);
  const payment = localPayments.find((p) => p.id === id);
  const updatedPayments = localPayments.filter((p) => p.id !== id);
  await saveLocalData(KEYS.PAYMENTS, updatedPayments);

  if (payment && payment.bill_id) {
    await recalculateBillStatusLocal(payment.bill_id);
  }

  return true;
}

// Helpers to recalculate bills
async function recalculateBillStatus(billId: string): Promise<void> {
  const client = getFirebase();
  if (!client) return;

  const payments = await client.select('payments', { bill_id: billId });
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

  const bills = await client.select('bills', { id: billId });
  const bill = bills && bills.find(b => b.id === billId);

  if (bill) {
    const totalAmt = Number(bill.total_amount);
    let status: Bill['status'] = 'Unpaid';
    if (totalPaid >= totalAmt) status = 'Paid';
    else if (totalPaid > 0) status = 'Partially Paid';

    await client.update('bills', billId, { amount_paid: totalPaid, status });
  }
}

async function recalculateBillStatusLocal(billId: string): Promise<void> {
  const localBills = await getLocalData<Bill>(KEYS.BILLS);
  const localPayments = await getLocalData<Payment>(KEYS.PAYMENTS);

  const paymentsForBill = localPayments.filter((p) => p.bill_id === billId);
  const totalPaid = paymentsForBill.reduce((sum, p) => sum + Number(p.amount), 0);

  const index = localBills.findIndex((b) => b.id === billId);
  if (index !== -1) {
    const totalAmt = localBills[index].total_amount;
    let status: Bill['status'] = 'Unpaid';
    if (totalPaid >= totalAmt) status = 'Paid';
    else if (totalPaid > 0) status = 'Partially Paid';

    localBills[index].amount_paid = totalPaid;
    localBills[index].status = status;

    await saveLocalData(KEYS.BILLS, localBills);
  }
}

// --- STATEMENTS & LEDGER SERVICE ---

export async function getCustomerStatement(customerId: string): Promise<CustomerStatement> {
  const customers = await getCustomers();
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const allBills = await getLocalData<Bill>(KEYS.BILLS);
  const client = getFirebase();
  let customerBills: Bill[] = [];
  let customerPayments: Payment[] = [];

  if (client) {
    try {
      const bData = await client.select('bills', { customer_id: customerId, is_estimate: false });
      customerBills = bData || [];

      const pData = await client.select('payments', { customer_id: customerId });
      customerPayments = pData || [];
    } catch {
      customerBills = allBills.filter((b) => b.customer_id === customerId && !b.is_estimate);
      const allPayments = await getLocalData<Payment>(KEYS.PAYMENTS);
      customerPayments = allPayments.filter((p) => p.customer_id === customerId);
    }
  } else {
    customerBills = allBills.filter((b) => b.customer_id === customerId && !b.is_estimate);
    const allPayments = await getLocalData<Payment>(KEYS.PAYMENTS);
    customerPayments = allPayments.filter((p) => p.customer_id === customerId);
  }

  const transactions: StatementItem[] = [];

  // Opening Balance
  let running_balance = Number(customer.opening_balance);
  transactions.push({
    id: 'op-bal',
    date: customer.created_at ? customer.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    type: 'Opening Balance',
    reference: 'N/A',
    debit: running_balance >= 0 ? running_balance : 0,
    credit: running_balance < 0 ? Math.abs(running_balance) : 0,
    running_balance,
    details: 'Initial outstanding balance on customer profile creation',
  });

  const ledgerItems: { date: string; item: StatementItem }[] = [];

  customerBills.forEach((bill) => {
    ledgerItems.push({
      date: bill.bill_date,
      item: {
        id: bill.id,
        date: bill.bill_date,
        type: 'Sales Bill',
        reference: bill.bill_number,
        debit: Number(bill.total_amount),
        credit: 0,
        running_balance: 0,
        details: `Invoice for ${bill.notes || 'goods/services sold'}`,
      },
    });
  });

  customerPayments.forEach((payment) => {
    ledgerItems.push({
      date: payment.payment_date,
      item: {
        id: payment.id,
        date: payment.payment_date,
        type: 'Payment',
        reference: payment.payment_mode,
        debit: 0,
        credit: Number(payment.amount),
        running_balance: 0,
        details: payment.notes || 'Payment received',
      },
    });
  });

  ledgerItems.sort((a, b) => a.date.localeCompare(b.date));

  let totalBilled = 0;
  let totalPaid = 0;

  ledgerItems.forEach((li) => {
    const item = li.item;
    totalBilled += item.debit;
    totalPaid += item.credit;
    running_balance = running_balance + item.debit - item.credit;
    item.running_balance = running_balance;
    transactions.push(item);
  });

  return {
    customer,
    opening_balance: Number(customer.opening_balance),
    total_billed: totalBilled,
    total_paid: totalPaid,
    outstanding_balance: running_balance,
    transactions,
  };
}

// --- DEMO DATA GENERATOR ---

export async function generateDemoData(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.CUSTOMERS);
  await AsyncStorage.removeItem(KEYS.BILLS);
  await AsyncStorage.removeItem(KEYS.BILL_ITEMS);
  await AsyncStorage.removeItem(KEYS.PAYMENTS);

  const demoCustomers: Customer[] = [
    {
      id: 'cust-1',
      name: 'Acme Corporates',
      phone: '+91 99999 88888',
      email: 'finance@acme.com',
      address: 'Industrial Zone Phase 1, Mumbai',
      opening_balance: 5000,
      created_at: '2026-05-01T10:00:00Z',
    },
    {
      id: 'cust-2',
      name: 'Karthik Kumar',
      phone: '+91 98888 77777',
      email: 'karthik@gmail.com',
      address: 'HSR Layout Sector 4, Bangalore',
      opening_balance: 0,
      created_at: '2026-05-05T12:00:00Z',
    },
    {
      id: 'cust-3',
      name: 'Global Solutions Ltd',
      phone: '+91 97777 66666',
      email: 'vendor@globalsol.in',
      address: 'Tech Park East, Hyderabad',
      opening_balance: -2000,
      created_at: '2026-05-10T09:00:00Z',
    },
    {
      id: 'cust-4',
      name: 'Anjali Sharma',
      phone: '+91 96666 55555',
      email: 'anjali@outlook.com',
      address: 'Rohini Sector 11, New Delhi',
      opening_balance: 1500,
      created_at: '2026-05-12T14:00:00Z',
    },
    {
      id: 'cust-5',
      name: 'Techno Labs',
      phone: '+91 95555 44444',
      email: 'info@technolabs.org',
      address: 'Salt Lake City Sector V, Kolkata',
      opening_balance: 12500,
      created_at: '2026-05-15T11:00:00Z',
    },
  ];

  const demoBills: Bill[] = [
    {
      id: 'bill-1',
      bill_number: 'INV-2026-001',
      customer_id: 'cust-1',
      bill_date: '2026-05-03',
      due_date: '2026-05-18',
      subtotal: 10000,
      discount: 1000,
      tax_amount: 1620,
      total_amount: 10620,
      amount_paid: 10620,
      status: 'Paid',
      is_estimate: false,
      notes: 'Monthly IT Consulting Service & Cloud infrastructure support.',
      created_at: '2026-05-03T10:00:00Z',
    },
    {
      id: 'bill-2',
      bill_number: 'INV-2026-002',
      customer_id: 'cust-2',
      bill_date: '2026-05-06',
      due_date: '2026-05-21',
      subtotal: 15000,
      discount: 0,
      tax_amount: 2700,
      total_amount: 17700,
      amount_paid: 5000,
      status: 'Partially Paid',
      is_estimate: false,
      notes: 'Custom UI/UX website wireframing and initial frontend code.',
      created_at: '2026-05-06T11:00:00Z',
    },
    {
      id: 'bill-3',
      bill_number: 'INV-2026-003',
      customer_id: 'cust-5',
      bill_date: '2026-05-16',
      due_date: '2026-05-31',
      subtotal: 25000,
      discount: 2500,
      tax_amount: 4050,
      total_amount: 26550,
      amount_paid: 0,
      status: 'Unpaid',
      is_estimate: false,
      notes: 'Mobile app deployment to iOS App Store & Android Play Store.',
      created_at: '2026-05-16T12:00:00Z',
    },
    {
      id: 'bill-4',
      bill_number: 'EST-2026-001',
      customer_id: 'cust-3',
      bill_date: '2026-05-18',
      due_date: '2026-06-02',
      subtotal: 8000,
      discount: 500,
      tax_amount: 1350,
      total_amount: 8850,
      amount_paid: 0,
      status: 'Unpaid',
      is_estimate: true,
      notes: 'PROPOSAL: Search Engine Optimization & monthly SEO reporting.',
      created_at: '2026-05-18T14:00:00Z',
    },
    {
      id: 'bill-5',
      bill_number: 'EST-2026-002',
      customer_id: 'cust-4',
      bill_date: '2026-05-20',
      due_date: '2026-06-04',
      subtotal: 3000,
      discount: 0,
      tax_amount: 540,
      total_amount: 3540,
      amount_paid: 0,
      status: 'Unpaid',
      is_estimate: true,
      notes: 'PROPOSAL: Content writing & 3 corporate blog posts.',
      created_at: '2026-05-20T10:00:00Z',
    },
  ];

  const demoItems: BillItem[] = [
    {
      id: 'item-1',
      bill_id: 'bill-1',
      item_name: 'IT Consulting Hours',
      quantity: 5,
      price: 1500,
      tax_rate: 18,
      discount_rate: 10,
      total: 6750,
    },
    {
      id: 'item-2',
      bill_id: 'bill-1',
      item_name: 'AWS Server Setup',
      quantity: 1,
      price: 2500,
      tax_rate: 18,
      discount_rate: 10,
      total: 2250,
    },
    {
      id: 'item-3',
      bill_id: 'bill-2',
      item_name: 'Web Wireframes (Figma)',
      quantity: 10,
      price: 1500,
      tax_rate: 18,
      discount_rate: 0,
      total: 15000,
    },
    {
      id: 'item-4',
      bill_id: 'bill-3',
      item_name: 'iOS App Store Deployment',
      quantity: 1,
      price: 12500,
      tax_rate: 18,
      discount_rate: 10,
      total: 11250,
    },
    {
      id: 'item-5',
      bill_id: 'bill-3',
      item_name: 'Android App Store Deployment',
      quantity: 1,
      price: 12500,
      tax_rate: 18,
      discount_rate: 10,
      total: 11250,
    },
    {
      id: 'item-6',
      bill_id: 'bill-4',
      item_name: 'Monthly SEO Retainer',
      quantity: 2,
      price: 4000,
      tax_rate: 18,
      discount_rate: 6.25,
      total: 7500,
    },
    {
      id: 'item-7',
      bill_id: 'bill-5',
      item_name: 'Corporate Blog Post',
      quantity: 3,
      price: 1000,
      tax_rate: 18,
      discount_rate: 0,
      total: 3000,
    },
  ];

  const demoPayments: Payment[] = [
    {
      id: 'pay-1',
      customer_id: 'cust-1',
      bill_id: 'bill-1',
      amount: 10620,
      payment_date: '2026-05-04',
      payment_mode: 'UPI',
      notes: 'Cleared Invoice INV-2026-001',
      created_at: '2026-05-04T12:00:00Z',
    },
    {
      id: 'pay-2',
      customer_id: 'cust-2',
      bill_id: 'bill-2',
      amount: 5000,
      payment_date: '2026-05-08',
      payment_mode: 'Bank Transfer',
      notes: 'Advance for web design - INV-2026-002',
      created_at: '2026-05-08T15:00:00Z',
    },
    {
      id: 'pay-3',
      customer_id: 'cust-3',
      bill_id: undefined,
      amount: 1500,
      payment_date: '2026-05-15',
      payment_mode: 'Cash',
      notes: 'General advance payment on account',
      created_at: '2026-05-15T10:00:00Z',
    },
  ];

  // Save locally
  await saveLocalData(KEYS.CUSTOMERS, demoCustomers);
  await saveLocalData(KEYS.BILLS, demoBills);
  await saveLocalData(KEYS.BILL_ITEMS, demoItems);
  await saveLocalData(KEYS.PAYMENTS, demoPayments);

  // Sync to Firebase if active
  const client = getFirebase();
  if (client) {
    try {
      console.log('[Firebase Sync] Syncing demo data...');
      await client.insert('business_profile', 'default', DEFAULT_PROFILE);
      for (const customer of demoCustomers) {
        await client.insert('customers', customer.id, customer);
      }
      for (const bill of demoBills) {
        await client.insert('bills', bill.id, bill);
      }
      for (const item of demoItems) {
        await client.insert('bill_items', item.id, item);
      }
      for (const pay of demoPayments) {
        await client.insert('payments', pay.id, pay);
      }
      console.log('[Firebase Sync] Demo data synced successfully!');
    } catch (e) {
      console.warn('[Firebase Sync] Firebase seed skipped:', e);
    }
  }

  console.log('[Database] Demo data generated successfully.');
}
