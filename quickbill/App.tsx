import React, { useEffect, useState } from "react";
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
import PurchaseReturn from "./pages/PurchaseReturn";
import PurchaseBills from "./pages/PurchaseBills";

// ✅ Your new separate create page
import PurchaseInvoiceCreate from "./pages/PurchaseInvoiceCreate";

import { Party, Item, Invoice, ViewState, TransactionType, User, Expense } from "./types";
import { PartyService, ItemService, InvoiceService, AuthService, ExpenseService } from "./services/api";

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // special mode only (optional)
  const [currentView, setCurrentView] = useState<ViewState>("DASHBOARD");
  const [creationType, setCreationType] = useState<TransactionType>("SALE");

  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

  // ✅ remember where user came from (sales list or purchase list)
  const [lastListPath, setLastListPath] = useState<string>("/sales/invoices");

  // ===================== AUTH =====================
  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) setUser(currentUser);
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

  // 🔹 Load data based on route
  useEffect(() => {
    if (!user) return;

    const loadForRoute = async () => {
      try {
        const path = location.pathname;

        if (path === "/" || path === "/reports") {
          await refreshData();
        } else if (path === "/quick-sale") {
          const [p, i] = await Promise.all([PartyService.getAll(), ItemService.getAll()]);
          setParties(p);
          setItems(i);
        } else if (path.startsWith("/sale-return")) {
          const [inv, i] = await Promise.all([InvoiceService.getAll(), ItemService.getAll()]);
          setInvoices(inv);
          setItems(i);
        } else if (path.startsWith("/purchases/returns")) {
          const inv = await InvoiceService.getAll();
          setInvoices(inv);
        } else if (path.startsWith("/parties")) {
          const p = await PartyService.getAll();
          setParties(p);
        } else if (path.startsWith("/items") || path.startsWith("/stock")) {
          const i = await ItemService.getAll();
          setItems(i);
        } else if (path.startsWith("/sales") || path.startsWith("/purchases")) {
          const [inv, p] = await Promise.all([InvoiceService.getAll(), PartyService.getAll()]);
          setInvoices(inv);
          setParties(p);
        } else if (path.startsWith("/expenses")) {
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
  const canManageData = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const changeView = (view: ViewState) => {
    // Role Protection
    if ((view === "REPORTS" || view === "EXPENSES") && user?.role === "STAFF") {
      alert("Access Denied: Admins only");
      return;
    }
    if (view === "USERS" && user?.role !== "SUPER_ADMIN") {
      alert("Access Denied: Super Admin only");
      return;
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

    // special screens no route
    if (view !== "CREATE_TRANSACTION" && view !== "VIEW_INVOICE") {
      navigate(routes[view] || "/");
    }
  };

  const startTransaction = (type: TransactionType) => {
    setCreationType(type);
    setCurrentView("CREATE_TRANSACTION");
  };

  const handleCreateInvoiceSuccess = (newInvoice: Invoice, shouldPrint: boolean = false) => {
    refreshData();
    // ✅ Set lastListPath based on invoice type
    if (newInvoice.type === "PURCHASE" || newInvoice.type === "PURCHASE_RETURN") {
      setLastListPath("/purchases/bills");
    } else {
      setLastListPath("/sales/invoices");
    }
    setSelectedInvoice(newInvoice);
    setAutoPrint(shouldPrint);
    setCurrentView("VIEW_INVOICE");
  };

  const handleViewInvoice = (invoice: Invoice) => {
    // ✅ save where user came from
    if (location.pathname.startsWith("/purchases")) setLastListPath("/purchases/bills");
    else setLastListPath("/sales/invoices");

    setSelectedInvoice(invoice);
    setAutoPrint(false);
    setCurrentView("VIEW_INVOICE");
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    if (location.pathname.startsWith("/purchases")) setLastListPath("/purchases/bills");
    else setLastListPath("/sales/invoices");

    setSelectedInvoice(invoice);
    setAutoPrint(true);
    setCurrentView("VIEW_INVOICE");
  };

  const handleBackFromInvoice = () => {
    // ✅ go back based on invoice type
    const invoiceType = selectedInvoice?.type;
    setSelectedInvoice(null);
    setAutoPrint(false);
    
    if (invoiceType === "PURCHASE" || invoiceType === "PURCHASE_RETURN") {
      navigate("/purchases/bills");
      setCurrentView("PURCHASE_INVOICES");
    } else {
      navigate("/sales/invoices");
      setCurrentView("SALES_INVOICES");
    }
  };

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

    if (currentView === "CREATE_TRANSACTION" || currentView === "VIEW_INVOICE") return currentView;
    return pathMap[location.pathname] || "DASHBOARD";
  };

  // ===================== RENDER =====================
  const renderContent = () => {
    // Special screens: create/view without changing route
    if (currentView === "CREATE_TRANSACTION") {
      return (
        <InvoiceCreate
          parties={parties}
          items={items}
          onCancel={() => {
            if (creationType === "RETURN") {
              setCurrentView("SALE_RETURN_NEW");
              navigate("/sale-return");
            } else if (creationType === "PURCHASE") {
              setCurrentView("PURCHASE_INVOICES");
              navigate("/purchases/bills");
            } else if (creationType === "PURCHASE_RETURN") {
              setCurrentView("PURCHASE_RETURNS");
              navigate("/purchases/returns");
            } else {
              setCurrentView("SALES_INVOICES");
              navigate("/sales/invoices");
            }
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

    // Normal Routes
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
                  setLastListPath("/sales/invoices");
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

        {/* Purchases */}
        <Route
          path="/purchases/bills"
          element={
            <PurchaseBills
              // ✅ go to separate purchase create page
              onCreateNew={() => {
                setLastListPath("/purchases/bills");
                navigate("/purchases/create");
              }}
              onViewInvoice={handleViewInvoice}
            />
          }
        />

        {/* ✅ Separate Purchase Create Route */}
        <Route
          path="/purchases/create"
          element={
            <PurchaseInvoiceCreate
              parties={parties}
              items={items}
              onCancel={() => navigate("/purchases/bills")}
              onSuccess={(invoice, shouldPrint) => {
                refreshData();
                if (shouldPrint) {
                  setLastListPath("/purchases/bills");
                  setSelectedInvoice(invoice);
                  setAutoPrint(true);
                  setCurrentView("VIEW_INVOICE");
                } else {
                  navigate("/purchases/bills");
                }
              }}
            />
          }
        />

        <Route
          path="/purchases/returns"
          element={
            <PurchaseReturn
              invoices={invoices}
              currentUser={user!}
              // ✅ cancel should go to list page (not same view)
              onCancel={() => navigate("/purchases/bills")}
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
                  navigate("/purchases/returns");
                }
              }}
            />
          }
        />

        <Route path="/purchases/payment-out" element={<PaymentOut parties={parties} onRefresh={refreshData} />} />

        {/* Sale Return */}
        <Route
          path="/sale-return"
          element={
            <SaleReturn
              invoices={invoices}
              currentUser={user!}
              // ✅ cancel should go back to sales invoices
              onCancel={() => navigate("/sales/invoices")}
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
                  navigate("/sale-return");
                }
              }}
            />
          }
        />

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
    return <div className="flex h-screen items-center justify-center bg-slate-100">Loading...</div>;
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
