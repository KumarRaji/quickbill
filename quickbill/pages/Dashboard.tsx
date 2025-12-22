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
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {subText && <p className="text-xs text-slate-400 mt-2">{subText}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ invoices, parties, items, expenses }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [timeFilter, setTimeFilter] = useState<'today' | 'month' | 'year'>('today');

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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return invoices.filter(inv => {
      const invDate = new Date(inv.date);
      if (timeFilter === 'today') return invDate >= today;
      if (timeFilter === 'month') return invDate >= monthStart;
      if (timeFilter === 'year') return invDate >= yearStart;
      return true;
    });
  }, [invoices, timeFilter]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return expenses.filter(exp => {
      const expDate = new Date(exp.date);
      if (timeFilter === 'today') return expDate >= today;
      if (timeFilter === 'month') return expDate >= monthStart;
      if (timeFilter === 'year') return expDate >= yearStart;
      return true;
    });
  }, [expenses, timeFilter]);

  const stats = useMemo(() => {
    // Calculate Net Sales (Sales - Returns)
    const totalSales = filteredInvoices.reduce((sum, inv) => {
      if (inv.type === 'SALE') return sum + inv.totalAmount;
      if (inv.type === 'RETURN') return sum - inv.totalAmount;
      return sum;
    }, 0);

    // Calculate Total Expenses
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Count only Sales invoices for "Invoices Created" metric
    const totalInvoices = filteredInvoices.filter((i) => i.type === 'SALE').length;
    const totalParties = parties.length;
    const lowStockItems = items.filter((i) => i.stock < 10).length;

    return { totalSales, totalExpenses, totalInvoices, totalParties, lowStockItems };
  }, [filteredInvoices, parties, items, filteredExpenses]);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with date/time */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
        <div className="text-sm text-slate-500">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <CalendarIcon size={16} className="inline-block align-middle" />
            {formattedDateTime}
          </span>
        </div>
      </div>

      {/* Time Filter Tabs */}
      <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
        <button
          onClick={() => setTimeFilter('today')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${timeFilter === 'today' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Today
        </button>
        <button
          onClick={() => setTimeFilter('month')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${timeFilter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          This Month
        </button>
        <button
          onClick={() => setTimeFilter('year')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${timeFilter === 'year' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          This Year
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Net Sales"
          value={`₹${stats.totalSales.toLocaleString()}`}
          icon={TrendingUp}
          color="bg-green-500"
          subText="Sales - Returns"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Sales Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Net Sales Trend</h3>
          <div className="h-64">
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.slice(0, 5).map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {getPartyName(inv.partyName)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        inv.type.includes('RETURN')
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {inv.type.includes('RETURN') ? '-' : ''}₹
                      {inv.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
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
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Low Stock Items Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Low Stock Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Unit</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLowStock.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${
                      item.stock === 0 ? 'text-red-600' : 
                      item.stock < 5 ? 'text-orange-600' : 'text-yellow-600'
                    }`}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                </tr>
              ))}
              {lowStockItemsList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    No low stock items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, lowStockItemsList.length)} of {lowStockItemsList.length} items
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
                )}
          
          </div>
        </div>
   
  );
};

export default Dashboard;
