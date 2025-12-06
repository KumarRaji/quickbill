
import React, { useState, useMemo } from 'react';
import { Party, Item, Invoice } from '../types';
import { BarChart3, Package, Users, TrendingUp, TrendingDown } from 'lucide-react';

interface ReportsProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
}

type ReportTab = 'STOCK' | 'SALES' | 'PARTIES';

const Reports: React.FC<ReportsProps> = ({ invoices, parties, items }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('STOCK');

  // --- Calculations ---

  const stockSummary = useMemo(() => {
    const totalStockValue = items.reduce((sum, item) => sum + (item.stock * item.purchasePrice), 0);
    const lowStockCount = items.filter(i => i.stock < 10).length;
    return { totalStockValue, lowStockCount, items };
  }, [items]);

  const salesSummary = useMemo(() => {
    // Filter for both SALES and SALE RETURNS
    const relevantInvoices = invoices.filter(i => i.type === 'SALE' || i.type === 'RETURN');
    
    // Calculate Net Sales (Sales - Returns)
    const totalSales = relevantInvoices.reduce((sum, i) => {
      return i.type === 'SALE' ? sum + i.totalAmount : sum - i.totalAmount;
    }, 0);

    // Calculate Net Tax (Tax Collected - Tax Returned)
    const totalTax = relevantInvoices.reduce((sum, i) => {
      return i.type === 'SALE' ? sum + i.totalTax : sum - i.totalTax;
    }, 0);

    return { totalSales, totalTax, invoices: relevantInvoices };
  }, [invoices]);

  const partySummary = useMemo(() => {
    const receivables = parties.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
    const payables = parties.reduce((sum, p) => sum + (p.balance < 0 ? Math.abs(p.balance) : 0), 0);
    return { receivables, payables, parties };
  }, [parties]);


  // --- Sub-components for Tabs ---

  const StockReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Total Stock Value</div>
           <div className="text-2xl font-bold text-slate-800">₹{stockSummary.totalStockValue.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Total Items</div>
           <div className="text-2xl font-bold text-slate-800">{items.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Low Stock Items</div>
           <div className="text-2xl font-bold text-orange-600">{stockSummary.lowStockCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-700 bg-slate-50">
          Item Wise Stock Detail
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-3">Item Name</th>
              <th className="px-6 py-3 text-right">Purchase Price</th>
              <th className="px-6 py-3 text-right">Sale Price</th>
              <th className="px-6 py-3 text-center">Current Stock</th>
              <th className="px-6 py-3 text-right">Stock Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stockSummary.items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-800">{item.name}</div>
                  {item.code && <div className="text-xs text-slate-400">{item.code}</div>}
                </td>
                <td className="px-6 py-4 text-right text-slate-600">₹{item.purchasePrice}</td>
                <td className="px-6 py-4 text-right text-slate-600">₹{item.sellingPrice}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    item.stock < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {item.stock} {item.unit}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-800">
                  ₹{(item.stock * item.purchasePrice).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const SalesReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Net Revenue (Sales - Returns)</div>
           <div className="text-2xl font-bold text-green-600">₹{salesSummary.totalSales.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Net Tax Collected</div>
           <div className="text-2xl font-bold text-slate-800">₹{salesSummary.totalTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-700 bg-slate-50">
          Transaction History (Sales & Returns)
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Invoice / Ref</th>
              <th className="px-6 py-3">Party Name</th>
              <th className="px-6 py-3 text-right">Tax</th>
              <th className="px-6 py-3 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {salesSummary.invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${inv.type === 'RETURN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {inv.type === 'RETURN' ? 'CREDIT NOTE' : 'INVOICE'}
                    </span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-800">
                    {inv.invoiceNumber}
                    {inv.originalRefNumber && <div className="text-xs text-slate-400">Ref: {inv.originalRefNumber}</div>}
                </td>
                <td className="px-6 py-4 text-slate-600">{inv.partyName}</td>
                <td className="px-6 py-4 text-right text-slate-600">
                    {inv.type === 'RETURN' ? '-' : ''}₹{inv.totalTax.toFixed(2)}
                </td>
                <td className={`px-6 py-4 text-right font-bold ${inv.type === 'RETURN' ? 'text-red-600' : 'text-green-600'}`}>
                   {inv.type === 'RETURN' ? '-' : ''}₹{inv.totalAmount.toLocaleString()}
                </td>
              </tr>
            ))}
            {salesSummary.invoices.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No sales records found</td>
                </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );

  const PartyReport = () => (
     <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Total Receivable (You will get)</div>
           <div className="text-2xl font-bold text-green-600">₹{partySummary.receivables.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-sm text-slate-500 mb-1">Total Payable (You will pay)</div>
           <div className="text-2xl font-bold text-red-600">₹{partySummary.payables.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-700 bg-slate-50">
          Party Statement / Balances
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-3">Party Name</th>
              <th className="px-6 py-3">Phone</th>
              <th className="px-6 py-3 text-right">Balance</th>
              <th className="px-6 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {partySummary.parties.map(party => (
              <tr key={party.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{party.name}</td>
                <td className="px-6 py-4 text-slate-600">{party.phone}</td>
                <td className={`px-6 py-4 text-right font-bold ${party.balance > 0 ? 'text-green-600' : party.balance < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  ₹{Math.abs(party.balance).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-center">
                    {party.balance > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Receivable</span>}
                    {party.balance < 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Payable</span>}
                    {party.balance === 0 && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">Settled</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Business Reports</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm mb-6 w-fit">
        <button
            onClick={() => setActiveTab('STOCK')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'STOCK' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
            <Package size={18} />
            <span>Stock Summary</span>
        </button>
        <button
            onClick={() => setActiveTab('SALES')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'SALES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
            <TrendingUp size={18} />
            <span>Sales Report</span>
        </button>
        <button
            onClick={() => setActiveTab('PARTIES')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'PARTIES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
            <Users size={18} />
            <span>Party Statement</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'STOCK' && <StockReport />}
        {activeTab === 'SALES' && <SalesReport />}
        {activeTab === 'PARTIES' && <PartyReport />}
      </div>
    </div>
  );
};

export default Reports;
