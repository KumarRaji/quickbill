import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Parties from "./pages/Parties";
import Items from "./pages/Items";
import Stock from "./pages/Stock";
import InvoiceList from "./pages/InvoiceList";
import InvoiceCreate from "./pages/InvoiceCreate";
import InvoiceView from "./pages/InvoiceView";
import PaymentIn from "./pages/PaymentIn";
import PaymentOut from "./pages/PaymentOut";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import UsersPage from "./pages/Users";
import SaleReturn from "./pages/SaleReturn";
import PurchaseReturn from "./pages/PurchaseReturn"; // ✅ ADD
import { Party, Item, Invoice, ViewState, TransactionType, User, Expense } from "./types";
import { PartyService, ItemService, InvoiceService, AuthService, ExpenseService } from "./services/api";

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Used ONLY for special modes (CREATE_TRANSACTION, VIEW_INVOICE)
  const [currentView, setCurrentView] = useState<ViewState>("DASHBOARD");
  const [creationType, setCreationType] = useState<TransactionType>("SALE");

  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

  // ===================== AUTH =====================

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoadingAuth(false);
  }, []);

  // ===================== DATA HELPERS =====================

  const refreshData = async () => {
    try {
      const [p, i, inv, exp] = await Promise.all([
        PartyService.getAll(),
        ItemService.getAll(),
        InvoiceService.getAll(),
        ExpenseService.getAll(),
      ]);
      setParties(p);
      setItems(i);
      setInvoices(inv);
      setExpenses(exp);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  // 🔹 Load data based on current route (first load / when URL changes)
  useEffect(() => {
    if (!user) return;

    const loadForRoute = async () => {
      try {
        const path = location.pathname;

        // Dashboard + Reports → need everything
        if (path === "/" || path === "/reports") {
          await refreshData();
        }

        // Quick Sale → needs parties + items
        else if (path === "/quick-sale") {
          const [p, i] = await Promise.all([PartyService.getAll(), ItemService.getAll()]);
          setParties(p);
          setItems(i);
        }

        // ✅ Sale Return page needs invoices (+ items if your SaleReturn shows item details)
        else if (path.startsWith("/sale-return")) {
          const [inv, i] = await Promise.all([InvoiceService.getAll(), ItemService.getAll()]);
          setInvoices(inv);
          setItems(i);
        }

        // ✅ Purchase Return page needs invoices (purchase bills)
        else if (path.startsWith("/purchases/returns")) {
          const inv = await InvoiceService.getAll();
          setInvoices(inv);
        }

        // Parties page
        else if (path.startsWith("/parties")) {
          const p = await PartyService.getAll();
          setParties(p);
        }

        // Items / Stock pages
        else if (path.startsWith("/items") || path.startsWith("/stock")) {
          const i = await ItemService.getAll();
          setItems(i);
        }

        // Sales / Purchase pages -> need invoices + parties
        else if (path.startsWith("/sales") || path.startsWith("/purchases")) {
          const [inv, p] = await Promise.all([InvoiceService.getAll(), PartyService.getAll()]);
          setInvoices(inv);
          setParties(p);
        }

        // Expenses page
        else if (path.startsWith("/expenses")) {
          const exp = await ExpenseService.getAll();
          setExpenses(exp);
        }
      } catch (error) {
        console.error("Failed to fetch data for route", location.pathname, error);
      }
    };

    loadForRoute();
  }, [user, location.pathname]);

  // ===================== AUTH HANDLERS =====================

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    navigate("/", { replace: true });
    setCurrentView("DASHBOARD");
  };

  const handleLogout = () => {
    AuthService.logout();
    setUser(null);
  };

  // ===================== VIEW / ROUTING =====================

  const changeView = (view: ViewState) => {
    // Role Protection
    if (view === "REPORTS" || view === "EXPENSES") {
      if (user?.role === "STAFF") {
        alert("Access Denied: Admins only");
        return;
      }
    }
    if (view === "USERS") {
      if (user?.role !== "SUPER_ADMIN") {
        alert("Access Denied: Super Admin only");
        return;
      }
    }

    setCurrentView(view);

    const routes: Record<string, string> = {
      DASHBOARD: "/",
      PARTIES: "/parties",
      ITEMS: "/items",
      STOCK: "/stock",
      SALES_INVOICES: "/sales/invoices",
      SALE_RETURN_NEW: "/sale-return",
      PAYMENT_IN: "/sales/payment-in",
      PURCHASE_INVOICES: "/purchases/bills",
      PURCHASE_RETURNS: "/purchases/returns",
      PAYMENT_OUT: "/purchases/payment-out",
      EXPENSES: "/expenses",
      REPORTS: "/reports",
      USERS: "/users",
    };

    // Do NOT change URL for these special screens
    if (view !== "CREATE_TRANSACTION" && view !== "VIEW_INVOICE") {
      navigate(routes[view] || "/");
    }
  };

  const startTransaction = (type: TransactionType) => {
    setCreationType(type);
    setCurrentView("CREATE_TRANSACTION"); // no route change
  };

  const handleCreateInvoiceSuccess = (newInvoice: Invoice, shouldPrint: boolean = false) => {
    refreshData();
    setSelectedInvoice(newInvoice);
    setAutoPrint(shouldPrint);
    setCurrentView("VIEW_INVOICE"); // no route change
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setAutoPrint(false);
    setCurrentView("VIEW_INVOICE");
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setAutoPrint(true);
    setCurrentView("VIEW_INVOICE");
  };

  const handleBackFromInvoice = () => {
    changeView("SALES_INVOICES");
  };

  const canManageData = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const getCurrentViewFromPath = (): ViewState => {
    const pathMap: Record<string, ViewState> = {
      "/": "DASHBOARD",
      "/parties": "PARTIES",
      "/items": "ITEMS",
      "/stock": "STOCK",
      "/sales/invoices": "SALES_INVOICES",
      "/sale-return": "SALE_RETURN_NEW",
      "/sales/payment-in": "PAYMENT_IN",
      "/purchases/bills": "PURCHASE_INVOICES",
      "/purchases/returns": "PURCHASE_RETURNS",
      "/purchases/payment-out": "PAYMENT_OUT",
      "/expenses": "EXPENSES",
      "/reports": "REPORTS",
      "/users": "USERS",
    };

    if (currentView === "CREATE_TRANSACTION" || currentView === "VIEW_INVOICE") {
      return currentView;
    }

    return pathMap[location.pathname] || "DASHBOARD";
  };

  // ===================== RENDER =====================

  const renderContent = () => {
    // Special screens with NO route change
    if (currentView === "CREATE_TRANSACTION") {
      return (
        <InvoiceCreate
          parties={parties}
          items={items}
          onCancel={() => {
            if (creationType === "RETURN") changeView("SALE_RETURN_NEW");
            else if (creationType === "PURCHASE") changeView("PURCHASE_INVOICES");
            else if (creationType === "PURCHASE_RETURN") changeView("PURCHASE_RETURNS");
            else changeView("SALES_INVOICES");
          }}
          onSuccess={handleCreateInvoiceSuccess}
          initialType={creationType}
          hideAddItemButton={true}
        />
      );
    }

    if (currentView === "VIEW_INVOICE") {
      if (!selectedInvoice) {
        return (
          <InvoiceList
            invoices={invoices}
            onView={handleViewInvoice}
            onPrint={handlePrintInvoice}
            type="SALE"
            onCreate={() => startTransaction("SALE")}
          />
        );
      }
      return (
        <InvoiceView
          invoice={selectedInvoice}
          onBack={handleBackFromInvoice}
          autoPrint={autoPrint}
          parties={parties}
        />
      );
    }

    // Normal pages controlled by URL (BrowserRouter)
    return (
      <Routes>
        <Route path="/" element={<Dashboard invoices={invoices} parties={parties} items={items} expenses={expenses} />} />

        <Route
          path="/quick-sale"
          element={
            <InvoiceCreate
              parties={parties}
              items={items}
              onCancel={() => navigate("/")}
              onSuccess={(invoice, shouldPrint) => {
                refreshData();
                if (shouldPrint) {
                  setSelectedInvoice(invoice);
                  setAutoPrint(true);
                  setCurrentView("VIEW_INVOICE");
                } else {
                  navigate("/");
                }
              }}
              initialType="SALE"
              hideAddItemButton={true}
            />
          }
        />

        <Route path="/parties" element={<Parties parties={parties} onRefresh={refreshData} />} />
        <Route path="/items" element={<Items items={items} onRefresh={refreshData} userRole={user?.role} />} />
        <Route path="/stock" element={<Stock items={items} onRefresh={refreshData} userRole={user?.role} />} />

        {/* Sales */}
        <Route
          path="/sales/invoices"
          element={
            <InvoiceList
              invoices={invoices}
              onView={handleViewInvoice}
              onPrint={handlePrintInvoice}
              onCreate={() => startTransaction("SALE")}
              type="SALE"
            />
          }
        />
        <Route path="/sales/payment-in" element={<PaymentIn parties={parties} onRefresh={refreshData} />} />

        {/* Purchases ✅ ADD */}
        <Route
          path="/purchases/bills"
          element={
            <InvoiceList
              invoices={invoices}
              onView={handleViewInvoice}
              onPrint={handlePrintInvoice}
              onCreate={() => startTransaction("PURCHASE")}
              type="PURCHASE"
            />
          }
        />

        <Route
          path="/purchases/returns"
          element={
            <PurchaseReturn
              invoices={invoices}
              currentUser={user!}
              onCancel={() => changeView("PURCHASE_RETURNS")}
              onSuccess={async (id) => {
                try {
                  const created = await InvoiceService.getById(id);
                  await refreshData();
                  setSelectedInvoice(created);
                  setAutoPrint(false);
                  setCurrentView("VIEW_INVOICE");
                } catch (e) {
                  console.error(e);
                  await refreshData();
                  changeView("PURCHASE_RETURNS");
                }
              }}
            />
          }
        />

        <Route path="/purchases/payment-out" element={<PaymentOut parties={parties} onRefresh={refreshData} />} />

        {/* Expenses */}
        <Route
          path="/expenses"
          element={
            !canManageData ? (
              <div className="p-8 text-center text-red-500">Access Denied</div>
            ) : (
              <Expenses onRefresh={refreshData} />
            )
          }
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            !canManageData ? (
              <div className="p-8 text-center text-red-500">Access Denied</div>
            ) : (
              <Reports invoices={invoices} parties={parties} items={items} />
            )
          }
        />

        <Route
          path="/sale-return"
          element={
            <SaleReturn
              invoices={invoices}
              currentUser={user!}
              onCancel={() => changeView("SALE_RETURN_NEW")}
              onSuccess={async (id) => {
                try {
                  const created = await InvoiceService.getById(id);
                  await refreshData();
                  setSelectedInvoice(created);
                  setAutoPrint(false);
                  setCurrentView("VIEW_INVOICE");
                } catch (e) {
                  console.error(e);
                  await refreshData();
                  changeView("SALE_RETURN_NEW");
                }
              }}
            />
          }
        />

        {/* Users */}
        <Route
          path="/users"
          element={
            user?.role !== "SUPER_ADMIN" ? (
              <div className="p-8 text-center text-red-500">Access Denied</div>
            ) : (
              <UsersPage />
            )
          }
        />
      </Routes>
    );
  };

  if (loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout currentView={getCurrentViewFromPath()} onChangeView={changeView} user={user} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  );
};

export default App;
