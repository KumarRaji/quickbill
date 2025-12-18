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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">{getTitle()}</h1>

          {/* ✅ Page size dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1); // ✅ reset to first page
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

        <button
          onClick={onCreate}
          className={`${getButtonColor()} text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm`}
        >
          <Plus size={18} />
          <span>{getButtonLabel()}</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                Date
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                Number
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                Party Name
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">
                Items
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">
                MRP
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">
                Amount
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-center">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {paginatedInvoices.map((inv) => (
              <tr
                key={inv.id}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => onView(inv)}
              >
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(inv.date).toLocaleDateString()}
                </td>

                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {inv.invoiceNumber}
                </td>

                <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                  {inv.partyName}
                  {inv.originalRefNumber && (
                    <div className="text-xs text-slate-400 mt-0.5">Ref: {inv.originalRefNumber}</div>
                  )}
                </td>

                <td className="px-6 py-4 text-sm text-slate-600">
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

                <td className="px-6 py-4 text-sm text-slate-600 text-right">
                  {inv.items.length > 0 && inv.items[0].mrp ? `₹${inv.items[0].mrp}` : '-'}
                </td>

                <td
                  className={`px-6 py-4 text-sm text-right font-bold ${
                    type === 'RETURN' || type === 'PURCHASE_RETURN' ? 'text-red-600' : 'text-slate-800'
                  }`}
                >
                  ₹{inv.totalAmount.toLocaleString()}
                </td>

                <td className="px-6 py-4 text-center">
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

                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
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
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                  {type === 'SALE' && <FileText size={48} className="mx-auto mb-2 opacity-20" />}
                  {type === 'RETURN' && <Undo2 size={48} className="mx-auto mb-2 opacity-20" />}
                  {type === 'PURCHASE' && <ShoppingCart size={48} className="mx-auto mb-2 opacity-20" />}
                  {type === 'PURCHASE_RETURN' && <Undo2 size={48} className="mx-auto mb-2 opacity-20" />}
                  <div className="mb-4">{getEmptyMessage()}</div>
                  <button
                    onClick={onCreate}
                    className={`${getButtonColor()} text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors shadow-sm`}
                  >
                    <Plus size={18} />
                    <span>{getButtonLabel()}</span>
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ✅ Pagination bar (Previous 1 Next style) */}
        {filteredInvoices.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-medium">
                {startIndex + 1}–
                {Math.min(startIndex + paginatedInvoices.length, filteredInvoices.length)}
              </span>{' '}
              of <span className="font-medium">{filteredInvoices.length}</span> invoices
            </p>

            <div className="inline-flex items-center gap-2 text-sm">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className={`${getButtonColor()} text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Previous
              </button>

              <span className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                {currentPage}
              </span>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className={`${getButtonColor()} text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
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

export default InvoiceList;
