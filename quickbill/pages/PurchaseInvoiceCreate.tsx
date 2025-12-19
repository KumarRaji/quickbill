import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Printer, Save, ScanBarcode, Trash2, X } from "lucide-react";
import { Item, Invoice, InvoiceItem } from "../types";
import { InvoiceService, ItemService, SupplierService, Supplier } from "../services/api";

export interface PurchaseInvoiceCreateProps {
  items: Item[];
  editInvoice?: Invoice | null;
  hideAddItemButton?: boolean;
  onCancel: () => void;
  onSuccess: (invoice: Invoice, shouldPrint: boolean) => void;
  onItemsRefresh?: () => void;
}

const makePurchaseBillNo = () => `PUR-${Date.now().toString().slice(-6)}`;

const PurchaseInvoiceCreate: React.FC<PurchaseInvoiceCreateProps> = ({
  items,
  editInvoice = null,
  hideAddItemButton = false,
  onCancel,
  onSuccess,
  onItemsRefresh,
}) => {
  const transactionType = "PURCHASE" as const;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(makePurchaseBillNo());
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE" | "CHEQUE" | "CREDIT">("CASH");

  // barcode / suggestions
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const [rows, setRows] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  // add item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemFormData, setItemFormData] = useState<Partial<Item>>({
    name: "",
    code: "",
    barcode: "",
    sellingPrice: 0,
    purchasePrice: 0,
    mrp: 0,
    stock: 0,
    unit: "pcs",
    taxRate: 0,
  });

  useEffect(() => {
    SupplierService.getAll().then(setSuppliers).catch(console.error);
  }, []);

  // ✅ Prefill when editing
  useEffect(() => {
    if (!editInvoice) {
      barcodeInputRef.current?.focus();
      return;
    }

    setSelectedPartyId(editInvoice.partyId ?? "");
    setInvoiceDate(
      editInvoice.date ? new Date(editInvoice.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    );
    setInvoiceNumber(editInvoice.invoiceNumber || makePurchaseBillNo());

    setPaymentMode((editInvoice.paymentMode as any) || "CASH");

    const editRows: InvoiceItem[] = (editInvoice.items ?? []).map((it) => ({
      itemId: String(it.itemId ?? ""),
      itemName: it.itemName ?? "",
      quantity: Number(it.quantity ?? 1),
      mrp: Number(it.mrp ?? 0),
      price: Number(it.price ?? 0),
      taxRate: Number(it.taxRate ?? 0),
      amount: Number(it.amount ?? 0),
    }));

    setRows(editRows.map((r) => ({ ...r, amount: Number(r.price || 0) * Number(r.quantity || 0) })));
  }, [editInvoice]);

  const createEmptyRow = (): InvoiceItem => ({
    itemId: "",
    itemName: "",
    quantity: 1,
    mrp: 0,
    price: 0,
    taxRate: 0,
    amount: 0,
  });

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const recalcRow = (row: InvoiceItem) => {
    row.amount = Number(row.price || 0) * Number(row.quantity || 0);
    return row;
  };

  const updateRow = (index: number, field: keyof InvoiceItem, value: any) => {
    setRows((prev) => {
      const newRows = [...prev];
      const row = { ...newRows[index] } as InvoiceItem;

      if (field === "itemId") {
        const selectedItem = items.find((i) => i.id === value);
        if (selectedItem) {
          row.itemId = selectedItem.id;
          row.itemName = selectedItem.name;
          row.mrp = selectedItem.mrp || 0;
          row.price = Number(selectedItem.purchasePrice || 0);
          row.taxRate = Number(selectedItem.taxRate || 0);
        } else {
          row.itemId = value;
        }
      } else {
        (row as any)[field] = value;
      }

      newRows[index] = recalcRow(row);
      return newRows;
    });
  };

  const handleInputChange = (value: string) => {
    setBarcodeInput(value);
    setSelectedSuggestionIndex(-1);

    const v = value.trim();
    if (!v) {
      setShowSuggestions(false);
      setFilteredItems([]);
      return;
    }

    const filtered = items
      .filter((i) => {
        const name = (i.name ?? "").toLowerCase();
        const code = (i.code ?? "").toLowerCase();
        const bar = (i.barcode ?? "").toString();
        const q = v.toLowerCase();
        return name.includes(q) || code.includes(q) || bar.includes(v);
      })
      .slice(0, 5);

    setFilteredItems(filtered);
    setShowSuggestions(true);
  };

  const addItemToCart = (item: Item) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.itemId === item.id);
      const price = Number(item.purchasePrice || 0);

      if (idx >= 0) {
        const copy = [...prev];
        const row = { ...copy[idx] };
        row.quantity = Number(row.quantity || 0) + 1;
        row.price = Number(row.price || price);
        copy[idx] = recalcRow(row);
        return copy;
      }

      const newRow: InvoiceItem = recalcRow({
        itemId: item.id,
        itemName: item.name,
        quantity: 1,
        mrp: item.mrp || 0,
        price,
        taxRate: Number(item.taxRate || 0),
        amount: 0,
      });

      return [...prev, newRow];
    });
  };

  const selectSuggestion = (item: Item) => {
    addItemToCart(item);
    setBarcodeInput("");
    setShowSuggestions(false);
    setFilteredItems([]);
    setSelectedSuggestionIndex(-1);
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showSuggestions && filteredItems.length) {
        setSelectedSuggestionIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showSuggestions && filteredItems.length) {
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      }
      return;
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setBarcodeInput("");
      return;
    }

    if (e.key !== "Enter") return;

    e.preventDefault();

    if (showSuggestions && selectedSuggestionIndex >= 0 && filteredItems[selectedSuggestionIndex]) {
      selectSuggestion(filteredItems[selectedSuggestionIndex]);
      return;
    }

    const searchTerm = barcodeInput.trim();
    if (!searchTerm) return;

    const foundItem = items.find(
      (i) =>
        i.barcode === searchTerm ||
        (i.code && i.code === searchTerm) ||
        (i.name ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (foundItem) {
      addItemToCart(foundItem);
      setBarcodeInput("");
      setShowSuggestions(false);
      setFilteredItems([]);
    } else {
      alert("Item not found: " + searchTerm);
      setBarcodeInput("");
      setShowSuggestions(false);
      setFilteredItems([]);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount || 0);
        const taxRate = Number(row.taxRate || 0);
        const taxAmount = (amount * taxRate) / 100;

        return {
          subtotal: acc.subtotal + amount,
          tax: acc.tax + taxAmount,
          total: acc.total + amount + taxAmount,
        };
      },
      { subtotal: 0, tax: 0, total: 0 }
    );
  }, [rows]);

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!rows.some((r) => r.itemId)) return;
    if (!selectedPartyId) {
      alert('Please select a supplier');
      return;
    }

    setLoading(true);
    const supplier = suppliers.find((s) => String(s.id) === selectedPartyId);

    const payload: any = {
      type: transactionType,
      invoiceNo: invoiceNumber,
      invoiceNumber: invoiceNumber,
      date: invoiceDate,
      partyId: selectedPartyId || "CASH",
      partyName: supplier?.name || "Cash Purchase",
      items: rows.filter((r) => r.itemId),
      totalAmount: totals.total,
      totalTax: totals.tax,
      status: selectedPartyId ? "UNPAID" : "PAID",
      paymentMode,
      notes: "",
    };

    try {
      console.log('Saving purchase bill with payload:', payload);
      const saved = editInvoice?.id
        ? await InvoiceService.update(editInvoice.id, payload)
        : await InvoiceService.create(payload);

      onSuccess(saved, shouldPrint);
    } catch (e: any) {
      console.error('Purchase bill save error:', e);
      alert(`Error saving purchase bill: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors" type="button">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {editInvoice ? "Edit Purchase Bill" : "New Purchase Bill"}
            </h1>
            <div className="text-xs text-slate-500 mt-0.5">Purchase Invoice Create</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => setInvoiceNumber(makePurchaseBillNo())}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-100"
          >
            Regenerate
          </button>
          <div className="text-slate-600 font-medium">#{invoiceNumber}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Party & Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Supplier *</label>
            <select
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Bill No.</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Payment Mode</label>
            <select
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
            >
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online Payment</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
        </div>

        {/* Barcode + Add Item */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center space-x-3">
          {!hideAddItemButton && (
            <button
              onClick={() => setShowItemModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors font-medium"
              type="button"
            >
              <Plus size={18} />
              <span>Add New Item</span>
            </button>
          )}

          <div className="p-2 bg-orange-100 rounded-full text-orange-600">
            <ScanBarcode size={24} />
          </div>

          <div className="flex-1 relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
              Scan Barcode / Item Name
            </label>

            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode, type item name/code..."
              className="w-full bg-white border border-slate-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
              value={barcodeInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleBarcodeScan}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />

            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {filteredItems.length > 0 ? filteredItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`px-4 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 ${index === selectedSuggestionIndex ? "bg-orange-100 text-orange-900" : "hover:bg-orange-50"
                      }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(item);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      Stock: {item.stock} {item.unit} • Purchase: ₹{Number(item.purchasePrice ?? 0)}
                      {item.code ? ` • Code: ${item.code}` : ""}
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-3 text-center text-slate-500 text-sm">
                    No items found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-4/12">Item</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12 text-right">Qty</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right">MRP</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right">Purchase Rate</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right">Amount</th>
                <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12" />
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-3 pr-4">
                    <select
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                      value={row.itemId}
                      onChange={(e) => updateRow(index, "itemId", e.target.value)}
                    >
                      <option value="">Select Item</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Stock: {i.stock})
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-3 px-2">
                    <input
                      type="number"
                      min="1"
                      className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </td>

                  <td className="py-3 px-2">
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                      value={row.mrp || ""}
                      onChange={(e) => updateRow(index, "mrp", parseFloat(e.target.value) || 0)}
                      placeholder="MRP"
                    />
                  </td>

                  <td className="py-3 px-2">
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                      value={row.price}
                      onChange={(e) => updateRow(index, "price", parseFloat(e.target.value) || 0)}
                    />
                  </td>

                  <td className="py-3 px-2 text-right font-medium text-slate-700">
                    ₹{Number(row.amount || 0).toFixed(2)}
                  </td>

                  <td className="py-3 pl-2 text-right">
                    <button onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600" type="button">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addRow}
            type="button"
            className="mt-4 flex items-center space-x-2 text-orange-600 font-medium hover:text-orange-800"
          >
            <Plus size={18} />
            <span>Add Row</span>
          </button>
        </div>

        {/* Totals */}
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

      {/* Footer actions */}
      <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <div className="text-sm text-slate-500">
          {rows.length} items • Type: <span className="font-semibold">PURCHASE</span>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={onCancel}
            type="button"
            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={loading || !rows.some((r) => r.itemId)}
            type="button"
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 shadow-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            <span>Save</span>
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={loading || !rows.some((r) => r.itemId)}
            type="button"
            className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 shadow-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} />
            <span>Save & Print</span>
          </button>
        </div>
      </div>

      {/* Add New Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Add New Item</h2>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600" type="button">
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                  const newItem = await ItemService.create(itemFormData as Item);
                  setShowItemModal(false);
                  setItemFormData({
                    name: "",
                    code: "",
                    barcode: "",
                    sellingPrice: 0,
                    purchasePrice: 0,
                    mrp: 0,
                    stock: 0,
                    unit: "pcs",
                    taxRate: 0,
                  });
                  if (onItemsRefresh) {
                    await onItemsRefresh();
                  }
                  addItemToCart(newItem);
                } catch (error) {
                  console.error(error);
                  alert("Error adding item");
                } finally {
                  setLoading(false);
                }
              }}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.name} onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Code</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.code} onChange={(e) => setItemFormData({ ...itemFormData, code: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Barcode</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.barcode} onChange={(e) => setItemFormData({ ...itemFormData, barcode: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MRP</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.mrp} onChange={(e) => setItemFormData({ ...itemFormData, mrp: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price *</label>
                  <input required type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.purchasePrice} onChange={(e) => setItemFormData({ ...itemFormData, purchasePrice: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price *</label>
                  <input required type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.sellingPrice} onChange={(e) => setItemFormData({ ...itemFormData, sellingPrice: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.stock} onChange={(e) => setItemFormData({ ...itemFormData, stock: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white" value={itemFormData.unit} onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}>
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilogram</option>
                    <option value="ltr">Liter</option>
                    <option value="box">Box</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={itemFormData.taxRate} onChange={(e) => setItemFormData({ ...itemFormData, taxRate: Number(e.target.value) })} />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseInvoiceCreate;
