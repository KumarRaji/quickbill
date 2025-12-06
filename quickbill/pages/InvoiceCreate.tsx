

import React, { useState, useRef, useEffect } from 'react';
import { Party, Item, InvoiceItem, Invoice, TransactionType } from '../types';
import { InvoiceService } from '../services/api';
import { Plus, Trash2, Save, ArrowLeft, Printer, ScanBarcode } from 'lucide-react';

interface InvoiceCreateProps {
  parties: Party[];
  items: Item[];
  onCancel: () => void;
  onSuccess: (invoice: Invoice, shouldPrint?: boolean) => void;
  initialType?: TransactionType;
}

const InvoiceCreate: React.FC<InvoiceCreateProps> = ({ parties, items, onCancel, onSuccess, initialType = 'SALE' }) => {
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(`${initialType === 'RETURN' || initialType === 'PURCHASE_RETURN' ? 'CN' : 'TXN'}-${Date.now().toString().slice(-6)}`);
  const [originalRefNumber, setOriginalRefNumber] = useState('');
  
  // Barcode Scanning State
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  
  const [rows, setRows] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Focus barcode input on mount
  useEffect(() => {
    if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
    }
  }, []);

  // Helper for empty row
  const createEmptyRow = (): InvoiceItem => ({
    itemId: '',
    itemName: '',
    quantity: 1,
    price: 0,
    taxRate: 0,
    amount: 0
  });

  const addRow = () => {
    setRows([...rows, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const updateRow = (index: number, field: keyof InvoiceItem, value: any) => {
    const newRows = [...rows];
    const row = newRows[index];

    if (field === 'itemId') {
      const selectedItem = items.find(i => i.id === value);
      if (selectedItem) {
        row.itemId = selectedItem.id;
        row.itemName = selectedItem.name;
        // Use purchase price for purchases, selling price for sales
        // For Returns, we typically use the same price as the original transaction
        if (transactionType === 'PURCHASE' || transactionType === 'PURCHASE_RETURN') {
            row.price = selectedItem.purchasePrice;
        } else {
            row.price = selectedItem.sellingPrice;
        }
        row.taxRate = selectedItem.taxRate;
      }
    } else {
      (row as any)[field] = value;
    }

    // Recalculate amount
    row.amount = row.price * row.quantity;
    setRows(newRows);
  };

  // Logic to handle Barcode Scanning
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const scannedCode = barcodeInput.trim();
        if (!scannedCode) return;

        // Find item by barcode OR code
        const foundItem = items.find(i => 
            (i.barcode === scannedCode) || (i.code && i.code === scannedCode)
        );

        if (foundItem) {
            addItemToCart(foundItem);
            setBarcodeInput(''); // Clear input for next scan
        } else {
            alert('Item not found with barcode: ' + scannedCode);
            setBarcodeInput('');
        }
    }
  };

  // Add or Update item in list
  const addItemToCart = (item: Item) => {
    const existingRowIndex = rows.findIndex(r => r.itemId === item.id);
    const price = (transactionType === 'PURCHASE' || transactionType === 'PURCHASE_RETURN') 
                    ? item.purchasePrice 
                    : item.sellingPrice;

    if (existingRowIndex >= 0) {
        // Increment quantity
        const newRows = [...rows];
        newRows[existingRowIndex].quantity += 1;
        newRows[existingRowIndex].amount = newRows[existingRowIndex].quantity * newRows[existingRowIndex].price;
        setRows(newRows);
    } else {
        // Add new row
        setRows([...rows, {
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
            price: price,
            taxRate: item.taxRate,
            amount: price
        }]);
    }
  };

  const totals = rows.reduce((acc, row) => {
    const taxAmount = (row.amount * row.taxRate) / 100;
    return {
      subtotal: acc.subtotal + row.amount,
      tax: acc.tax + taxAmount,
      total: acc.total + row.amount + taxAmount
    };
  }, { subtotal: 0, tax: 0, total: 0 });

  const handleSave = async (shouldPrint: boolean = false) => {
    if (rows.length === 0) return;
    
    setLoading(true);
    const party = parties.find(p => p.id === selectedPartyId);
    
    const invoiceData: Omit<Invoice, 'id'> = {
      type: transactionType,
      invoiceNumber,
      date: invoiceDate,
      partyId: selectedPartyId || 'CASH', // Use placeholder if empty
      partyName: party?.name || 'Cash Sale', // Default to Cash Sale if no party selected
      originalRefNumber: (isReturn && originalRefNumber) ? originalRefNumber : undefined,
      items: rows.filter(r => r.itemId), // Remove empty rows
      totalAmount: totals.total,
      totalTax: totals.tax,
      status: selectedPartyId ? 'UNPAID' : 'PAID' // Default to PAID for cash sales (no party)
    };

    try {
      const newInvoice = await InvoiceService.create(invoiceData);
      onSuccess(newInvoice, shouldPrint);
    } catch (e) {
      console.error(e);
      alert('Error saving transaction');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (transactionType) {
      case 'SALE': return 'New Sale Invoice';
      case 'RETURN': return 'Sale Return / Credit Note';
      case 'PURCHASE': return 'New Purchase Bill';
      case 'PURCHASE_RETURN': return 'Purchase Return / Debit Note';
      default: return 'New Transaction';
    }
  };

  const getColor = () => {
    switch (transactionType) {
      case 'SALE': return 'blue';
      case 'RETURN': return 'red';
      case 'PURCHASE': return 'orange';
      case 'PURCHASE_RETURN': return 'red';
      default: return 'blue';
    }
  };

  const isPurchase = transactionType === 'PURCHASE' || transactionType === 'PURCHASE_RETURN';
  const isReturn = transactionType === 'RETURN' || transactionType === 'PURCHASE_RETURN';

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={`p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center`}>
        <div className="flex items-center space-x-3">
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">{getTitle()}</h1>
        </div>
        <div className="flex items-center space-x-4">
           <select 
             className="px-3 py-1 bg-white border border-slate-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500"
             value={transactionType}
             onChange={(e) => setTransactionType(e.target.value as TransactionType)}
           >
             <optgroup label="Sales">
                <option value="SALE">Sale Invoice</option>
                <option value="RETURN">Sale Return</option>
             </optgroup>
             <optgroup label="Purchases">
                <option value="PURCHASE">Purchase Bill</option>
                <option value="PURCHASE_RETURN">Purchase Return</option>
             </optgroup>
           </select>
           <div className="text-slate-500 font-medium">#{invoiceNumber}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        
        {/* Top Section: Party & Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-1">
              {isPurchase ? 'Supplier (Optional)' : 'Customer (Optional)'}
            </label>
            <select
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            >
              <option value="">Cash / Walk-in</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          
          <div className="md:col-span-1">
             <label className="block text-sm font-bold text-slate-700 mb-1">
               {isReturn ? 'Return / CN No.' : 'Invoice No.'}
             </label>
             <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                value={invoiceNumber}
                readOnly
             />
          </div>

          <div className="md:col-span-1">
             <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
             <input 
                type="date" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
             />
          </div>

          {/* Original Invoice Reference for Returns */}
          {isReturn && (
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-1">Original Invoice No.</label>
              <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={originalRefNumber}
                  onChange={e => setOriginalRefNumber(e.target.value)}
                  placeholder="e.g. TXN-123"
              />
            </div>
          )}
        </div>

        {/* Barcode Scanner Input */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center space-x-3">
            <div className={`p-2 bg-${getColor()}-100 rounded-full text-${getColor()}-600`}>
                <ScanBarcode size={24} />
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Scan Barcode / Quick Add</label>
                <input 
                    ref={barcodeInputRef}
                    type="text" 
                    placeholder="Scan barcode or type code and press Enter..." 
                    className="w-full bg-white border border-slate-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeScan}
                />
            </div>
        </div>

        {/* Items Table */}
        <div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-5/12">Item</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right">
                    {isReturn ? 'Return Qty' : 'Qty'}
                </th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right">Price</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right">Amount</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-3 pr-4">
                    <select
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                      value={row.itemId}
                      onChange={(e) => updateRow(index, 'itemId', e.target.value)}
                    >
                      <option value="">Select Item</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-2">
                    <input 
                      type="number" 
                      min="1"
                      className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="py-3 px-2">
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                      value={row.price}
                      onChange={(e) => updateRow(index, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-slate-700">
                    ₹{row.amount.toFixed(2)}
                  </td>
                  <td className="py-3 pl-2 text-right">
                    <button onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button 
            onClick={addRow}
            className={`mt-4 flex items-center space-x-2 text-${getColor()}-600 font-medium hover:text-${getColor()}-800`}
          >
            <Plus size={18} />
            <span>Add Row</span>
          </button>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end pt-6 border-t border-slate-100">
          <div className="w-64 space-y-3">
             <div className="flex justify-between text-slate-600">
               <span>Subtotal</span>
               <span>₹{totals.subtotal.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-slate-600">
               <span>Tax (Approx)</span>
               <span>₹{totals.tax.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-xl font-bold text-slate-800 border-t border-slate-300 pt-3">
               <span>Total</span>
               <span>₹{totals.total.toFixed(2)}</span>
             </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
         <div className="text-sm text-slate-500">
           {rows.length} items • Type: <span className="font-semibold">{transactionType}</span>
         </div>
         <div className="flex space-x-4">
           <button 
             onClick={onCancel}
             className="px-6 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-100"
           >
             Cancel
           </button>
           <button 
             onClick={() => handleSave(false)}
             disabled={loading || rows.length === 0}
             className={`px-6 py-2 bg-${getColor()}-600 text-white rounded-lg font-medium hover:bg-${getColor()}-700 shadow-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed`}
           >
             <Save size={18} />
             <span>Save</span>
           </button>
           <button 
             onClick={() => handleSave(true)}
             disabled={loading || rows.length === 0}
             className={`px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 shadow-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed`}
           >
             <Printer size={18} />
             <span>Save & Print</span>
           </button>
         </div>
      </div>
    </div>
  );
};

export default InvoiceCreate;