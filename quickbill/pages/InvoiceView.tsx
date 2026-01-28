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
  const isPurchase = invoice.type === 'PURCHASE';
  
  console.log('=== Invoice View Debug ===');
  console.log('Full Invoice Object:', JSON.stringify(invoice, null, 2));
  console.log('Invoice Number Field:', invoice.invoiceNumber);
  console.log('Invoice Keys:', Object.keys(invoice));

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
        return 'INVOICE';
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

    const roundOff = Number((invoice as any).roundOff || 0);
    const payableTotal = Number(invoice.totalAmount || 0);
    const grossBeforeRound = payableTotal - roundOff;

    const savings = items.reduce((acc: number, item: any) => {
      const mrp = Number(item.mrp || 0);
      const price = Number(item.price || item.rate || 0);
      const qty = Number(item.quantity || 0);
      const save = Math.max(0, (mrp - price) * qty);
      return acc + save;
    }, 0);

    const gstType = (invoice as any).gstType || 'IN_TAX';
    const taxMode = (invoice as any).taxMode || 'IN_TAX';

    const gstTotals = items.reduce(
      (acc, item: any) => {
        const qty = Number(item.quantity || 0);
        const rate = Number(item.price || item.rate || 0);
        const taxRate = Number(item.taxRate || 0);

        const gross = Number(item.amount ?? item.total ?? (rate * qty));
        const frac = taxRate / 100;

        let taxable = gross;
        let tax = 0;
        if (taxMode === 'IN_TAX' && frac > 0) {
          taxable = gross / (1 + frac);
          tax = gross - taxable;
        } else {
          tax = taxable * frac;
        }

        acc.taxable += taxable;
        acc.tax += tax;
        if (gstType === 'IN_TAX') {
          acc.cgst += tax / 2;
          acc.sgst += tax / 2;
        } else {
          acc.igst += tax;
        }
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
    );

    const totalTaxNum = Number((invoice as any).totalTax ?? gstTotals.tax);
    const subTotal = Math.max(0, grossBeforeRound - totalTaxNum);
    const paidAmount = Number((invoice as any).amountPaid ?? (invoice as any).paidAmount ?? 0);
    const balanceDue = Number((invoice as any).amountDue ?? (invoice as any).dueAmount ?? Math.max(0, payableTotal - paidAmount));
    const showGstBreakup = (gstTotals.tax || 0) > 0.0001;

    return (
      <div className="bg-white max-w-4xl mx-auto shadow-xl p-6 min-h-[1100px] print:shadow-none print:min-h-0 print:p-0">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4 mb-4">
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
            <h2 className="text-2xl font-bold mb-2 uppercase tracking-widest text-slate-700">
              {getDocTitle()}
            </h2>
            <div className="text-slate-600">
              <div className="mb-2 invoice-number">
                <span className="text-xs font-semibold text-slate-500">Invoice No:</span>
                <br />
                <span className="text-lg font-bold text-slate-800">
                  {invoice.invoiceNumber || (invoice as any).invoiceNo || invoice.id || 'N/A'}
                </span>
              </div>
              Date: {new Date(invoice.date).toLocaleDateString()}
              <br />
              <span className="text-sm">Time : {new Date().toLocaleTimeString('en-GB')}</span>
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
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-1">
            Customer Name: {parties.find(p => p.id === invoice.partyId)?.name || invoice.partyName || `Party #${invoice.partyId}`}
          </h2>
          <p className="text-slate-600 font-medium mt-2">Payment Mode: {invoice.paymentMode || 'CASH'}</p>
        </div>

        {/* Table */}
        <table className="w-full mb-4">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left rounded-l-lg text-sm font-medium">Item Description</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
              <th className="px-4 py-3 text-right text-sm font-medium">MRP</th>
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
                  ₹{formatMoney(item.mrp || 0)}
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

        {/* Totals + Payment Summary (Purchase only) */}
        <div className={`flex ${isPurchase ? 'justify-between items-start gap-6' : 'justify-end'} mb-6`}>
          {isPurchase && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 w-64">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Summary</span>
              <div className="mt-2 space-y-1">
                <div className="text-xs">Paid Amount: <span className="font-bold text-green-600">₹{formatMoney(paidAmount)}</span></div>
                <div className="text-xs">Balance Due: <span className="font-bold text-red-600">₹{formatMoney(balanceDue)}</span></div>
              </div>
            </div>
          )}

          <div className="w-64">
            <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
              <span>Subtotal</span>
              <span>₹{formatMoney(gstTotals.taxable)}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
              <span>Tax Total</span>
              <span>₹{formatMoney(gstTotals.tax)}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-600 border-b border-slate-100">
              <span>Round Off</span>
              <span>{roundOff >= 0 ? '+' : '-'}₹{formatMoney(Math.abs(roundOff))}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-lg font-bold text-slate-800 border-y-2 border-slate-400 mt-1">
              <span>Payable Total</span>
              <span>₹{formatMoney(payableTotal)}</span>
            </div>
          </div>
        </div>

        {/* Saved summary (centered above footer/terms) */}
        <div className="mt-4 mb-4 text-center">
          <div className="inline-block bg-green-100 text-green-800 font-semibold px-4 py-2 rounded text-lg">
            You Have Saved : ₹{formatMoney(savings)}
          </div>
        </div>

        <div className="border-t-2 border-slate-400 my-4" />

        {/* GST Breakdown */}
        {showGstBreakup && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-2">GST Breakup Details</h3>
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="px-3 py-2 text-left">Taxable Amount</th>
                  <th className="px-3 py-2 text-left">CGST</th>
                  <th className="px-3 py-2 text-left">SGST</th>
                  <th className="px-3 py-2 text-left">IGST</th>
                  <th className="px-3 py-2 text-left">Total Tax</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2">₹{formatMoney(gstTotals.taxable)}</td>
                  <td className="px-3 py-2">₹{formatMoney(gstTotals.cgst)}</td>
                  <td className="px-3 py-2">₹{formatMoney(gstTotals.sgst)}</td>
                  <td className="px-3 py-2">₹{formatMoney(gstTotals.igst)}</td>
                  <td className="px-3 py-2 font-semibold">₹{formatMoney(gstTotals.tax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Terms removed as requested */}

        <div className="mt-4 text-center text-sm text-slate-600 font-medium">
          Thank you ! Visit Again !!
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          Authorized Signatory
        </div>
        <div className="mt-1 text-center text-xs text-slate-400 font-bold">
          QuickBill - shopping !!
        </div>

      </div>
    );
  };

  const ThermalLayout: React.FC = () => {
    const items = invoice.items || [];

    const roundOff = Number((invoice as any).roundOff || 0);
    const payableTotal = Number(invoice.totalAmount || 0);
    const grossBeforeRound = payableTotal - roundOff;

    const savings = items.reduce((acc: number, item: any) => {
      const mrp = Number(item.mrp || 0);
      const price = Number(item.price || item.rate || 0);
      const qty = Number(item.quantity || 0);
      const save = Math.max(0, (mrp - price) * qty);
      return acc + save;
    }, 0);

    const gstType = (invoice as any).gstType || 'IN_TAX';
    const taxMode = (invoice as any).taxMode || 'IN_TAX';
    const gstTotals = items.reduce(
      (acc, item: any) => {
        const qty = Number(item.quantity || 0);
        const rate = Number(item.price || item.rate || 0);
        const taxRate = Number(item.taxRate || 0);

        const gross = Number(item.amount ?? item.total ?? (rate * qty));
        const frac = taxRate / 100;

        let taxable = gross;
        let tax = 0;
        if (taxMode === 'IN_TAX' && frac > 0) {
          taxable = gross / (1 + frac);
          tax = gross - taxable;
        } else {
          tax = taxable * frac;
        }

        acc.taxable += taxable;
        acc.tax += tax;
        if (gstType === 'IN_TAX') {
          acc.cgst += tax / 2;
          acc.sgst += tax / 2;
        } else {
          acc.igst += tax;
        }
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 }
    );

    const showGstBreakup = (gstTotals.tax || 0) > 0.0001;
    const paidAmount = Number((invoice as any).amountPaid ?? (invoice as any).paidAmount ?? 0);
    const balanceDue = Number((invoice as any).amountDue ?? (invoice as any).dueAmount ?? Math.max(0, payableTotal - paidAmount));

    return (
      <div className="bg-white mx-auto p-2 shadow-xl print:shadow-none w-[300px] thermal-print font-mono text-sm text-black leading-tight">
        <div className="text-center mb-2">
          <h2 className="text-lg font-bold uppercase">QuickBill</h2>
          <p className="text-xs">123 Business Hub, Tech City</p>
          <p className="text-xs">Ph: 9876543210</p>
          <p className="text-xs">GST: 24ABCDE1234F1Z5</p>
        </div>

        <div className="border-b-2 border-black my-2" />

        <div className="flex justify-between text-xs mb-1">
          <span>Type:</span>
          <span className="font-bold">{getDocTitle()}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span>No:</span>
          <span>{invoice.invoiceNumber || (invoice as any).invoiceNo || 'N/A'}</span>
        </div>
        {(invoice as any).originalRefNumber && (
          <div className="flex justify-between text-xs mb-1">
            <span>Ref:</span>
            <span>{(invoice as any).originalRefNumber}</span>
          </div>
        )}
        <div className="text-xs mb-2">
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(invoice.date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Time :</span>
            <span>{new Date().toLocaleTimeString('en-GB')}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        <div className="mb-2">
          <span className="text-xs font-bold">Customer Name: </span>
          <span className="text-xs">
            {parties.find(p => p.id === invoice.partyId)?.name || (invoice as any).partyName || `#${invoice.partyId}`}
          </span>
        </div>
        <div className="mb-2">
          <span className="text-xs font-bold">Payment: </span>
          <span className="text-xs">{invoice.paymentMode || 'CASH'}</span>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        {/* Items Header */}
        <div className="flex font-bold text-xs mb-1">
          <div className="w-1/3">Item</div>
          <div className="w-1/6 text-center">Qty</div>
          <div className="w-1/6 text-center">MRP</div>
          <div className="w-1/6 text-center">Rate</div>
          <div className="w-1/6 text-right">Amt</div>
        </div>

        {/* Items List */}
        <div className="mb-2">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="mb-1">
              <div className="flex text-xs">
                <div className="w-1/3 truncate">
                  {item.itemName || item.name}
                </div>
                <div className="w-1/6 text-center">
                  {item.quantity}
                </div>
                <div className="w-1/6 text-center text-slate-600">
                  ₹{formatMoney(item.mrp || 0)}
                </div>
                <div className="w-1/6 text-center text-slate-600">
                  ₹{formatMoney(item.price)}
                </div>
                <div className="w-1/6 text-right text-black">
                  ₹{formatMoney(item.amount ?? item.total)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-dashed border-black my-2" />

        {isPurchase && (
          <div className="mb-2 bg-slate-50 p-2 rounded border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Summary</div>
            <div className="mt-1 text-[11px] space-y-1">
              <div>Paid Amount: <span className="font-bold text-green-600">₹{formatMoney(paidAmount)}</span></div>
              <div>Balance Due: <span className="font-bold text-red-600">₹{formatMoney(balanceDue)}</span></div>
            </div>
          </div>
        )}

        <div className="flex justify-between text-xs mb-1">
          <span>Subtotal</span>
          <span>₹{formatMoney(gstTotals.taxable)}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span>Tax Total</span>
          <span>₹{formatMoney(gstTotals.tax)}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span>Round Off</span>
          <span>{roundOff >= 0 ? '+' : '-'}₹{formatMoney(Math.abs(roundOff))}</span>
        </div>
        <div className="flex justify-between items-center font-bold text-sm mb-2 border-y-2 border-black py-1">
          <span>Payable</span>
          <span>₹{formatMoney(payableTotal)}</span>
        </div>
        <div className="text-center mt-2 mb-2">
          <div className="inline-block bg-green-100 text-green-800 font-semibold px-3 py-1 rounded">
            You Have Saved : ₹{formatMoney(savings)}
          </div>
        </div>

        <div className="border-b border-dashed border-black my-2" />

        {showGstBreakup && (
          <div className="mb-3">
            <div className="text-xs font-bold mb-1">GST Breakup Details</div>
            <div className="grid grid-cols-5 gap-1 text-[11px] leading-tight">
              <div className="font-semibold">Taxable Amount</div>
              <div className="font-semibold">CGST</div>
              <div className="font-semibold">SGST</div>
              <div className="font-semibold">IGST</div>
              <div className="font-semibold">Total Tax</div>
              <div>₹{formatMoney(gstTotals.taxable)}</div>
              <div>₹{formatMoney(gstTotals.cgst)}</div>
              <div>₹{formatMoney(gstTotals.sgst)}</div>
              <div>₹{formatMoney(gstTotals.igst)}</div>
              <div className="font-semibold">₹{formatMoney(gstTotals.tax)}</div>
            </div>
          </div>
        )}

        <div className="border-b border-dashed border-black my-2" />

        <div className="mt-4 text-center text-sm text-slate-600 font-medium">
          Thank you ! Visit Again !!
        </div>

        <div className="text-center text-xs mt-2">
           Welcome Again !!
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @media print {
          .invoice-number {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          body {
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
          }
          .thermal-print {
            width: 80mm !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
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
    </>
  );
};

export default InvoiceView;
