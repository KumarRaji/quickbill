import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Menu,
  X,
  LogOut,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Undo2,
  ShoppingCart,
  Wallet,
  BarChart3,
  Boxes,
  UserCircle,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { ViewState, User } from "../types";

interface LayoutProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  currentView,
  onChangeView,
  user,
  onLogout,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const canManageData = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const go = (view: ViewState) => {
    onChangeView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl">
        <button
          type="button"
          onClick={() => go("DASHBOARD")}
          className="p-6 flex items-center space-x-3 border-b border-slate-700 text-left hover:bg-slate-800 transition-colors"
        >
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl">
            Q
          </div>
          <span className="text-xl font-bold tracking-tight">QuickBill</span>
        </button>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => onChangeView("CREATE_TRANSACTION")}
            className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-blue-500/20"
          >
            <PlusCircle size={20} />
            <span className="font-medium">Quick Sale</span>
          </button>

          <NavItem
            active={currentView === "DASHBOARD"}
            onClick={() => onChangeView("DASHBOARD")}
            icon={LayoutDashboard}
            label="Dashboard"
          />

          <div className="pt-4 pb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            General
          </div>

          <NavItem
            active={currentView === "PARTIES"}
            onClick={() => onChangeView("PARTIES")}
            icon={Users}
            label="Customers"
          />
          <NavItem
            active={currentView === "SUPPLIERS"}
            onClick={() => onChangeView("SUPPLIERS")}
            icon={Building2}
            label="Suppliers"
          />
          <NavItem
            active={currentView === "ITEMS"}
            onClick={() => onChangeView("ITEMS")}
            icon={Package}
            label="Items"
          />
          {/* <NavItem
            active={currentView === "STOCK"}
            onClick={() => onChangeView("STOCK")}
            icon={Boxes}
            label="Stock / Inventory"
          /> */}
          <NavItem
            active={currentView === "STOCK_MANAGEMENT"}
            onClick={() => onChangeView("STOCK_MANAGEMENT")}
            icon={Boxes}
            label="Stock"
          />

          {canManageData && (
            <NavItem
              active={currentView === "REPORTS"}
              onClick={() => onChangeView("REPORTS")}
              icon={BarChart3}
              label="Reports"
            />
          )}

          <div className="pt-4 pb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Sales
          </div>

          <NavItem
            active={currentView === "SALES_INVOICES"}
            onClick={() => onChangeView("SALES_INVOICES")}
            icon={FileText}
            label="Sale Invoices"
          />
          <NavItem
            active={currentView === "PAYMENT_IN"}
            onClick={() => onChangeView("PAYMENT_IN")}
            icon={TrendingDown}
            label="Cash Deposit"
          />
          <NavItem
            active={currentView === "SALE_RETURN_NEW"}
            onClick={() => onChangeView("SALE_RETURN_NEW")}
            icon={Undo2}
            label="Sale Return"
          />

          <div className="pt-4 pb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Purchases & Expenses
          </div>

          <NavItem
            active={currentView === "PURCHASE_INVOICES"}
            onClick={() => onChangeView("PURCHASE_INVOICES")}
            icon={ShoppingCart}
            label="Purchase Bills"
          />
          <NavItem
            active={currentView === "PURCHASE_RETURNS"}
            onClick={() => onChangeView("PURCHASE_RETURNS")}
            icon={Undo2}
            label="Purchase Return"
          />
          <NavItem
            active={currentView === "PAYMENT_OUT"}
            onClick={() => onChangeView("PAYMENT_OUT")}
            icon={TrendingUp}
            label="Payment Out"
          />

          {canManageData && (
            <NavItem
              active={currentView === "EXPENSES"}
              onClick={() => onChangeView("EXPENSES")}
              icon={Wallet}
              label="Expenses"
            />
          )}

          {isSuperAdmin && (
            <>
              <div className="pt-4 pb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Administration
              </div>
              <NavItem
                active={currentView === "USERS"}
                onClick={() => onChangeView("USERS")}
                icon={ShieldCheck}
                label="Manage Users"
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="bg-slate-700 p-2 rounded-full">
              <UserCircle size={20} className="text-slate-300" />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">
                {user.name}
              </div>
              <div className="text-xs text-slate-400 capitalize">
                {user.role.toLowerCase().replace("_", " ")}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center space-x-3 text-slate-400 hover:text-white px-4 py-2 w-full transition-colors rounded-lg hover:bg-slate-800"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full w-full relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 z-20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
              Q
            </div>
            <span className="font-bold text-slate-800">QuickBill</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-600"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 w-full h-[calc(100vh-4rem)] bg-slate-900 text-white z-30 p-4 md:hidden overflow-y-auto">
            <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-slate-700 p-2 rounded-full">
                  <UserCircle size={20} className="text-slate-300" />
                </div>
                <div>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-slate-400">
                    {user.role.replace("_", " ")}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-white"
              >
                <LogOut size={18} />
              </button>
            </div>

            <button
              onClick={() => go("CREATE_TRANSACTION")}
              className="w-full mb-6 bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2"
            >
              <PlusCircle size={20} />
              <span>Quick Sale</span>
            </button>

            <nav className="space-y-2">
              <NavItem active={currentView === "DASHBOARD"} onClick={() => go("DASHBOARD")} icon={LayoutDashboard} label="Dashboard" />
              <NavItem active={currentView === "PARTIES"} onClick={() => go("PARTIES")} icon={Users} label="Customers" />
              <NavItem active={currentView === "SUPPLIERS"} onClick={() => go("SUPPLIERS")} icon={Building2} label="Suppliers" />
              <NavItem active={currentView === "ITEMS"} onClick={() => go("ITEMS")} icon={Package} label="Items" />
              <NavItem active={currentView === "STOCK"} onClick={() => go("STOCK")} icon={Boxes} label="Stock" />
              {/* <NavItem active={currentView === "STOCK_MANAGEMENT"} onClick={() => go("STOCK_MANAGEMENT")} icon={Package} label="Stock Management" /> */}
              {canManageData && (
                <NavItem active={currentView === "REPORTS"} onClick={() => go("REPORTS")} icon={BarChart3} label="Reports" />
              )}

              <div className="border-t border-slate-800 my-2 pt-2 text-xs text-slate-500 uppercase">
                Sales
              </div>
              <NavItem active={currentView === "SALES_INVOICES"} onClick={() => go("SALES_INVOICES")} icon={FileText} label="Sale Invoices" />
              <NavItem active={currentView === "PAYMENT_IN"} onClick={() => go("PAYMENT_IN")} icon={TrendingDown} label="Payment In" />
              <NavItem active={currentView === "SALE_RETURN_NEW"} onClick={() => go("SALE_RETURN_NEW")} icon={Undo2} label="Sale Return" />

              <div className="border-t border-slate-800 my-2 pt-2 text-xs text-slate-500 uppercase">
                Purchases
              </div>
              <NavItem active={currentView === "PURCHASE_INVOICES"} onClick={() => go("PURCHASE_INVOICES")} icon={ShoppingCart} label="Purchase Bills" />
              <NavItem active={currentView === "PURCHASE_RETURNS"} onClick={() => go("PURCHASE_RETURNS")} icon={Undo2} label="Purchase Return" />
              <NavItem active={currentView === "PAYMENT_OUT"} onClick={() => go("PAYMENT_OUT")} icon={TrendingUp} label="Payment Out" />
              {canManageData && (
                <NavItem active={currentView === "EXPENSES"} onClick={() => go("EXPENSES")} icon={Wallet} label="Expenses" />
              )}

              {isSuperAdmin && (
                <>
                  <div className="border-t border-slate-800 my-2 pt-2 text-xs text-slate-500 uppercase">
                    Admin
                  </div>
                  <NavItem active={currentView === "USERS"} onClick={() => go("USERS")} icon={ShieldCheck} label="Manage Users" />
                </>
              )}
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
};

const NavItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active
        ? "bg-slate-800 text-blue-400 border-l-4 border-blue-400"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

export default Layout;
