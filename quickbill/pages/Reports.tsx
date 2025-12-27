import React, { useMemo, useState } from 'react';
import { Party, Item, Invoice } from '../types';
import { Package, Users, TrendingUp, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { StockItem } from '../services/api';

interface ReportsProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  stock: StockItem[];
}

type ReportTab = 'STOCK' | 'ITEMS' | 'SALES' | 'SALE_RETURNS' | 'PURCHASES' | 'PURCHASE_RETURNS' | 'PARTIES';

type PagerProps = {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  pageCount: number;
  totalCount: number;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
};

const PaginationBar: React.FC<PagerProps> = ({
  currentPage,
  totalPages,
  startIndex,
  pageCount,
  totalCount,
  label,
  onPrevious,
  onNext,
}) => {
  if (totalCount <= 0) return null;

  return (
    <div className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-xs text-slate-500">
        Showing{' '}
        <span className="font-medium">
          {startIndex + 1}–{Math.min(startIndex + pageCount, totalCount)}
        </span>{' '}
        of <span className="font-medium">{totalCount}</span> {label}
      </p>

      <div className="flex w-full sm:w-auto items-center gap-2 text-sm">
        <button
          onClick={onPrevious}
          disabled={currentPage === 1}
          className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          <span className="hidden sm:inline">Prev</span>
          <span className="sm:hidden">Prev</span>
        </button>

        <span className="px-2 sm:px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
          {currentPage}
        </span>

        <button
          onClick={onNext}
          disabled={currentPage === totalPages}
          className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// Export helpers
const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
  const csv = `${headers}\n${rows}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportToExcel = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join('\t');
  const rows = data.map(row => Object.values(row).join('\t')).join('\n');
  const excel = `${headers}\n${rows}`;
  const blob = new Blob([excel], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

const printTable = (title: string, tableHTML: string) => {
  const printWindow = window.open('', '', 'width=800,height=600');
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f8f9fa; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${tableHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

const Reports: React.FC<ReportsProps> = ({ invoices, parties, items, stock }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('STOCK');

  // -----------------------
  // Pagination States
  // -----------------------

  // STOCK pagination + page size select ✅
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);

  // ITEMS pagination + page size select ✅
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(10);

  // SALES pagination + page size select ✅
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);

  // PARTIES pagination + page size select ✅
  const [partyPage, setPartyPage] = useState(1);
  const [partyPageSize, setPartyPageSize] = useState(10);

  // SALE RETURNS pagination + page size select ✅
  const [returnPage, setReturnPage] = useState(1);
  const [returnPageSize, setReturnPageSize] = useState(10);

  // PURCHASES pagination + page size select ✅
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePageSize, setPurchasePageSize] = useState(10);

  // PURCHASE RETURNS pagination + page size select ✅
  const [purchaseReturnPage, setPurchaseReturnPage] = useState(1);
  const [purchaseReturnPageSize, setPurchaseReturnPageSize] = useState(10);


  // -----------------------
  // Calculations
  // -----------------------

  const stockSummary = useMemo(() => {
    const combinedStock = [
      ...stock.filter(s => s.supplier_id).map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        barcode: s.barcode,
        supplier_name: s.supplier_name,
        purchase_price: s.purchase_price,
        mrp: s.mrp,
        quantity: s.quantity,
        unit: s.unit
      })),
      ...items.filter(i => i.stock > 0 && i.supplierId).map(i => ({
        id: i.id,
        name: i.name,
        code: i.code,
        barcode: i.barcode,
        supplier_name: 'Moved to Items',
        purchase_price: i.purchasePrice,
        mrp: i.mrp,
        quantity: i.stock,
        unit: i.unit
      }))
    ];
    const totalStockValue = combinedStock.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0);
    const lowStockCount = combinedStock.filter((i) => i.quantity <= 5).length;
    return { totalStockValue, lowStockCount, filteredStock: combinedStock };
  }, [stock, items]);

  const salesSummary = useMemo(() => {
    const relevantInvoices = invoices.filter((i) => i.type === 'SALE' || i.type === 'RETURN');

    const totalSales = relevantInvoices.reduce((sum, i) => {
      return i.type === 'SALE' ? sum + i.totalAmount : sum - i.totalAmount;
    }, 0);

    const totalTax = relevantInvoices.reduce((sum, i) => {
      return i.type === 'SALE' ? sum + i.totalTax : sum - i.totalTax;
    }, 0);

    return { totalSales, totalTax, invoices: relevantInvoices };
  }, [invoices]);

  const partySummary = useMemo(() => {
    const receivables = parties.filter(p => p.balance > 0).reduce((sum, p) => sum + Number(p.balance), 0);
    const payables = parties.filter(p => p.balance < 0).reduce((sum, p) => sum + Math.abs(Number(p.balance)), 0);
    return { receivables, payables };
  }, [parties]);

  const returnSummary = useMemo(() => {
    const returnInvoices = invoices.filter((i) => i.type === 'RETURN');
    const totalReturns = returnInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalReturnTax = returnInvoices.reduce((sum, i) => sum + i.totalTax, 0);
    return { totalReturns, totalReturnTax, invoices: returnInvoices };
  }, [invoices]);

  const purchaseSummary = useMemo(() => {
    const purchaseInvoices = invoices.filter((i) => i.type === 'PURCHASE');
    const totalPurchases = purchaseInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPurchaseTax = purchaseInvoices.reduce((sum, i) => sum + i.totalTax, 0);
    return { totalPurchases, totalPurchaseTax, invoices: purchaseInvoices };
  }, [invoices]);

  const purchaseReturnSummary = useMemo(() => {
    const purchaseReturnInvoices = invoices.filter((i) => i.type === 'PURCHASE_RETURN');
    const totalPurchaseReturns = purchaseReturnInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPurchaseReturnTax = purchaseReturnInvoices.reduce((sum, i) => sum + i.totalTax, 0);
    return { totalPurchaseReturns, totalPurchaseReturnTax, invoices: purchaseReturnInvoices };
  }, [invoices]);

  // -----------------------
  // Paginated Data
  // -----------------------

  // STOCK
  const stockList = stockSummary.filteredStock;
  const stockTotalPages = Math.max(1, Math.ceil(stockList.length / stockPageSize));
  const stockCurrentPage = Math.min(stockPage, stockTotalPages);
  const stockStartIndex = (stockCurrentPage - 1) * stockPageSize;
  const paginatedStockItems = stockList.slice(stockStartIndex, stockStartIndex + stockPageSize);

  // ITEMS
  const itemsTotalPages = Math.max(1, Math.ceil(items.length / itemsPageSize));
  const itemsCurrentPage = Math.min(itemsPage, itemsTotalPages);
  const itemsStartIndex = (itemsCurrentPage - 1) * itemsPageSize;
  const paginatedItems = items.slice(itemsStartIndex, itemsStartIndex + itemsPageSize);

  // SALES
  const salesList = salesSummary.invoices;
  const salesTotalPages = Math.max(1, Math.ceil(salesList.length / salesPageSize));
  const salesCurrentPage = Math.min(salesPage, salesTotalPages);
  const salesStartIndex = (salesCurrentPage - 1) * salesPageSize;
  const paginatedSales = salesList.slice(salesStartIndex, salesStartIndex + salesPageSize);

  // PARTIES
  const partyTotalPages = Math.max(1, Math.ceil(parties.length / partyPageSize));
  const partyCurrentPage = Math.min(partyPage, partyTotalPages);
  const partyStartIndex = (partyCurrentPage - 1) * partyPageSize;
  const paginatedParties = parties.slice(partyStartIndex, partyStartIndex + partyPageSize);

  // SALE RETURNS
  const returnList = returnSummary.invoices;
  const returnTotalPages = Math.max(1, Math.ceil(returnList.length / returnPageSize));
  const returnCurrentPage = Math.min(returnPage, returnTotalPages);
  const returnStartIndex = (returnCurrentPage - 1) * returnPageSize;
  const paginatedReturns = returnList.slice(returnStartIndex, returnStartIndex + returnPageSize);

  // PURCHASES
  const purchaseList = purchaseSummary.invoices;
  const purchaseTotalPages = Math.max(1, Math.ceil(purchaseList.length / purchasePageSize));
  const purchaseCurrentPage = Math.min(purchasePage, purchaseTotalPages);
  const purchaseStartIndex = (purchaseCurrentPage - 1) * purchasePageSize;
  const paginatedPurchases = purchaseList.slice(purchaseStartIndex, purchaseStartIndex + purchasePageSize);

  // PURCHASE RETURNS
  const purchaseReturnList = purchaseReturnSummary.invoices;
  const purchaseReturnTotalPages = Math.max(1, Math.ceil(purchaseReturnList.length / purchaseReturnPageSize));
  const purchaseReturnCurrentPage = Math.min(purchaseReturnPage, purchaseReturnTotalPages);
  const purchaseReturnStartIndex = (purchaseReturnCurrentPage - 1) * purchaseReturnPageSize;
  const paginatedPurchaseReturns = purchaseReturnList.slice(purchaseReturnStartIndex, purchaseReturnStartIndex + purchaseReturnPageSize);

  // Reset page when switching tabs (nice UX)
  const changeTab = (tab: ReportTab) => {
    setActiveTab(tab);
    if (tab === 'STOCK') setStockPage(1);
    if (tab === 'ITEMS') setItemsPage(1);
    if (tab === 'SALES') setSalesPage(1);
    if (tab === 'SALE_RETURNS') setReturnPage(1);
    if (tab === 'PURCHASES') setPurchasePage(1);
    if (tab === 'PURCHASE_RETURNS') setPurchaseReturnPage(1);
    if (tab === 'PARTIES') setPartyPage(1);
  };

  // -----------------------
  // Subcomponents
  // -----------------------

  const StockReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Stock Value</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">
            ₹{stockSummary.totalStockValue.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Products</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">{stockList.length}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Low Stock Items</div>
          <div className="text-lg sm:text-2xl font-bold text-orange-600">{stockSummary.lowStockCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Stock Detail</div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(stockList.map(i => ({ Name: i.name, Supplier: i.supplier_name, PurchasePrice: i.purchase_price, MRP: i.mrp, Quantity: i.quantity, Unit: i.unit, StockValue: i.quantity * i.purchase_price })), 'stock-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(stockList.map(i => ({ Name: i.name, Supplier: i.supplier_name, PurchasePrice: i.purchase_price, MRP: i.mrp, Quantity: i.quantity, Unit: i.unit, StockValue: i.quantity * i.purchase_price })), 'stock-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Stock Report', document.querySelector('.stock-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={stockPageSize}
              onChange={(e) => {
                setStockPageSize(Number(e.target.value));
                setStockPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left stock-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Item Name</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Supplier</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Purchase Price</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">MRP</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-center">Quantity</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Stock Value</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedStockItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4">
                    <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                    {item.code && <div className="text-xs text-slate-400">Code: {item.code}</div>}
                    {item.barcode && <div className="text-xs text-slate-400">Barcode: {item.barcode}</div>}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{item.supplier_name || '-'}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">₹{item.purchase_price}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">{item.mrp ? `₹${item.mrp}` : '-'}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${item.quantity <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                    >
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-slate-800 text-sm">
                    ₹{(item.quantity * item.purchase_price).toLocaleString()}
                  </td>
                </tr>
              ))}

              {stockList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No stock found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedStockItems.map((item) => (
            <div key={item.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.code && <span>Code: {item.code}</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">Supplier</span>
                  <div className="font-medium text-slate-900">{item.supplier_name || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Purchase Price</span>
                  <div className="font-medium text-slate-900">₹{item.purchase_price}</div>
                </div>
                <div>
                  <span className="text-slate-500">MRP</span>
                  <div className="font-medium text-slate-900">{item.mrp ? `₹${item.mrp}` : '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Quantity</span>
                  <div className={`font-medium text-sm ${item.quantity <= 5 ? 'text-red-700' : 'text-green-700'}`}>
                    {item.quantity} {item.unit}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {stockList.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No stock found</p>
            </div>
          )}
        </div>

        {/* ✅ Pagination bar */}
        <PaginationBar
          currentPage={stockCurrentPage}
          totalPages={stockTotalPages}
          startIndex={stockStartIndex}
          pageCount={paginatedStockItems.length}
          totalCount={stockList.length}
          label="stock items"
          onPrevious={() => setStockPage((p) => Math.max(1, p - 1))}
          onNext={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  const SalesReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Net Revenue (Sales - Returns)</div>
          <div className="text-lg sm:text-2xl font-bold text-green-600">₹{salesSummary.totalSales.toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Net Tax Collected</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{salesSummary.totalTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Transaction History (Sales & Returns)</div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(salesList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), Type: i.type, InvoiceNumber: i.invoiceNumber, PartyName: i.partyName, Tax: i.totalTax, TotalAmount: i.totalAmount })), 'sales-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(salesList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), Type: i.type, InvoiceNumber: i.invoiceNumber, PartyName: i.partyName, Tax: i.totalTax, TotalAmount: i.totalAmount })), 'sales-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Sales Report', document.querySelector('.sales-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={salesPageSize}
              onChange={(e) => {
                setSalesPageSize(Number(e.target.value));
                setSalesPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left sales-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Date</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Type</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Invoice / Ref</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Party Name</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Tax</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Total Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedSales.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${inv.type === 'RETURN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                    >
                      {inv.type === 'RETURN' ? 'CREDIT NOTE' : 'INVOICE'}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">
                    {inv.invoiceNumber}
                    {inv.originalRefNumber && (
                      <div className="text-xs text-slate-400">Ref: {inv.originalRefNumber}</div>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{inv.partyName}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">
                    {inv.type === 'RETURN' ? '-' : ''}₹{inv.totalTax.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-sm ${inv.type === 'RETURN' ? 'text-red-600' : 'text-green-600'
                      }`}
                  >
                    {inv.type === 'RETURN' ? '-' : ''}₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {salesList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No sales records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedSales.map((inv) => (
            <div key={inv.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{inv.invoiceNumber}</div>
                  <div className="text-xs text-slate-500 mt-1">{new Date(inv.date).toLocaleDateString()}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${inv.type === 'RETURN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {inv.type === 'RETURN' ? 'CREDIT' : 'INVOICE'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">Party</span>
                  <div className="font-medium text-slate-900">{inv.partyName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Tax</span>
                  <div className="font-medium text-slate-900">₹{inv.totalTax.toFixed(2)}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">Total</div>
                <div className={`font-bold text-sm ${inv.type === 'RETURN' ? 'text-red-600' : 'text-green-600'}`}>₹{inv.totalAmount.toLocaleString()}</div>
              </div>
            </div>
          ))}
          {salesList.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No sales records found</p>
            </div>
          )}
        </div>

        {/* ✅ Pagination bar */}
        <PaginationBar
          currentPage={salesCurrentPage}
          totalPages={salesTotalPages}
          startIndex={salesStartIndex}
          pageCount={paginatedSales.length}
          totalCount={salesList.length}
          label="transactions"
          onPrevious={() => setSalesPage((p) => Math.max(1, p - 1))}
          onNext={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  const SaleReturnReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Returns Amount</div>
          <div className="text-lg sm:text-2xl font-bold text-red-600">₹{returnSummary.totalReturns.toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Return Tax</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{returnSummary.totalReturnTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Sale Return / Credit Note History</div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(returnList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), CreditNoteNo: i.invoiceNumber, OriginalInvoice: i.originalRefNumber, PartyName: i.partyName, Reason: i.notes, Tax: i.totalTax, ReturnAmount: i.totalAmount })), 'sale-returns-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(returnList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), CreditNoteNo: i.invoiceNumber, OriginalInvoice: i.originalRefNumber, PartyName: i.partyName, Reason: i.notes, Tax: i.totalTax, ReturnAmount: i.totalAmount })), 'sale-returns-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Sale Returns Report', document.querySelector('.sale-returns-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={returnPageSize}
              onChange={(e) => {
                setReturnPageSize(Number(e.target.value));
                setReturnPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left sale-returns-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Date</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Credit Note No.</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Original Invoice</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Party Name</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Reason</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Tax</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Return Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedReturns.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">{inv.invoiceNumber}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-sm">
                    {inv.originalRefNumber && inv.originalRefNumber.trim() !== '' ? (
                      <span className="font-medium text-slate-800">{inv.originalRefNumber}</span>
                    ) : (
                      <span className="text-slate-400 italic">Not Specified</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{inv.partyName}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">
                    {inv.notes && inv.notes.trim() !== '' ? (
                      <span className="text-slate-700">{inv.notes}</span>
                    ) : (
                      <span className="text-slate-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">₹{inv.totalTax.toFixed(2)}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-red-600 text-sm">
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {returnList.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No sale returns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedReturns.map((inv) => (
            <div key={inv.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{inv.invoiceNumber}</div>
                  <div className="text-xs text-slate-500 mt-1">{new Date(inv.date).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">Party</span>
                  <div className="font-medium text-slate-900">{inv.partyName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Tax</span>
                  <div className="font-medium text-slate-900">₹{inv.totalTax.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Orig. Invoice</span>
                  <div className="font-medium text-slate-900 text-xs">{inv.originalRefNumber || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Reason</span>
                  <div className="font-medium text-slate-900 text-xs">{inv.notes || '-'}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">Return Amount</div>
                <div className="font-bold text-sm text-red-600">₹{inv.totalAmount.toLocaleString()}</div>
              </div>
            </div>
          ))}
          {returnList.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No sale returns found</p>
            </div>
          )}
        </div>

        <PaginationBar
          currentPage={returnCurrentPage}
          totalPages={returnTotalPages}
          startIndex={returnStartIndex}
          pageCount={paginatedReturns.length}
          totalCount={returnList.length}
          label="returns"
          onPrevious={() => setReturnPage((p) => Math.max(1, p - 1))}
          onNext={() => setReturnPage((p) => Math.min(returnTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  const ItemsReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Items</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">{items.length}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Stock Value</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">
            ₹{items.reduce((sum, i) => sum + i.stock * i.purchasePrice, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Low Stock Items</div>
          <div className="text-lg sm:text-2xl font-bold text-orange-600">{items.filter(i => i.stock <= 5).length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Items Summary</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(items.map(i => ({ Name: i.name, Code: i.code, Barcode: i.barcode, MRP: i.mrp, SellingPrice: i.sellingPrice, PurchasePrice: i.purchasePrice, Stock: i.stock, Unit: i.unit, StockValue: i.stock * i.purchasePrice })), 'items-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(items.map(i => ({ Name: i.name, Code: i.code, Barcode: i.barcode, MRP: i.mrp, SellingPrice: i.sellingPrice, PurchasePrice: i.purchasePrice, Stock: i.stock, Unit: i.unit, StockValue: i.stock * i.purchasePrice })), 'items-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Items Report', document.querySelector('.items-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={itemsPageSize}
              onChange={(e) => {
                setItemsPageSize(Number(e.target.value));
                setItemsPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left items-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Item Name</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">MRP</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Selling Price</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Purchase Price</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-center">Stock</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Stock Value</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4">
                    <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {item.code && <span>Code: {item.code}</span>}
                      {item.code && item.barcode && <span className="mx-1">•</span>}
                      {item.barcode && <span>Barcode: {item.barcode}</span>}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">
                    {item.mrp && item.mrp > 0 ? `₹${item.mrp}` : '-'}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">₹{item.sellingPrice}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">₹{item.purchasePrice}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${item.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                    >
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-slate-800 text-sm">
                    ₹{(item.stock * item.purchasePrice).toLocaleString()}
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedItems.map((item) => (
            <div key={item.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.code && <span>Code: {item.code}</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">MRP</span>
                  <div className="font-medium text-slate-900">{item.mrp && item.mrp > 0 ? `₹${item.mrp}` : '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Selling Price</span>
                  <div className="font-medium text-slate-900">₹{item.sellingPrice}</div>
                </div>
                <div>
                  <span className="text-slate-500">Purchase Price</span>
                  <div className="font-medium text-slate-900">₹{item.purchasePrice}</div>
                </div>
                <div>
                  <span className="text-slate-500">Stock</span>
                  <div className={`font-medium text-sm ${item.stock <= 5 ? 'text-red-700' : 'text-green-700'}`}>
                    {item.stock} {item.unit}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No items found</p>
            </div>
          )}
        </div>

        <PaginationBar
          currentPage={itemsCurrentPage}
          totalPages={itemsTotalPages}
          startIndex={itemsStartIndex}
          pageCount={paginatedItems.length}
          totalCount={items.length}
          label="items"
          onPrevious={() => setItemsPage((p) => Math.max(1, p - 1))}
          onNext={() => setItemsPage((p) => Math.min(itemsTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  const PurchaseReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Purchases</div>
          <div className="text-lg sm:text-2xl font-bold text-blue-600">₹{purchaseSummary.totalPurchases.toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Purchase Tax</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{purchaseSummary.totalPurchaseTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Purchase History</div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(purchaseList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), InvoiceNo: i.invoiceNumber, Supplier: i.partyName, Tax: i.totalTax, TotalAmount: i.totalAmount })), 'purchase-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(purchaseList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), InvoiceNo: i.invoiceNumber, Supplier: i.partyName, Tax: i.totalTax, TotalAmount: i.totalAmount })), 'purchase-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Purchase Report', document.querySelector('.purchase-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={purchasePageSize}
              onChange={(e) => {
                setPurchasePageSize(Number(e.target.value));
                setPurchasePage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left purchase-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Date</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Invoice No.</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Supplier</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Tax</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Total Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedPurchases.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">{inv.invoiceNumber}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{inv.partyName}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">₹{inv.totalTax.toFixed(2)}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-blue-600 text-sm">
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {purchaseList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No purchase records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedPurchases.map((inv) => (
            <div key={inv.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{inv.invoiceNumber}</div>
                  <div className="text-xs text-slate-500 mt-1">{new Date(inv.date).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">Supplier</span>
                  <div className="font-medium text-slate-900">{inv.partyName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Tax</span>
                  <div className="font-medium text-slate-900">₹{inv.totalTax.toFixed(2)}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">Total</div>
                <div className="font-bold text-sm text-blue-600">₹{inv.totalAmount.toLocaleString()}</div>
              </div>
            </div>
          ))}
          {purchaseList.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No purchase records found</p>
            </div>
          )}
        </div>

        <PaginationBar
          currentPage={purchaseCurrentPage}
          totalPages={purchaseTotalPages}
          startIndex={purchaseStartIndex}
          pageCount={paginatedPurchases.length}
          totalCount={purchaseList.length}
          label="purchases"
          onPrevious={() => setPurchasePage((p) => Math.max(1, p - 1))}
          onNext={() => setPurchasePage((p) => Math.min(purchaseTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  const PurchaseReturnReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Purchase Returns</div>
          <div className="text-lg sm:text-2xl font-bold text-red-600">₹{purchaseReturnSummary.totalPurchaseReturns.toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Return Tax</div>
          <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{purchaseReturnSummary.totalPurchaseReturnTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Purchase Return / Debit Note History</div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(purchaseReturnList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), DebitNoteNo: i.invoiceNumber, OriginalInvoice: i.originalRefNumber, Supplier: i.partyName, Reason: i.notes, Tax: i.totalTax, ReturnAmount: i.totalAmount })), 'purchase-returns-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(purchaseReturnList.map(i => ({ Date: new Date(i.date).toLocaleDateString(), DebitNoteNo: i.invoiceNumber, OriginalInvoice: i.originalRefNumber, Supplier: i.partyName, Reason: i.notes, Tax: i.totalTax, ReturnAmount: i.totalAmount })), 'purchase-returns-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Purchase Returns Report', document.querySelector('.purchase-returns-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={purchaseReturnPageSize}
              onChange={(e) => {
                setPurchaseReturnPageSize(Number(e.target.value));
                setPurchaseReturnPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left purchase-returns-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Date</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Debit Note No.</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Original Invoice</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Supplier</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Reason</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Tax</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Return Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedPurchaseReturns.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">{inv.invoiceNumber}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-sm">
                    {inv.originalRefNumber && inv.originalRefNumber.trim() !== '' ? (
                      <span className="font-medium text-slate-800">{inv.originalRefNumber}</span>
                    ) : (
                      <span className="text-slate-400 italic">Not Specified</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{inv.partyName}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">
                    {inv.notes && inv.notes.trim() !== '' ? (
                      <span className="text-slate-700">{inv.notes}</span>
                    ) : (
                      <span className="text-slate-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">₹{inv.totalTax.toFixed(2)}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-red-600 text-sm">
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {purchaseReturnList.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No purchase returns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedPurchaseReturns.map((inv) => (
            <div key={inv.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{inv.invoiceNumber}</div>
                  <div className="text-xs text-slate-500 mt-1">{new Date(inv.date).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">Supplier</span>
                  <div className="font-medium text-slate-900">{inv.partyName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Tax</span>
                  <div className="font-medium text-slate-900">₹{inv.totalTax.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Orig. Invoice</span>
                  <div className="font-medium text-slate-900 text-xs">{inv.originalRefNumber || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Reason</span>
                  <div className="font-medium text-slate-900 text-xs">{inv.notes || '-'}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">Return Amount</div>
                <div className="font-bold text-sm text-red-600">₹{inv.totalAmount.toLocaleString()}</div>
              </div>
            </div>
          ))}
          {purchaseReturnList.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No purchase returns found</p>
            </div>
          )}
        </div>

        <PaginationBar
          currentPage={purchaseReturnCurrentPage}
          totalPages={purchaseReturnTotalPages}
          startIndex={purchaseReturnStartIndex}
          pageCount={paginatedPurchaseReturns.length}
          totalCount={purchaseReturnList.length}
          label="purchase returns"
          onPrevious={() => setPurchaseReturnPage((p) => Math.max(1, p - 1))}
          onNext={() => setPurchaseReturnPage((p) => Math.min(purchaseReturnTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  const PartyReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Receivable (You will get)</div>
          <div className="text-lg sm:text-2xl font-bold text-green-600">₹{partySummary.receivables.toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs sm:text-sm text-slate-500 mb-1">Total Payable (You will pay)</div>
          <div className="text-lg sm:text-2xl font-bold text-red-600">₹{partySummary.payables.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-bold text-slate-700 text-sm sm:text-base">Customer Statement / Balances</div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <button onClick={() => exportToCSV(parties.map(p => ({ PartyName: p.name, Phone: p.phone, Balance: p.balance, Status: p.balance > 0 ? 'Receivable' : p.balance < 0 ? 'Payable' : 'Settled' })), 'parties-report')} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Download size={14} /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={() => exportToExcel(parties.map(p => ({ PartyName: p.name, Phone: p.phone, Balance: p.balance, Status: p.balance > 0 ? 'Receivable' : p.balance < 0 ? 'Payable' : 'Settled' })), 'parties-report')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><FileSpreadsheet size={14} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={() => printTable('Parties Report', document.querySelector('.parties-table')?.outerHTML || '')} className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center gap-1"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={partyPageSize}
              onChange={(e) => {
                setPartyPageSize(Number(e.target.value));
                setPartyPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left parties-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Party Name</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4">Phone</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Balance</th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-center">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedParties.map((party) => (
                <tr key={party.id} className="hover:bg-slate-50">
                  <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">{party.name}</td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-slate-600 text-sm">{party.phone}</td>
                  <td
                    className={`px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-sm ${party.balance > 0
                        ? 'text-green-600'
                        : party.balance < 0
                          ? 'text-red-600'
                          : 'text-slate-400'
                      }`}
                  >
                    ₹{Math.abs(party.balance).toLocaleString()}
                  </td>
                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-center">
                    {party.balance > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        Receivable
                      </span>
                    )}
                    {party.balance < 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                        Payable
                      </span>
                    )}
                    {party.balance === 0 && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                        Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {parties.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 lg:px-6 py-8 text-center text-slate-400">
                    No parties found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden p-3 space-y-3">
          {paginatedParties.map((party) => (
            <div key={party.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
              <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{party.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{party.phone}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-2">
                <div>
                  <span className="text-slate-500">Balance</span>
                  <div className={`font-medium text-sm ${party.balance > 0 ? 'text-green-600' : party.balance < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    ₹{Math.abs(party.balance).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Status</span>
                  <div>
                    {party.balance > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Receivable</span>}
                    {party.balance < 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Payable</span>}
                    {party.balance === 0 && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">Settled</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {parties.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No parties found</p>
            </div>
          )}
        </div>

        {/* ✅ Pagination bar */}
        <PaginationBar
          currentPage={partyCurrentPage}
          totalPages={partyTotalPages}
          startIndex={partyStartIndex}
          pageCount={paginatedParties.length}
          totalCount={parties.length}
          label="parties"
          onPrevious={() => setPartyPage((p) => Math.max(1, p - 1))}
          onNext={() => setPartyPage((p) => Math.min(partyTotalPages, p + 1))}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 pb-6">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Business Reports</h1>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto sm:overflow-visible -mx-3 sm:mx-0 px-3 sm:px-0 mb-6">
        <div className="flex gap-0.5 sm:gap-1 bg-white p-1 sm:p-1.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm w-fit sm:w-full">
          <button
            onClick={() => changeTab('STOCK')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'STOCK' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Package size={16} />
            <span className="hidden sm:inline">Stock Summary</span>
            <span className="sm:hidden">Stock</span>
          </button>

          <button
            onClick={() => changeTab('ITEMS')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'ITEMS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Package size={16} />
            <span className="hidden sm:inline">Items Summary</span>
            <span className="sm:hidden">Items</span>
          </button>

          <button
            onClick={() => changeTab('SALES')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'SALES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <TrendingUp size={16} />
            <span className="hidden sm:inline">Sales Report</span>
            <span className="sm:hidden">Sales</span>
          </button>

          <button
            onClick={() => changeTab('SALE_RETURNS')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'SALE_RETURNS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <TrendingUp size={16} className="rotate-180" />
            <span className="hidden sm:inline">Sale Returns</span>
            <span className="sm:hidden">Returns</span>
          </button>

          <button
            onClick={() => changeTab('PURCHASES')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'PURCHASES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Package size={16} />
            <span className="hidden sm:inline">Purchase Report</span>
            <span className="sm:hidden">Purchase</span>
          </button>

          <button
            onClick={() => changeTab('PURCHASE_RETURNS')}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'PURCHASE_RETURNS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Package size={16} className="rotate-180" />
            <span className="hidden sm:inline">Purchase Returns</span>
            <span className="sm:hidden">Pur. Ret.</span>
          </button>

          <button
            onClick={() => changeTab('PARTIES')}
            className={`flex items-center space-x-1.5 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTab === 'PARTIES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <Users size={16} />
            <span className="hidden sm:inline">Customer Statement</span>
            <span className="sm:hidden">Customers</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'STOCK' && <StockReport />}
        {activeTab === 'ITEMS' && <ItemsReport />}
        {activeTab === 'SALES' && <SalesReport />}
        {activeTab === 'SALE_RETURNS' && <SaleReturnReport />}
        {activeTab === 'PURCHASES' && <PurchaseReport />}
        {activeTab === 'PURCHASE_RETURNS' && <PurchaseReturnReport />}
        {activeTab === 'PARTIES' && <PartyReport />}
      </div>
      </div>
    </div>
  );
};

export default Reports;
