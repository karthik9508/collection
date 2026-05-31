-- ====================================================================
-- BILLING ERP MOBILE APP - SUPABASE DATABASE SCHEMA
-- Copy and paste this script into your Supabase SQL Editor and run it.
-- ====================================================================

-- 1. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    opening_balance NUMERIC DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Bills Table (Unified for both Sales Bills and Estimates)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    bill_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    subtotal NUMERIC NOT NULL DEFAULT 0.00,
    discount NUMERIC DEFAULT 0.00,
    tax_amount NUMERIC DEFAULT 0.00,
    total_amount NUMERIC NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Partially Paid', 'Unpaid')),
    is_estimate BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Bill Items Table (Row items for each invoice)
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    price NUMERIC NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC DEFAULT 0.00, -- e.g. 18 for 18% tax
    discount_rate NUMERIC DEFAULT 0.00, -- percentage discount
    total NUMERIC NOT NULL DEFAULT 0.00
);

-- 4. Create Payments Table (Records payment receipts)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE NOT NULL,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Bank Transfer')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) & ACCESS CONTROL (Optional)
-- By default, Supabase requires authenticated user permissions or RLS policies.
-- For quick prototyping, you can disable RLS or use the Anon Key policies below.
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies allowing all operations for the public anon key (for fast testing)
CREATE POLICY "Allow public select on customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on customers" ON public.customers FOR DELETE USING (true);

CREATE POLICY "Allow public select on bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bills" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on bills" ON public.bills FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on bills" ON public.bills FOR DELETE USING (true);

CREATE POLICY "Allow public select on bill_items" ON public.bill_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bill_items" ON public.bill_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on bill_items" ON public.bill_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on bill_items" ON public.bill_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on payments" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on payments" ON public.payments FOR DELETE USING (true);

-- Done!
