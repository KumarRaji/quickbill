import React, { useMemo, useState } from 'react';
import { Invoice, TransactionType } from '../types';
import { FileText, Eye, Undo2, ShoppingCart, Printer, Plus, Edit, Trash2 } from 'lucide-react';

interface InvoiceListProps {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  onCreate: () => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  type: TransactionType;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onView, onPrint, onCreate, onEdit, onDelete, type }) => {
  // ✅ Page size + pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ✅ Filter first
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.type === type);
  }, [invoices, type]);

  // ✅ Pagination calculations after filter
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + pageSize);

  const handlePrevious = () => setPage((prev) => Math.max(1, prev - 1));
  const handleNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

  const getTitle = () => {
    switch (type) {
      case 'SALE':
        return 'Sale Invoices';
      case 'RETURN':
        return 'Sale Returns (Credit Note)';
      case 'PURCHASE':
        return 'Purchase Bills';
      case 'PURCHASE_RETURN':
        return 'Purchase Returns (Debit Note)';
      default:
        return 'Invoices';
    }
  };

  const getButtonLabel = () => {
    switch (type) {
      case 'SALE':
        return 'Create Sale Invoice';
      case 'RETURN':
        return 'Create Credit Note';
      case 'PURCHASE':
        return 'Add Purchase Bill';
      case 'PURCHASE_RETURN':
        return 'Create Debit Note';
      default:
        return 'Create New';
    }
  };

  const getButtonColor = () => {
    if (type === 'RETURN' || type === 'PURCHASE_RETURN') return 'bg-slate-600 hover:bg-slate-700';
    if (type === 'PURCHASE') return 'bg-orange-600 hover:bg-orange-700';
    return 'bg-blue-600 hover:bg-blue-700';
  };

  const getEmptyMessage = () => {
    switch (type) {
      case 'SALE':
        return 'No invoices created yet.';
      case 'RETURN':
        return 'No returns recorded.';
      case 'PURCHASE':
        return 'No purchase bills recorded.';
      case 'PURCHASE_RETURN':
        return 'No purchase returns recorded.';
      default:
        return 'No records found.';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:gap-3 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{getTitle()}</h1>

            {/* Page size dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 sm:px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={onCreate}
            className={`${getButtonColor()} text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center sm:justify-start space-x-2 transition-colors shadow-sm text-sm whitespace-nowrap flex-shrink-0`}
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{getButtonLabel()}</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Table - Desktop Only */}
          <div className="hidden sm:block">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                  Date
                </th>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                  Number
                </th>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                  Party Name
                </th>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                  Items
                </th>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">
                  Amount
                </th>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-center">
                  Status
                </th>
                <th className="px-4 lg:px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 lg:px-6 py-3 text-sm text-slate-600">
                    {new Date(inv.date).toLocaleDateString()}
                  </td>

                  <td className="px-4 lg:px-6 py-3 text-sm font-medium text-slate-800">
                    {inv.invoiceNumber}
                  </td>

                  <td className="px-4 lg:px-6 py-3 text-sm text-slate-800 font-medium">
                    {inv.partyName}
                    {inv.originalRefNumber && (
                      <div className="text-xs text-slate-400 mt-0.5">Ref: {inv.originalRefNumber}</div>
                    )}
                  </td>

                  <td className="px-4 lg:px-6 py-3 text-sm text-slate-600">
                    <div className="max-w-xs">
                      {inv.items.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="text-xs">
                          {item.itemName} (x{item.quantity})
                        </div>
                      ))}
                      {inv.items.length > 2 && (
                        <div className="text-xs text-slate-400">+{inv.items.length - 2} more</div>
                      )}
                    </div>
                  </td>

                  <td
                    className={`px-4 lg:px-6 py-3 text-sm text-right font-bold ${
                      type === 'RETURN' || type === 'PURCHASE_RETURN' ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>

                  <td className="px-4 lg:px-6 py-3 text-center">
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded-full ${
                        inv.status === 'PAID'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>

                  <td className="px-4 lg:px-6 py-3 text-right">
                    <div className="flex justify-end space-x-1 lg:space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(inv);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="View"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(inv);
                        }}
                        className="text-green-600 hover:text-green-800 p-1"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrint(inv);
                        }}
                        className="text-slate-500 hover:text-slate-800 p-1"
                        title="Print"
                      >
                        <Printer size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(inv);
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    {type === 'SALE' && <FileText size={48} className="mx-auto mb-2 opacity-20" />}
                    {type === 'RETURN' && <Undo2 size={48} className="mx-auto mb-2 opacity-20" />}
                    {type === 'PURCHASE' && <ShoppingCart size={48} className="mx-auto mb-2 opacity-20" />}
                    {type === 'PURCHASE_RETURN' && <Undo2 size={48} className="mx-auto mb-2 opacity-20" />}
                    <div className="mb-4">{getEmptyMessage()}</div>
                    <button
                      onClick={onCreate}
                      className={`${getButtonColor()} text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm text-sm`}
                    >
                      <Plus size={18} />
                      <span>{getButtonLabel()}</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
          {paginatedInvoices.length > 0 ? (
            paginatedInvoices.map((inv) => (
              <div
                key={inv.id}
                className="border border-slate-300 rounded-lg p-3 bg-white space-y-2 hover:bg-slate-50"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 font-semibold">Invoice #</div>
                    <div className="text-sm font-medium text-slate-800 truncate">{inv.invoiceNumber}</div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded-full flex-shrink-0 ${
                      inv.status === 'PAID'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 font-semibold">Date</div>
                    <div className="text-slate-700">{new Date(inv.date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-semibold">Party</div>
                    <div className="text-slate-700 truncate">{inv.partyName}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-semibold mb-1">Items</div>
                  <div className="text-xs text-slate-600">
                    {inv.items.slice(0, 2).map((item, idx) => (
                      <div key={idx}>{item.itemName} (×{item.quantity})</div>
                    ))}
                    {inv.items.length > 2 && (
                      <div className="text-slate-400">+{inv.items.length - 2} more</div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-100 p-2 rounded flex justify-between items-center">
                  <span className="text-xs text-slate-500">Amount:</span>
                  <span
                    className={`text-sm font-bold ${
                      type === 'RETURN' || type === 'PURCHASE_RETURN' ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    ₹{inv.totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(inv);
                    }}
                    className="flex-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(inv);
                    }}
                    className="flex-1 text-green-600 hover:text-green-800 hover:bg-green-50 p-1.5 rounded text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrint(inv);
                    }}
                    className="flex-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(inv);
                    }}
                    className="flex-1 text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>

                {inv.originalRefNumber && (
                  <div className="text-xs text-slate-400 pt-1 border-t border-slate-200">
                    Ref: {inv.originalRefNumber}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              {type === 'SALE' && <FileText size={48} className="mx-auto mb-2 opacity-20" />}
              {type === 'RETURN' && <Undo2 size={48} className="mx-auto mb-2 opacity-20" />}
              {type === 'PURCHASE' && <ShoppingCart size={48} className="mx-auto mb-2 opacity-20" />}
              {type === 'PURCHASE_RETURN' && <Undo2 size={48} className="mx-auto mb-2 opacity-20" />}
              <div className="mb-4 text-slate-400">{getEmptyMessage()}</div>
              <button
                onClick={onCreate}
                className={`${getButtonColor()} text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm text-sm`}
              >
                <Plus size={18} />
                <span>New</span>
              </button>
            </div>
          )}
        </div>

        {/* Pagination bar */}
        {filteredInvoices.length > 0 && (
          <div className="px-3 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <p className="text-xs text-slate-500 order-2 sm:order-1">
              Showing{' '}
              <span className="font-medium">
                {startIndex + 1}–
                {Math.min(startIndex + paginatedInvoices.length, filteredInvoices.length)}
              </span>{' '}
              of <span className="font-medium">{filteredInvoices.length}</span>
            </p>

            <div className="inline-flex items-center gap-2 text-sm order-1 sm:order-2 w-full sm:w-auto">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className={`${getButtonColor()} text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex-1 sm:flex-initial`}
              >
                Prev
              </button>

              <span className="px-2 sm:px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className={`${getButtonColor()} text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex-1 sm:flex-initial`}
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

export default InvoiceList;
