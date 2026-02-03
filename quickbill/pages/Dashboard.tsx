import React, { useMemo } from 'react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Invoice, Item, Party, Expense } from '../types';
import { useState } from 'react';
import {
  TrendingUp,
  Users,
  Package,
  CreditCard,
  Calendar as CalendarIcon, // 👈 alias to avoid any Calendar name conflicts
} from 'lucide-react';

const getRemainingDue = (invoice: Invoice) => {
  const amountPaid = Number(invoice.amountPaid) || 0;
  const baseDue = invoice.amountDue ?? invoice.totalAmount - amountPaid;
  return Math.max(0, baseDue);
};

const getDueStatus = (invoice: Invoice) => {
  const remaining = getRemainingDue(invoice);
  const amountPaid = Number(invoice.amountPaid) || 0;

  if (remaining <= 0) return 'PAID';
  if (amountPaid > 0) return 'PARTIAL';
  return 'PENDING';
};

interface DashboardProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  expenses: Expense[];
}

// ✅ Helper to safely show party name or "Unknown"
const getPartyName = (name?: string | null) =>
  name && name.trim().length > 0 ? name : 'Unknown';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  subText?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subText }) => (
  <div className="bg-white p-3 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1 truncate">{title}</p>
      <h3 className="text-lg sm:text-2xl font-bold text-slate-800 break-words">{value}</h3>
      {subText && <p className="text-xs text-slate-400 mt-1 sm:mt-2 hidden sm:block">{subText}</p>}
    </div>
    <div className={`p-2 sm:p-3 rounded-lg ${color} flex-shrink-0`}>
      <Icon size={20} className="sm:w-6 sm:h-6 text-white" />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ invoices, parties, items, expenses }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'year'>('today');

  // 🔹 Current date & time in AM/PM
  const formattedDateTime = new Date().toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: true,
  });

  // Filter data based on selected time period
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return invoices.filter(inv => {
      const invDate = new Date(inv.date);
      if (timeFilter === 'today') return invDate >= today;
      if (timeFilter === 'week') return invDate >= weekStart;
      if (timeFilter === 'month') return invDate >= monthStart;
      if (timeFilter === 'year') return invDate >= yearStart;
      return true;
    });
  }, [invoices, timeFilter]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return expenses.filter(exp => {
      const expDate = new Date(exp.date);
      if (timeFilter === 'today') return expDate >= today;
      if (timeFilter === 'week') return expDate >= weekStart;
      if (timeFilter === 'month') return expDate >= monthStart;
      if (timeFilter === 'year') return expDate >= yearStart;
      return true;
    });
  }, [expenses, timeFilter]);

  const stats = useMemo(() => {
    // Use all invoices instead of filtered ones to debug
    const allInvoices = invoices;
    
    // Calculate Net Sales (Sales - Returns) with rounding
    const salesAmount = Math.round(allInvoices
      .filter(inv => inv.type === 'SALE')
      .reduce((sum, inv) => sum + inv.totalAmount, 0));
    
    const returnsAmount = Math.round(Math.abs(allInvoices
      .filter(inv => inv.type === 'RETURN')
      .reduce((sum, inv) => sum + inv.totalAmount, 0)));
    
    const totalSales = salesAmount - returnsAmount;

    // Calculate Net Purchases (Purchases - Purchase Returns)
    const purchasesAmount = allInvoices
      .filter(inv => inv.type === 'PURCHASE')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const purchaseReturnsAmount = allInvoices
      .filter(inv => inv.type === 'PURCHASE_RETURN')
      .reduce((sum, inv) => sum + Math.abs(inv.totalAmount), 0);
    
    const totalPurchases = purchasesAmount - purchaseReturnsAmount;

    // Calculate Total Expenses - use all expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Count only Sales invoices for "Invoices Created" metric
    const totalInvoices = filteredInvoices.filter((i) => i.type === 'SALE').length;
    const totalParties = parties.length;
    const lowStockItems = items.filter((i) => i.stock < 10).length;

    return { totalSales, totalPurchases, totalExpenses, totalInvoices, totalParties, lowStockItems };
  }, [invoices, parties, items, expenses, filteredInvoices]);

  const lowStockItemsList = useMemo(() => 
    items.filter((i) => i.stock < 10).sort((a, b) => a.stock - b.stock),
    [items]
  );

  const paginatedLowStock = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return lowStockItemsList.slice(start, start + itemsPerPage);
  }, [lowStockItemsList, currentPage]);

  const totalPages = Math.ceil(lowStockItemsList.length / itemsPerPage);

  const chartData = useMemo(() => {
    const salesByDate: Record<string, number> = {};

    filteredInvoices.forEach((inv) => {
      if (inv.type !== 'SALE' && inv.type !== 'RETURN') return;

      const date = new Date(inv.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const currentAmount = salesByDate[date] || 0;
      if (inv.type === 'SALE') {
        salesByDate[date] = currentAmount + inv.totalAmount;
      } else {
        salesByDate[date] = currentAmount - inv.totalAmount;
      }
    });

    // Fallback dummy data if no sales
    if (Object.keys(salesByDate).length === 0) {
      return [
        { name: 'Mon', sales: 4000 },
        { name: 'Tue', sales: 3000 },
        { name: 'Wed', sales: 2000 },
        { name: 'Thu', sales: 2780 },
        { name: 'Fri', sales: 1890 },
        { name: 'Sat', sales: 2390 },
        { name: 'Sun', sales: 3490 },
      ];
    }

    return Object.entries(salesByDate)
      .map(([name, sales]) => ({ name, sales }))
      .slice(-7);
  }, [filteredInvoices]);

  const saleDueInvoices = useMemo(() => {
    return invoices
      .filter((inv) => inv.type === 'SALE')
      .map((inv) => {
        const remainingDue = getRemainingDue(inv);
        const dueStatus = inv.dueStatus ?? getDueStatus(inv);
        return { ...inv, remainingDue, dueStatus };
      })
      .filter((inv) => inv.dueStatus === 'PENDING' || inv.dueStatus === 'PARTIAL')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices]);

  const purchaseDueInvoices = useMemo(() => {
    return invoices
      .filter((inv) => inv.type === 'PURCHASE')
      .map((inv) => {
        const remainingDue = getRemainingDue(inv);
        const dueStatus = inv.dueStatus ?? getDueStatus(inv);
        return { ...inv, remainingDue, dueStatus };
      })
      .filter((inv) => inv.dueStatus === 'PENDING' || inv.dueStatus === 'PARTIAL')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header with Title and Date/Time */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard Overview</h1>
          <div className="text-xs sm:text-sm text-slate-500">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <CalendarIcon size={16} className="inline-block align-middle" />
              {formattedDateTime}
            </span>
          </div>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex justify-start sm:justify-end overflow-x-auto">
          <div className="flex space-x-1 bg-white p-1 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm w-fit">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${timeFilter === 'today' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${timeFilter === 'week' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${timeFilter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Month
            </button>
            <button
              onClick={() => setTimeFilter('year')}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${timeFilter === 'year' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Year
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="Net Sales"
          value={`₹${stats.totalSales}`}
          icon={TrendingUp}
          color="bg-green-500"
          subText="Sales - Returns"
        />
        <StatCard
          title="Net Purchases"
          value={`₹${stats.totalPurchases.toLocaleString()}`}
          icon={Package}
          color="bg-purple-500"
          subText="Purchases - Returns"
        />
        <StatCard
          title="Total Expenses"
          value={`₹${stats.totalExpenses.toLocaleString()}`}
          icon={CreditCard}
          color="bg-red-500"
          subText="All expenses"
        />
        <StatCard
          title="Total Customers"
          value={stats.totalParties}
          icon={Users}
          color="bg-blue-500"
          subText="Active customers"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockItems}
          icon={Package}
          color="bg-orange-500"
          subText="Items below 10 units"
        />
        </div>

        {/* Charts + Recent transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Net Sales Trend */}
          <div className="bg-white p-3 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">
            Net Sales Trend ({timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)})
          </h3>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white p-3 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">
            Recent Transactions ({timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)})
          </h3>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-3">Party</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Amount</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center">Type</th>
                  </tr>
                </thead>
              <tbody>
                {filteredInvoices.slice(0, 5).map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-slate-800">
                      {getPartyName(inv.partyName)}
                    </td>
                    <td
                      className={`px-3 sm:px-4 py-2 sm:py-3 text-right font-medium ${
                        inv.type.includes('RETURN')
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {inv.type.includes('RETURN') ? '-' : ''}₹
                      {inv.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          inv.type === 'SALE'
                            ? 'bg-green-100 text-green-700'
                            : inv.type === 'RETURN'
                            ? 'bg-red-100 text-red-700'
                            : inv.type === 'PURCHASE'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.type.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 sm:px-4 py-8 text-center text-slate-400"
                    >
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-2">
              {filteredInvoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="border border-slate-300 rounded-lg p-2 bg-slate-50 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-xs truncate">{getPartyName(inv.partyName)}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                        inv.type === 'SALE'
                          ? 'bg-green-100 text-green-700'
                          : inv.type === 'RETURN'
                          ? 'bg-red-100 text-red-700'
                          : inv.type === 'PURCHASE'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {inv.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className={`text-xs font-medium ${
                    inv.type.includes('RETURN')
                      ? 'text-red-600'
                      : 'text-slate-800'
                  }`}>
                    {inv.type.includes('RETURN') ? '-' : ''}₹{inv.totalAmount.toLocaleString()}
                  </div>
                </div>
              ))}
              {filteredInvoices.length === 0 && (
                <div className="text-center py-4 text-slate-400 text-xs">No transactions yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Sale Payment Due */}
        <div className="bg-white p-3 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">Sale Payment Due</h3>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Date</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Invoice</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Customer</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Amount</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-center">Due Status</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Remaining Due</th>
                </tr>
              </thead>
              <tbody>
                {saleDueInvoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                      {new Date(inv.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-slate-800">{inv.invoiceNumber}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">{getPartyName(inv.partyName)}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-medium text-slate-800">₹{inv.totalAmount.toLocaleString()}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          inv.dueStatus === 'PENDING'
                            ? 'bg-red-100 text-red-700'
                            : inv.dueStatus === 'PARTIAL'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {inv.dueStatus}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-slate-800">₹{inv.remainingDue.toLocaleString()}</td>
                  </tr>
                ))}
                {saleDueInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-4 py-8 text-center text-slate-400">
                      All sale invoices are fully paid
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-2">
            {saleDueInvoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="border border-slate-300 rounded-lg p-2 bg-slate-50 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-xs truncate">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-600 truncate">{getPartyName(inv.partyName)}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                      inv.dueStatus === 'PENDING'
                        ? 'bg-red-100 text-red-700'
                        : inv.dueStatus === 'PARTIAL'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {inv.dueStatus}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-800">₹{inv.remainingDue.toLocaleString()} due</div>
                <div className="text-[11px] text-slate-500">{new Date(inv.date).toLocaleDateString('en-IN')}</div>
              </div>
            ))}
            {saleDueInvoices.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-xs">All sale invoices are fully paid</div>
            )}
          </div>
        </div>

        {/* Purchase Paymet Due */}
        <div className="bg-white p-3 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">Purchase Paymet Due</h3>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Date</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Invoice</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Supplier</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Amount</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-center">Due Status</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Remaining Due</th>
                </tr>
              </thead>
              <tbody>
                {purchaseDueInvoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">
                      {new Date(inv.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-slate-800">{inv.invoiceNumber}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-700">{getPartyName(inv.partyName)}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-medium text-slate-800">₹{inv.totalAmount.toLocaleString()}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          inv.dueStatus === 'PENDING'
                            ? 'bg-red-100 text-red-700'
                            : inv.dueStatus === 'PARTIAL'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {inv.dueStatus}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-slate-800">₹{inv.remainingDue.toLocaleString()}</td>
                  </tr>
                ))}
                {purchaseDueInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 sm:px-4 py-8 text-center text-slate-400">
                      All purchase bills are fully paid
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-2">
            {purchaseDueInvoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="border border-slate-300 rounded-lg p-2 bg-slate-50 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-xs truncate">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-600 truncate">{getPartyName(inv.partyName)}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                      inv.dueStatus === 'PENDING'
                        ? 'bg-red-100 text-red-700'
                        : inv.dueStatus === 'PARTIAL'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {inv.dueStatus}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-800">₹{inv.remainingDue.toLocaleString()} due</div>
                <div className="text-[11px] text-slate-500">{new Date(inv.date).toLocaleDateString('en-IN')}</div>
              </div>
            ))}
            {purchaseDueInvoices.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-xs">All purchase bills are fully paid</div>
            )}
          </div>
        </div>

        {/* Low Stock Items Table */}
        <div className="bg-white p-3 sm:p-6 rounded-lg sm:rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-4 sm:mb-6">Low Stock Items (Below 10 Units)</h3>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Item Name</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Stock</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Unit</th>
                </tr>
              </thead>
            <tbody>
              {paginatedLowStock.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                    <span className={`font-semibold ${
                      item.stock === 0 ? 'text-red-600' : 
                      item.stock < 5 ? 'text-orange-600' : 'text-yellow-600'
                    }`}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-600">{item.unit}</td>
                </tr>
              ))}
              {lowStockItemsList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 sm:px-4 py-8 text-center text-slate-400">
                    No low stock items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-2">
            {paginatedLowStock.map((item) => (
              <div key={item.id} className="border border-slate-300 rounded-lg p-2 bg-slate-50">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-medium text-slate-800 text-xs flex-1 min-w-0 truncate">{item.name}</div>
                  <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${
                    item.stock === 0 ? 'text-red-600' : 
                    item.stock < 5 ? 'text-orange-600' : 'text-yellow-600'
                  }`}>
                    Stock: {item.stock}
                  </span>
                </div>
                <div className="text-xs text-slate-600">{item.unit}</div>
              </div>
            ))}
            {lowStockItemsList.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-xs">No low stock items</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-3 sm:gap-0">
              <p className="text-xs sm:text-sm text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, lowStockItemsList.length)} of {lowStockItemsList.length} items
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 rounded-md border border-slate-300 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm text-slate-700 flex-1 sm:flex-initial text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 rounded-md border border-slate-300 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

  );
};

export default Dashboard;
