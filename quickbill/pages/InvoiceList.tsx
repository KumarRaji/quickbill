
import React from 'react';
import { Invoice, TransactionType } from '../types';
import { FileText, Eye, Undo2, ShoppingCart, Printer, Plus } from 'lucide-react';

interface InvoiceListProps {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  onCreate: () => void;
  type: TransactionType;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onView, onPrint, onCreate, type }) => {
  const filteredInvoices = invoices.filter(inv => inv.type === type);

  const getTitle = () => {
    switch (type) {
      case 'SALE': return 'Sale Invoices';
      case 'RETURN': return 'Sale Returns (Credit Note)';
      case 'PURCHASE': return 'Purchase Bills';
      case 'PURCHASE_RETURN': return 'Purchase Returns (Debit Note)';
      default: return 'Invoices';
    }
  };

  const getButtonLabel = () => {
    switch (type) {
      case 'SALE': return 'Create Sale Invoice';
      case 'RETURN': return 'Create Credit Note';
      case 'PURCHASE': return 'Add Purchase Bill';
      case 'PURCHASE_RETURN': return 'Create Debit Note';
      default: return 'Create New';
    }
  };

  const getButtonColor = () => {
    if (type === 'RETURN' || type === 'PURCHASE_RETURN') return 'bg-slate-600 hover:bg-slate-700';
    if (type === 'PURCHASE') return 'bg-orange-600 hover:bg-orange-700';
    return 'bg-blue-600 hover:bg-blue-700';
  };

  const getEmptyMessage = () => {
    switch (type) {
      case 'SALE': return 'No invoices created yet.';
      case 'RETURN': return 'No returns recorded.';
      case 'PURCHASE': return 'No purchase bills recorded.';
      case 'PURCHASE_RETURN': return 'No purchase returns recorded.';
      default: return 'No records found.';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">{getTitle()}</h1>
        <button 
          onClick={onCreate}
          className={`${getButtonColor()} text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm`}
        >
          <Plus size={18} />
          <span>{getButtonLabel()}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Number</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Party Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onView(inv)}>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(inv.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                    {inv.partyName}
                    {inv.originalRefNumber && <div className="text-xs text-slate-400 mt-0.5">Ref: {inv.originalRefNumber}</div>}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right font-bold ${type === 'RETURN' || type === 'PURCHASE_RETURN' ? 'text-red-600' : 'text-slate-800'}`}>
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                      inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onPrint(inv); }}
                          className="text-slate-500 hover:text-slate-800 p-1"
                          title="Print"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onView(inv); }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
               {filteredInvoices.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
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
      </div>
    </div>
  );
};

export default InvoiceList;
