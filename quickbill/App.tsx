
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Parties from './pages/Parties';
import Items from './pages/Items';
import Stock from './pages/Stock';
import InvoiceList from './pages/InvoiceList';
import InvoiceCreate from './pages/InvoiceCreate';
import InvoiceView from './pages/InvoiceView';
import PaymentIn from './pages/PaymentIn';
import PaymentOut from './pages/PaymentOut';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import UsersPage from './pages/Users';
import { Party, Item, Invoice, ViewState, TransactionType, User } from './types';
import { PartyService, ItemService, InvoiceService, AuthService } from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  // Track previous view for better "Back" navigation from InvoiceView
  const [previousView, setPreviousView] = useState<ViewState>('DASHBOARD');
  
  // Track which type of transaction we are creating
  const [creationType, setCreationType] = useState<TransactionType>('SALE');

  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // Selected invoice for viewing
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  // Auto print flag
  const [autoPrint, setAutoPrint] = useState(false);

  // Auth & Init
  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoadingAuth(false);
  }, []);

  const refreshData = async () => {
    try {
      const [p, i, inv] = await Promise.all([
        PartyService.getAll(),
        ItemService.getAll(),
        InvoiceService.getAll()
      ]);
      setParties(p);
      setItems(i);
      setInvoices(inv);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('DASHBOARD');
  };

  const handleLogout = () => {
    AuthService.logout();
    setUser(null);
  };

  const changeView = (view: ViewState) => {
    // Role Protection
    if (view === 'REPORTS' || view === 'EXPENSES') {
       if (user?.role === 'STAFF') {
          alert('Access Denied: Admins only');
          return;
       }
    }
    if (view === 'USERS') {
       if (user?.role !== 'SUPER_ADMIN') {
          alert('Access Denied: Super Admin only');
          return;
       }
    }
    setPreviousView(currentView);
    setCurrentView(view);
  };

  // Helper to start a specific transaction
  const startTransaction = (type: TransactionType) => {
    setCreationType(type);
    setPreviousView(currentView);
    setCurrentView('CREATE_TRANSACTION');
  };

  const handleCreateInvoiceSuccess = (newInvoice: Invoice, shouldPrint: boolean = false) => {
    refreshData();
    setSelectedInvoice(newInvoice);
    setAutoPrint(shouldPrint);
    
    // Determine logical back path
    if (newInvoice.type === 'SALE') setPreviousView('SALES_INVOICES');
    else if (newInvoice.type === 'RETURN') setPreviousView('SALES_RETURNS');
    else if (newInvoice.type === 'PURCHASE') setPreviousView('PURCHASE_INVOICES');
    else if (newInvoice.type === 'PURCHASE_RETURN') setPreviousView('PURCHASE_RETURNS');

    setCurrentView('VIEW_INVOICE');
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setAutoPrint(false);
    setPreviousView(currentView); // Remember where we came from
    setCurrentView('VIEW_INVOICE');
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setAutoPrint(true);
    setPreviousView(currentView); // Remember where we came from
    setCurrentView('VIEW_INVOICE');
  };

  const handleBackFromInvoice = () => {
    // If previous view was create, go to list instead to avoid loop/confusion
    if (previousView === 'CREATE_TRANSACTION' || previousView === 'VIEW_INVOICE') {
      // Default fallback
      setCurrentView('SALES_INVOICES');
    } else {
      setCurrentView(previousView);
    }
  };

  // Render logic based on state
  const renderContent = () => {
    const canManageData = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    switch (currentView) {
      case 'DASHBOARD':
        return <Dashboard invoices={invoices} parties={parties} items={items} />;
      case 'PARTIES':
        return <Parties parties={parties} onRefresh={refreshData} />;
      case 'ITEMS':
        return <Items items={items} onRefresh={refreshData} userRole={user?.role} />;
      case 'STOCK':
        return <Stock items={items} onRefresh={refreshData} userRole={user?.role} />;
      
      // Sales Routes
      case 'SALES_INVOICES':
        return (
          <InvoiceList 
            invoices={invoices} 
            onView={handleViewInvoice} 
            onPrint={handlePrintInvoice} 
            onCreate={() => startTransaction('SALE')}
            type="SALE" 
          />
        );
      case 'SALES_RETURNS':
        return (
          <InvoiceList 
            invoices={invoices} 
            onView={handleViewInvoice} 
            onPrint={handlePrintInvoice} 
            onCreate={() => startTransaction('RETURN')}
            type="RETURN" 
          />
        );
      case 'PAYMENT_IN':
        return <PaymentIn parties={parties} onRefresh={refreshData} />;

      // Purchase Routes
      case 'PURCHASE_INVOICES':
         return (
          <InvoiceList 
            invoices={invoices} 
            onView={handleViewInvoice} 
            onPrint={handlePrintInvoice} 
            onCreate={() => startTransaction('PURCHASE')}
            type="PURCHASE" 
          />
        );
      case 'PURCHASE_RETURNS':
         return (
          <InvoiceList 
            invoices={invoices} 
            onView={handleViewInvoice} 
            onPrint={handlePrintInvoice} 
            onCreate={() => startTransaction('PURCHASE_RETURN')}
            type="PURCHASE_RETURN" 
          />
        );
      case 'PAYMENT_OUT':
         return <PaymentOut parties={parties} onRefresh={refreshData} />;
      
      case 'EXPENSES':
         if (!canManageData) return <div className="p-8 text-center text-red-500">Access Denied</div>;
         return <Expenses onRefresh={refreshData} />;

      // Reports
      case 'REPORTS':
        if (!canManageData) return <div className="p-8 text-center text-red-500">Access Denied</div>;
        return <Reports invoices={invoices} parties={parties} items={items} />;

      // Super Admin Only
      case 'USERS':
        if (user?.role !== 'SUPER_ADMIN') return <div className="p-8 text-center text-red-500">Access Denied</div>;
        return <UsersPage />;

      // Transaction Create Routes
      case 'CREATE_TRANSACTION':
        return (
          <InvoiceCreate 
            parties={parties} 
            items={items} 
            onCancel={() => {
              // Go back to the list relevant to the type we were creating
              if (creationType === 'RETURN') changeView('SALES_RETURNS');
              else if (creationType === 'PURCHASE') changeView('PURCHASE_INVOICES');
              else if (creationType === 'PURCHASE_RETURN') changeView('PURCHASE_RETURNS');
              else changeView('SALES_INVOICES');
            }}
            onSuccess={handleCreateInvoiceSuccess}
            initialType={creationType}
          />
        );
      case 'VIEW_INVOICE':
        if (!selectedInvoice) return <InvoiceList invoices={invoices} onView={handleViewInvoice} onPrint={handlePrintInvoice} type="SALE" onCreate={() => startTransaction('SALE')} />;
        return (
          <InvoiceView 
            invoice={selectedInvoice} 
            onBack={handleBackFromInvoice} 
            autoPrint={autoPrint}
          />
        );
      default:
        return <Dashboard invoices={invoices} parties={parties} items={items} />;
    }
  };

  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center bg-slate-100">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout currentView={currentView} onChangeView={changeView} user={user} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  );
};

export default App;