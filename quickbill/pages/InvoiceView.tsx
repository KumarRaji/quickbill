import React, { useEffect, useState } from 'react';
import { Invoice, Party } from '../types';
import { Printer, ArrowLeft, Receipt, FileText } from 'lucide-react';

interface InvoiceViewProps {
  invoice: Invoice;
  onBack: () => void;
  autoPrint?: boolean;
  parties?: Party[];
}

// ✅ Safe money formatter
const formatMoney = (value: number | string | null | undefined): string => {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return '0.00';
  return num.toFixed(2);
};

const InvoiceView: React.FC<InvoiceViewProps> = ({ invoice, onBack, autoPrint = false, parties = [] }) => {
  const [viewMode, setViewMode] = useState<'A4' | 'THERMAL'>('A4');
  
  console.log('InVoice',invoice);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const getDocTitle = () => {
    switch (invoice.type) {
      case 'SALE':
        return 'TAX INVOICE';
      case 'RETURN':
        return 'CREDIT NOTE';
      case 'PURCHASE':
        return 'PURCHASE BILL';
      case 'PURCHASE_RETURN':
        return 'DEBIT NOTE';
      default:
        return 'INVOICE';
    }
  };

  // ----- Layouts -----

  const StandardLayout: React.FC = () => {
    const items = invoice.items || [];

    // If you have invoice.totalTax, subtotal = totalAmount - totalTax
    const totalAmountNum = Number(invoice.totalAmount || 0);
    const totalTaxNum = Number((invoice as any).totalTax || 0); // adjust if totalTax is on Invoice type
    const subTotal = totalAmountNum - totalTaxNum;

    return (
      <div className="bg-white max-w-4xl mx-auto shadow-xl p-8 min-h-[1100px] print:shadow-none print:min-h-0 print:p-0">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                Q
              </div>
              <h1 className="text-2xl font-bold text-slate-800">QuickBill</h1>
            </div>
            <p className="text-slate-500 text-sm">
              123 Business Hub, Tech City
              <br />
              Salem, India - 603300
              <br />
              GSTIN: 24ABCDE1234F1Z5
              <br />
              support@quickbill.com
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold mb-2 uppercase tracking-widest text-slate-300">
              {getDocTitle()}
            </h2>
            <div className="text-slate-600">
              {/* NOTE: if your type uses invoiceNo instead of invoiceNumber, change below */}
              <span className="font-bold"># {(invoice as any).invoiceNumber || (invoice as any).invoiceNo}</span>
              <br />
              Date: {new Date(invoice.date).toLocaleDateString()}
              {(invoice as any).originalRefNumber && (
                <>
                  <br />
                  <span className="text-sm">Ref No: {(invoice as any).originalRefNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {invoice.type.includes('PURCHASE') ? 'Supplier' : 'Bill To'}
          </h3>
          <h2 className="text-xl font-bold text-slate-800 mb-1">
            {parties.find(p => p.id === invoice.partyId)?.name || invoice.partyName || `Party #${invoice.partyId}`}
          </h2>
         
          <p className="text-slate-500">Party ID: {invoice.partyId}</p>
        </div>

        {/* Table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left rounded-l-lg text-sm font-medium">Item Description</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Rate</th>
              <th className="px-4 py-3 text-right rounded-r-lg text-sm font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {item.itemName || item.name}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  ₹{formatMoney(item.price)}
                </td>
                <td className="px-4 py-3 text-right text-slate-800 font-bold">
                  ₹{formatMoney(item.amount ?? item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-12">
          <div className="w-64">
            <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
              <span>Subtotal</span>
              <span>₹{formatMoney(subTotal)}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
              <span>Tax Total</span>
              <span>₹{formatMoney((invoice as any).totalTax)}</span>
            </div>
            <div className="flex justify-between py-4 text-xl font-bold text-slate-800">
              <span>Total</span>
              <span>₹{formatMoney(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="border-t border-slate-100 pt-8">
          <h4 className="text-sm font-bold text-slate-800 mb-2">
            Terms & Conditions
          </h4>
          <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
            <li>Product once sold can not be taken back.</li>
            <li>
              Interest @ 18% p.a. will be charged if payment is not made within
              the due date.
            </li>
            <li>Subject to local jurisdiction only.</li>
          </ul>
        </div>

        <div className="mt-12 text-center text-xs text-slate-400">
          Authorized Signatory
        </div>
        <div align="center" className="mt-2 text-center text-xs text-slate-400 font-bold">
          QuickBill - shopping !!
        </div>

      </div>
    );
  };

  const ThermalLayout: React.FC = () => {
    const items = invoice.items || [];

    return (
      <div className="bg-white mx-auto p-2 shadow-xl print:shadow-none w-[300px] print:w-full font-mono text-sm text-black leading-tight">
        <div className="text-center mb-2">
          <h2 className="text-lg font-bold uppercase">QuickBill</h2>
          <p className="text-xs">123 Business Hub, Tech City</p>
          <p className="text-xs">Ph: 9876543210</p>
          <p className="text-xs">GST: 24ABCDE1234F1Z5</p>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        <div className="flex justify-between text-xs mb-1">
          <span>Type:</span>
          <span className="font-bold">{getDocTitle()}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span>No:</span>
          <span>{(invoice as any).invoiceNumber || (invoice as any).invoiceNo}</span>
        </div>
        {(invoice as any).originalRefNumber && (
          <div className="flex justify-between text-xs mb-1">
            <span>Ref:</span>
            <span>{(invoice as any).originalRefNumber}</span>
          </div>
        )}
        <div className="flex justify-between text-xs mb-2">
          <span>Date:</span>
          <span>{new Date(invoice.date).toLocaleDateString()}</span>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        <div className="mb-2">
          <span className="text-xs font-bold">Party: </span>
          <span className="text-xs">
            {parties.find(p => p.id === invoice.partyId)?.name || (invoice as any).partyName || `#${invoice.partyId}`}
          </span>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        {/* Items Header */}
        <div className="flex font-bold text-xs mb-1">
          <div className="w-1/2">Item</div>
          <div className="w-1/4 text-center">Qty</div>
          <div className="w-1/4 text-right">Amt</div>
        </div>

        {/* Items List */}
        <div className="mb-2">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="mb-1">
              <div className="text-xs truncate">
                {item.itemName || item.name}
              </div>
              <div className="flex text-xs text-slate-600">
                <div className="w-1/2" />
                <div className="w-1/4 text-center">
                  {item.quantity} x {formatMoney(item.price)}
                </div>
                <div className="w-1/4 text-right text-black">
                  ₹{formatMoney(item.amount ?? item.total)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-dashed border-black my-2" />

        <div className="flex justify-between font-bold text-sm mb-1">
          <span>TOTAL:</span>
          <span>₹{formatMoney(invoice.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-xs mb-4">
          <span>(Inc. Taxes)</span>
          <span>₹{formatMoney((invoice as any).totalTax)}</span>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        <div className="text-center text-xs mt-2">
          <p>Thank you for your business!</p>
          <p className="mt-1">Visit Again</p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {/* Toolbar - Hidden when printing */}
      <div className="no-print mb-6 flex justify-between items-center max-w-4xl mx-auto w-full pt-4 px-4">
        <button
          onClick={onBack}
          className="flex items-center text-slate-600 hover:text-slate-900 font-medium"
        >
          <ArrowLeft size={20} className="mr-2" /> Back
        </button>

        <div className="flex space-x-3 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
          <button
            onClick={() => setViewMode('A4')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${viewMode === 'A4'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <FileText size={18} />
            <span className="text-sm font-medium">Standard A4</span>
          </button>
          <button
            onClick={() => setViewMode('THERMAL')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${viewMode === 'THERMAL'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Receipt size={18} />
            <span className="text-sm font-medium">Thermal</span>
          </button>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 shadow-md"
          >
            <Printer size={18} />
            <span>{viewMode === 'A4' ? 'Print A4' : 'Print Thermal'}</span>
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible flex justify-center items-start">
        {viewMode === 'A4' ? <StandardLayout /> : <ThermalLayout />}
      </div>
    </div>
  );
};

export default InvoiceView;
