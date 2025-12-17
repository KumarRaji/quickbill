import React, { useMemo, useState } from 'react';
import { Party, Item, Invoice } from '../types';
import { Package, Users, TrendingUp } from 'lucide-react';
import { StockItem } from '../services/api';

interface ReportsProps {
  invoices: Invoice[];
  parties: Party[];
  items: Item[];
  stock: StockItem[];
}

type ReportTab = 'STOCK' | 'ITEMS' | 'SALES' | 'SALE_RETURNS' | 'PURCHASES' | 'PARTIES';

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
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
      <p className="text-xs text-slate-500">
        Showing{' '}
        <span className="font-medium">
          {startIndex + 1}–{Math.min(startIndex + pageCount, totalCount)}
        </span>{' '}
        of <span className="font-medium">{totalCount}</span> {label}
      </p>

      <div className="inline-flex items-center gap-2 text-sm">
        <button
          onClick={onPrevious}
          disabled={currentPage === 1}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <span className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
          {currentPage}
        </span>

        <button
          onClick={onNext}
          disabled={currentPage === totalPages}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
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


  // -----------------------
  // Calculations
  // -----------------------

  const stockSummary = useMemo(() => {
    const totalStockValue = stock.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0);
    const lowStockCount = stock.filter((i) => i.quantity <= 5).length;
    return { totalStockValue, lowStockCount };
  }, [stock]);

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

  // -----------------------
  // Paginated Data
  // -----------------------

  // STOCK
  const stockTotalPages = Math.max(1, Math.ceil(stock.length / stockPageSize));
  const stockCurrentPage = Math.min(stockPage, stockTotalPages);
  const stockStartIndex = (stockCurrentPage - 1) * stockPageSize;
  const paginatedStockItems = stock.slice(stockStartIndex, stockStartIndex + stockPageSize);

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

  // Reset page when switching tabs (nice UX)
  const changeTab = (tab: ReportTab) => {
    setActiveTab(tab);
    if (tab === 'STOCK') setStockPage(1);
    if (tab === 'ITEMS') setItemsPage(1);
    if (tab === 'SALES') setSalesPage(1);
    if (tab === 'SALE_RETURNS') setReturnPage(1);
    if (tab === 'PURCHASES') setPurchasePage(1);
    if (tab === 'PARTIES') setPartyPage(1);
  };

  // -----------------------
  // Subcomponents
  // -----------------------

  const StockReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Stock Value</div>
          <div className="text-2xl font-bold text-slate-800">
            ₹{stockSummary.totalStockValue.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Products</div>
          <div className="text-2xl font-bold text-slate-800">{stock.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Low Stock Items</div>
          <div className="text-2xl font-bold text-orange-600">{stockSummary.lowStockCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="font-bold text-slate-700">Stock Detail</div>

          {/* ✅ Page size dropdown at TOP (Stock only) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={stockPageSize}
              onChange={(e) => {
                setStockPageSize(Number(e.target.value));
                setStockPage(1); // reset to page 1
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Item Name</th>
                <th className="px-6 py-3">Supplier</th>
                <th className="px-6 py-3 text-right">Purchase Price</th>
                <th className="px-6 py-3 text-center">Quantity</th>
                <th className="px-6 py-3 text-right">Stock Value</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedStockItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    {item.code && <div className="text-xs text-slate-400">Code: {item.code}</div>}
                    {item.barcode && <div className="text-xs text-slate-400">Barcode: {item.barcode}</div>}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{item.supplier_name || '-'}</td>
                  <td className="px-6 py-4 text-right text-slate-600">₹{item.purchase_price}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${item.quantity <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                    >
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    ₹{(item.quantity * item.purchase_price).toLocaleString()}
                  </td>
                </tr>
              ))}

              {stock.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No stock found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ Pagination bar */}
        <PaginationBar
          currentPage={stockCurrentPage}
          totalPages={stockTotalPages}
          startIndex={stockStartIndex}
          pageCount={paginatedStockItems.length}
          totalCount={stock.length}
          label="stock items"
          onPrevious={() => setStockPage((p) => Math.max(1, p - 1))}
          onNext={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))}
        />
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
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="font-bold text-slate-700">Transaction History (Sales & Returns)</div>

          {/* ✅ Page size dropdown (Sales) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={salesPageSize}
              onChange={(e) => {
                setSalesPageSize(Number(e.target.value));
                setSalesPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
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
              {paginatedSales.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${inv.type === 'RETURN' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                    >
                      {inv.type === 'RETURN' ? 'CREDIT NOTE' : 'INVOICE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {inv.invoiceNumber}
                    {inv.originalRefNumber && (
                      <div className="text-xs text-slate-400">Ref: {inv.originalRefNumber}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{inv.partyName}</td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {inv.type === 'RETURN' ? '-' : ''}₹{inv.totalTax.toFixed(2)}
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-bold ${inv.type === 'RETURN' ? 'text-red-600' : 'text-green-600'
                      }`}
                  >
                    {inv.type === 'RETURN' ? '-' : ''}₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {salesList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No sales records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Returns Amount</div>
          <div className="text-2xl font-bold text-red-600">₹{returnSummary.totalReturns.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Return Tax</div>
          <div className="text-2xl font-bold text-slate-800">₹{returnSummary.totalReturnTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="font-bold text-slate-700">Sale Return / Credit Note History</div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={returnPageSize}
              onChange={(e) => {
                setReturnPageSize(Number(e.target.value));
                setReturnPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Credit Note No.</th>
                <th className="px-6 py-3">Original Invoice</th>
                <th className="px-6 py-3">Party Name</th>
                <th className="px-6 py-3 text-right">Tax</th>
                <th className="px-6 py-3 text-right">Return Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedReturns.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4">
                    {inv.originalRefNumber && inv.originalRefNumber.trim() !== '' ? (
                      <span className="font-medium text-slate-800">{inv.originalRefNumber}</span>
                    ) : (
                      <span className="text-slate-400 italic">Not Specified</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{inv.partyName}</td>
                  <td className="px-6 py-4 text-right text-slate-600">₹{inv.totalTax.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-red-600">
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {returnList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No sale returns found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Items</div>
          <div className="text-2xl font-bold text-slate-800">{items.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Stock Value</div>
          <div className="text-2xl font-bold text-slate-800">
            ₹{items.reduce((sum, i) => sum + i.stock * i.purchasePrice, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Low Stock Items</div>
          <div className="text-2xl font-bold text-orange-600">{items.filter(i => i.stock <= 5).length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="font-bold text-slate-700">Items Summary</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={itemsPageSize}
              onChange={(e) => {
                setItemsPageSize(Number(e.target.value));
                setItemsPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Item Name</th>
                <th className="px-6 py-3 text-right">MRP</th>
                <th className="px-6 py-3 text-right">Selling Price</th>
                <th className="px-6 py-3 text-right">Purchase Price</th>
                <th className="px-6 py-3 text-center">Stock</th>
                <th className="px-6 py-3 text-right">Stock Value</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {item.code && <span>Code: {item.code}</span>}
                      {item.code && item.barcode && <span className="mx-1">•</span>}
                      {item.barcode && <span>Barcode: {item.barcode}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {item.mrp && item.mrp > 0 ? `₹${item.mrp}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">₹{item.sellingPrice}</td>
                  <td className="px-6 py-4 text-right text-slate-600">₹{item.purchasePrice}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${item.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                    >
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    ₹{(item.stock * item.purchasePrice).toLocaleString()}
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Purchases</div>
          <div className="text-2xl font-bold text-blue-600">₹{purchaseSummary.totalPurchases.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Purchase Tax</div>
          <div className="text-2xl font-bold text-slate-800">₹{purchaseSummary.totalPurchaseTax.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="font-bold text-slate-700">Purchase History</div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={purchasePageSize}
              onChange={(e) => {
                setPurchasePageSize(Number(e.target.value));
                setPurchasePage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Invoice No.</th>
                <th className="px-6 py-3">Supplier</th>
                <th className="px-6 py-3 text-right">Tax</th>
                <th className="px-6 py-3 text-right">Total Amount</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedPurchases.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-slate-600">{inv.partyName}</td>
                  <td className="px-6 py-4 text-right text-slate-600">₹{inv.totalTax.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-600">
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))}

              {purchaseList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No purchase records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="font-bold text-slate-700">Customer Statement / Balances</div>

          {/* ✅ Page size dropdown (Parties) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={partyPageSize}
              onChange={(e) => {
                setPartyPageSize(Number(e.target.value));
                setPartyPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="overflow-x-auto">
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
              {paginatedParties.map((party) => (
                <tr key={party.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{party.name}</td>
                  <td className="px-6 py-4 text-slate-600">{party.phone}</td>
                  <td
                    className={`px-6 py-4 text-right font-bold ${party.balance > 0
                        ? 'text-green-600'
                        : party.balance < 0
                          ? 'text-red-600'
                          : 'text-slate-400'
                      }`}
                  >
                    ₹{Math.abs(party.balance).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
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
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    No parties found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Business Reports</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm mb-6 w-fit">
        <button
          onClick={() => changeTab('STOCK')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'STOCK' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Package size={18} />
          <span>Stock Summary</span>
        </button>

        <button
          onClick={() => changeTab('ITEMS')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'ITEMS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Package size={18} />
          <span>Items Summary</span>
        </button>

        <button
          onClick={() => changeTab('SALES')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'SALES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <TrendingUp size={18} />
          <span>Sales Report</span>
        </button>

        <button
          onClick={() => changeTab('SALE_RETURNS')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'SALE_RETURNS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <TrendingUp size={18} className="rotate-180" />
          <span>Sale Returns</span>
        </button>

        <button
          onClick={() => changeTab('PURCHASES')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'PURCHASES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Package size={18} />
          <span>Purchase Report</span>
        </button>

        <button
          onClick={() => changeTab('PARTIES')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'PARTIES' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Users size={18} />
          <span>Customer Statement</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'STOCK' && <StockReport />}
        {activeTab === 'ITEMS' && <ItemsReport />}
        {activeTab === 'SALES' && <SalesReport />}
        {activeTab === 'SALE_RETURNS' && <SaleReturnReport />}
        {activeTab === 'PURCHASES' && <PurchaseReport />}
        {activeTab === 'PARTIES' && <PartyReport />}
      </div>
    </div>
  );
};

export default Reports;
