export interface Party {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  balance: number;
  type?: 'CUSTOMER' | 'SUPPLIER';
}

export interface Item {
  id: string;
  name: string;
  category?: string;
  code?: string;
  barcode?: string;        // Scannable barcode (UPC/EAN)
  supplierId?: number;
  mrp?: number;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  taxRate: number;         // Percentage
}

export interface InvoiceItem {
  id?: string;             // ✅ backend returns id sometimes
  itemId: string;
  itemName: string;
  quantity: number;
  mrp?: number;
  price: number;
  taxRate: number;
  amount: number;          // line total (your backend uses `total`)
}

export type TransactionType = "SALE" | "RETURN" | "PURCHASE" | "PURCHASE_RETURN";

export type PaymentMode = "CASH" | "ONLINE" | "CHEQUE" | "CREDIT";

export type InvoiceStatus = "PAID" | "UNPAID" | "PENDING"; // ✅ allow pending (failed payment scenario)

export type DueStatus = "PENDING" | "PARTIAL" | "PAID";

export interface Invoice {
  id: string;
  type: TransactionType;
  invoiceNumber: string;
  date: string;

  partyId: string;
  partyName: string;

  // ✅ ADD THIS LINE (FOR RETURNS)
  originalRefNumber?: string | null;

  items: InvoiceItem[];

  totalAmount: number;
  totalTax: number;

  status: InvoiceStatus;
  paymentMode: PaymentMode;

  // Optional payment tracking for due status display
  amountPaid?: number;
  amountDue?: number;
  dueStatus?: DueStatus;
  roundOff?: number;

  // Tax configuration captured on the invoice
  taxMode?: "IN_TAX" | "OUT_TAX"; // IN_TAX => inclusive rates, OUT_TAX => add tax on top
  gstType?: "IN_TAX" | "OUT_TAX"; // IN_TAX => CGST/SGST, OUT_TAX => IGST

  notes?: string | null;
}


export type PaymentType = "IN" | "OUT";

export type PaymentModeSimple = "CASH" | "ONLINE" | "CHEQUE"; // payments table uses varchar but UI usually these

export interface Payment {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  amount: number;
  type: PaymentType;
  mode: PaymentModeSimple;
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  notes?: string;
}

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "STAFF";

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}
export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  gstin?: string | null;
  address?: string | null;
  balance: number;
  created_at?: string;
  updated_at?: string;
}


export type ViewState =
  | "DASHBOARD"
  | "PARTIES"
  | "SUPPLIERS"
  | "ITEMS"
  | "STOCK"
  | "STOCK_MANAGEMENT"
  | "SALES_INVOICES"
  | "SALE_RETURN_NEW"
  | "PAYMENT_IN"
  | "PURCHASE_INVOICES"
  | "PURCHASE_RETURNS"
  | "PAYMENT_OUT"
  | "EXPENSES"
  | "CREATE_TRANSACTION"
  | "VIEW_INVOICE"
  | "REPORTS"
  | "USERS";
