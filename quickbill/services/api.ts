import {
  Party,
  Item,
  Invoice,
  Payment,
  Expense,
  User,
} from '../types';

// ========================
// CONFIG
// ========================
const API_BASE = 'http://localhost:4000/api'; // change if needed

const KEYS = {
  SESSION: 'quickbill_session',
};

// Generic helper to handle responses
const handleResponse = async <T = any>(res: Response): Promise<T> => {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(message);
  }

  // No content
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};

// ========================
// AUTH SERVICE
// ========================
export const AuthService = {
  login: async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const user = await handleResponse<User>(res);

    // Store session on frontend (simple version, no JWT)
    localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  logout: async (): Promise<void> => {
    // Optional: hit backend /auth/logout if you implement it
    // await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });

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
    role: User['role'];
  }): Promise<User> => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return handleResponse<User>(res);
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
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

  create: async (party: Omit<Party, 'id'>): Promise<Party> => {
    const res = await fetch(`${API_BASE}/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(party),
    });
    return handleResponse<Party>(res);
  },

  update: async (id: string, data: Partial<Party>): Promise<void> => {
    const res = await fetch(`${API_BASE}/parties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleResponse(res);
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/parties/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(res);
  },

  // Optional: only if you still need manual adjustment from UI
  updateBalance: async (id: string, amount: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/parties/${id}/balance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  create: async (item: Omit<Item, 'id'>): Promise<Item> => {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse<Item>(res);
  },

  update: async (id: string, data: Partial<Item>): Promise<void> => {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await handleResponse(res);
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
    });
    await handleResponse(res);
  },

  // Optional, only if you need manual stock adjust UI
  adjustStock: async (id: string, addedQuantity: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/items/${id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addedQuantity }),
    });
    await handleResponse(res);
  },
};

// ========================
// INVOICE SERVICE
// ========================
//
// IMPORTANT:
// All stock updates + party balance updates that you
// previously did on the frontend MUST now be done
// in the backend inside POST /invoices.
//
export const InvoiceService = {
  getAll: async (): Promise<Invoice[]> => {
    const res = await fetch(`${API_BASE}/invoices`);
    return handleResponse<Invoice[]>(res);
  },

  getById: async (id: string): Promise<Invoice | undefined> => {
    const res = await fetch(`${API_BASE}/invoices/${id}`);
    return handleResponse<Invoice>(res);
  },

  create: async (invoice: Omit<Invoice, 'id'>): Promise<Invoice> => {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice),
    });

    // Backend will:
    // - create invoice + invoice_items
    // - update item stock based on type
    // - update party balance based on type
    return handleResponse<Invoice>(res);
  },
};

// ========================
// PAYMENT SERVICE
// ========================
//
// Backend should also update party balance based on IN / OUT.
//
export const PaymentService = {
  getAll: async (): Promise<Payment[]> => {
    const res = await fetch(`${API_BASE}/payments`);
    return handleResponse<Payment[]>(res);
  },

  create: async (payment: Omit<Payment, 'id'>): Promise<Payment> => {
    const res = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });

    // Backend will:
    // - insert payment
    // - adjust party balance (IN = -amount, OUT = +amount)
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

  create: async (expense: Omit<Expense, 'id'>): Promise<Expense> => {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    return handleResponse<Expense>(res);
  },
};


