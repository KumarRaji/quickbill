
export interface Party {
  id: string;
  name: string;
  phone: string;
  gstin?: string;
  address?: string;
  balance: number; // Positive for receivable, negative for payable
}

export interface Item {
  id: string;
  name: string;
  code?: string;
  barcode?: string; // Scannable barcode (UPC/EAN)
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  taxRate: number; // Percentage
}

export interface InvoiceItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  taxRate: number;
  amount: number; // (price * quantity)
}

export type TransactionType = 'SALE' | 'RETURN' | 'PURCHASE' | 'PURCHASE_RETURN';

export interface Invoice {
  id: string;
  type: TransactionType;
  invoiceNumber: string;
  date: string;
  partyId: string;
  partyName: string;
  originalRefNumber?: string; // Reference to original invoice for returns
  items: InvoiceItem[];
  totalAmount: number;
  totalTax: number;
  status: 'PAID' | 'UNPAID';
}

export interface Payment {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  amount: number;
  type: 'IN' | 'OUT';
  mode: 'CASH' | 'ONLINE' | 'CHEQUE';
  note?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  note?: string;
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}

export type ViewState = 
  | 'DASHBOARD' 
  | 'PARTIES' 
  | 'ITEMS' 
  | 'STOCK'
  | 'SALES_INVOICES' 
  | 'SALES_RETURNS' 
  | 'PAYMENT_IN' 
  | 'PURCHASE_INVOICES' 
  | 'PURCHASE_RETURNS'
  | 'PAYMENT_OUT'
  | 'EXPENSES'
  | 'CREATE_TRANSACTION' 
  | 'VIEW_INVOICE'
  | 'REPORTS'
  | 'USERS';