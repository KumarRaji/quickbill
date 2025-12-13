import { Party, Item, Invoice, Payment, Expense, User } from "../types";

// ========================
// CONFIG
// ========================
const API_BASE = "http://localhost:4000/api"; // change if needed

const KEYS = {
  SESSION: "quickbill_session",
};

// ========================
// RESPONSE HELPER
// ========================
const handleResponse = async <T = any>(res: Response): Promise<T> => {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.message || message;
      if (data?.error) message += `: ${data.error}`;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

// ========================
// AUTH SERVICE
// ========================
export const AuthService = {
  login: async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const user = await handleResponse<User>(res);
    localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem(KEYS.SESSION);
  },

  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(KEYS.SESSION);
    return session ? (JSON.parse(session) as User) : null;
  },
};

// ========================
// USER SERVICE
// ========================
export const UserService = {
  getAll: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`);
    return handleResponse<User[]>(res);
  },

  create: async (user: {
    name: string;
    username: string;
    password: string;
    role: User["role"];
  }): Promise<User> => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    return handleResponse<User>(res);
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
    });
    await handleResponse(res);
  },
};

// ========================
// PARTY SERVICE
// ========================
export const PartyService = {
  getAll: async (): Promise<Party[]> => {
    const res = await fetch(`${API_BASE}/parties`);
    return handleResponse<Party[]>(res);
  },

  create: async (party: Omit<Party, "id">): Promise<Party> => {
    const res = await fetch(`${API_BASE}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(party),
    });
    return handleResponse<Party>(res);
  },

  update: async (id: string, data: Partial<Party>): Promise<void> => {
    const res = await fetch(`${API_BASE}/parties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await handleResponse(res);
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/parties/${id}`, {
      method: "DELETE",
    });
    await handleResponse(res);
  },

  updateBalance: async (id: string, amount: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/parties/${id}/balance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    await handleResponse(res);
  },
};

// ========================
// ITEM SERVICE
// ========================
export const ItemService = {
  getAll: async (): Promise<Item[]> => {
    const res = await fetch(`${API_BASE}/items`);
    return handleResponse<Item[]>(res);
  },

  create: async (item: Omit<Item, "id">): Promise<Item> => {
    const res = await fetch(`${API_BASE}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    return handleResponse<Item>(res);
  },

  update: async (id: string, data: Partial<Item>): Promise<void> => {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await handleResponse(res);
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: "DELETE",
    });
    await handleResponse(res);
  },

  adjustStock: async (id: string, addedQuantity: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/items/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addedQuantity }),
    });
    await handleResponse(res);
  },

  // ✅ NEW: Bulk Upload (CSV / Excel)
  bulkUpload: async (file: File): Promise<{ message: string; totalRows: number; affectedRows: number }> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/items/bulk-upload`, {
      method: "POST",
      body: formData,
    });

    return handleResponse(res);
  },
};

// ========================
// INVOICE SERVICE
// ========================
export const InvoiceService = {
  getAll: async (): Promise<Invoice[]> => {
    const res = await fetch(`${API_BASE}/invoices`);
    return handleResponse<Invoice[]>(res);
  },

  getById: async (id: string): Promise<Invoice> => {
    const res = await fetch(`${API_BASE}/invoices/${id}`);
    return handleResponse<Invoice>(res);
  },

  applySaleReturnToOriginal: async (
    originalInvoiceId: string,
    payload: {
      processedBy?: string;
      reason?: string;
      items: { itemId: string; quantity: number }[];
    }
  ): Promise<{ returnInvoiceId: string }> => {
    const res = await fetch(`${API_BASE}/invoices/${originalInvoiceId}/sale-return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return handleResponse<{ returnInvoiceId: string }>(res);
  },

  applyPurchaseReturnToOriginal: async (
    originalInvoiceId: string,
    payload: {
      processedBy?: string;
      reason?: string;
      items: { itemId: string; quantity: number }[];
    }
  ): Promise<{ returnInvoiceId: string }> => {
    const res = await fetch(`${API_BASE}/invoices/${originalInvoiceId}/purchase-return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return handleResponse<{ returnInvoiceId: string }>(res);
  },

  create: async (invoice: Omit<Invoice, "id">): Promise<Invoice> => {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoice),
    });
    return handleResponse<Invoice>(res);
  },
};

// ========================
// PAYMENT SERVICE
// ========================
export const PaymentService = {
  getAll: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_BASE}/payments`);
    return handleResponse<Payment[]>(res);
  },

  create: async (payment: Omit<Payment, "id">): Promise<Payment> => {
    const res = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });
    return handleResponse<Payment>(res);
  },
};

// ========================
// EXPENSE SERVICE
// ========================
export const ExpenseService = {
  getAll: async (): Promise<Expense[]> => {
    const res = await fetch(`${API_BASE}/expenses`);
    return handleResponse<Expense[]>(res);
  },

  create: async (expense: Omit<Expense, "id">): Promise<Expense> => {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    });
    return handleResponse<Expense>(res);
  },
};
