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
  Line
} from 'recharts';
import { Invoice, Item, Party, Expense } from '../types';
import { TrendingUp, Users, Package, CreditCard } from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  expenses: Expense[];
}

// ✅ Helper to safely show party name or "Unknown"
const getPartyName = (name?: string | null) =>
  name && name.trim().length > 0 ? name : 'Unknown';

const Dashboard: React.FC<DashboardProps> = ({ invoices, parties, items, expenses }) => {
  
  const stats = useMemo(() => {
    // Calculate Net Sales (Sales - Returns)
    const totalSales = invoices.reduce((sum, inv) => {
      if (inv.type === 'SALE') return sum + inv.totalAmount;
      if (inv.type === 'RETURN') return sum - inv.totalAmount;
      return sum;
    }, 0);

    // Calculate Total Expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Count only Sales invoices for "Invoices Created" metric
    const totalInvoices = invoices.filter(i => i.type === 'SALE').length;
    const totalParties = parties.length;
    const lowStockItems = items.filter(i => i.stock < 10).length;

    return { totalSales, totalExpenses, totalInvoices, totalParties, lowStockItems };
  }, [invoices, parties, items, expenses]);

  const chartData = useMemo(() => {
    const salesByDate: Record<string, number> = {};
    
    invoices.forEach(inv => {
      if (inv.type !== 'SALE' && inv.type !== 'RETURN') return;

      const date = new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const currentAmount = salesByDate[date] || 0;
      if (inv.type === 'SALE') {
        salesByDate[date] = currentAmount + inv.totalAmount;
      } else {
        salesByDate[date] = currentAmount - inv.totalAmount;
      }
    });
    
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

    return Object.entries(salesByDate).map(([name, sales]) => ({ name, sales })).slice(-7);
  }, [invoices]);

  const StatCard = ({ title, value, icon: Icon, color, subText }: any) => (
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
        <div className="text-sm text-slate-500">Last updated: Just now</div>
      </div>

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
          title="Total Parties" 
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Net Sales Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

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
                {invoices.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {getPartyName(inv.partyName)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      inv.type.includes('RETURN') ? 'text-red-600' : 'text-slate-800'
                    }`}>
                      {inv.type.includes('RETURN') ? '-' : ''}₹{inv.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        inv.type === 'SALE' ? 'bg-green-100 text-green-700' : 
                        inv.type === 'RETURN' ? 'bg-red-100 text-red-700' : 
                        inv.type === 'PURCHASE' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.type.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">No transactions yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
