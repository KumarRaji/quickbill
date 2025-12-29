import React, { useState, useRef, useEffect, useMemo } from "react";
import { Party, Item, InvoiceItem, Invoice, TransactionType } from "../types";
import { InvoiceService, ItemService } from "../services/api";
import { Plus, Trash2, Save, ArrowLeft, Printer, ScanBarcode, X } from "lucide-react";

interface InvoiceCreateProps {
  parties: Party[];
  items: Item[];
  editInvoice?: Invoice | null;
  onCancel: () => void;
  onSuccess: (invoice: Invoice, shouldPrint?: boolean) => void;
  initialType?: TransactionType;
  hideAddItemButton?: boolean;
}

const InvoiceCreate: React.FC<InvoiceCreateProps> = ({
  parties,
  items,
  editInvoice,
  onCancel,
  onSuccess,
  initialType = "SALE",
  hideAddItemButton = false,
}) => {
  const [transactionType, setTransactionType] = useState<TransactionType>(
    editInvoice?.type || initialType
  );

  const isPurchase = transactionType === "PURCHASE" || transactionType === "PURCHASE_RETURN";
  const isReturn = transactionType === "RETURN" || transactionType === "PURCHASE_RETURN";

  // ✅ allow empty input, parse safely
  const handleNumber = (val: string) => {
    if (val === "") return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  };

  // Set default party to Walkin-Customer if not editing
  const getDefaultPartyId = () => {
    if (editInvoice?.partyId) return editInvoice.partyId;
    const walkinCustomer = parties.find((p) => p.name === "Walkin-Customer");
    return walkinCustomer?.id || "";
  };

  const [selectedPartyId, setSelectedPartyId] = useState<string>(getDefaultPartyId());
  const [invoiceDate, setInvoiceDate] = useState(
    editInvoice?.date?.split("T")[0] || new Date().toISOString().split("T")[0]
  );

  const [invoiceNumber] = useState(
    editInvoice?.invoiceNumber ||
      `${
        initialType === "RETURN" || initialType === "PURCHASE_RETURN" ? "CN" : "TXN"
      }-${Date.now().toString().slice(-6)}`
  );

  const [originalRefNumber, setOriginalRefNumber] = useState(editInvoice?.originalRefNumber || "");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE" | "CHEQUE" | "CREDIT">(
    editInvoice?.paymentMode || "CASH"
  );

  const [taxMode, setTaxMode] = useState<"IN_TAX" | "OUT_TAX">(editInvoice?.taxMode || "IN_TAX"); // IN_TAX => price inclusive of GST, OUT_TAX => add GST on top
  const [gstType, setGstType] = useState<"IN_TAX" | "OUT_TAX">(editInvoice?.gstType || "IN_TAX");
  const [amountPaid, setAmountPaid] = useState<number>(Number(editInvoice?.amountPaid || 0));

  // Barcode Scanning State
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const [rows, setRows] = useState<InvoiceItem[]>(editInvoice?.items || []);
  const [loading, setLoading] = useState(false);

  // Add New Item Modal State
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
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editInvoice) {
      setTaxMode(editInvoice.taxMode || "OUT_TAX");
      setGstType(editInvoice.gstType || "IN_TAX");
      setAmountPaid(Number(editInvoice.amountPaid || 0));
    }
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
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const updateRow = (index: number, field: keyof InvoiceItem, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };

      if (field === "itemId") {
        const selectedItem = items.find((i) => i.id === value);
        if (selectedItem) {
          row.itemId = selectedItem.id;
          row.itemName = selectedItem.name;
          row.mrp = selectedItem.mrp || 0;
          row.price = isPurchase ? selectedItem.purchasePrice : selectedItem.sellingPrice;
          row.taxRate = selectedItem.taxRate;
        } else {
          row.itemId = "";
          row.itemName = "";
          row.mrp = 0;
          row.price = 0;
          row.taxRate = 0;
        }
      } else if (field === "price") {
        if (
          (transactionType === "SALE" || transactionType === "RETURN") &&
          row.mrp > 0 &&
          value > row.mrp
        ) {
          alert("Rate cannot be greater than MRP");
          return prev;
        }
        (row as any)[field] = value;
      } else {
        (row as any)[field] = value;
      }

      row.amount = Number(row.price || 0) * Number(row.quantity || 0);
      next[index] = row;
      return next;
    });
  };

  const handleInputChange = (value: string) => {
    setBarcodeInput(value);
    setSelectedSuggestionIndex(-1);

    if (value.trim().length > 0) {
      const filtered = items
        .filter(
          (i) =>
            i.name.toLowerCase().includes(value.toLowerCase()) ||
            (i.code && i.code.toLowerCase().includes(value.toLowerCase())) ||
            (i.barcode && i.barcode.includes(value))
        )
        .slice(0, 10);

      setFilteredItems(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setFilteredItems([]);
    }
  };

  const selectSuggestion = (item: Item) => {
    addItemToCart(item);
    setBarcodeInput("");
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    barcodeInputRef.current?.focus();
  };

  const addItemToCart = (item: Item) => {
    const price = isPurchase ? item.purchasePrice : item.sellingPrice;

    setRows((prev) => {
      const idx = prev.findIndex((r) => r.itemId === item.id);
      if (idx >= 0) {
        const next = [...prev];
        const row = { ...next[idx] };
        row.quantity = Number(row.quantity || 0) + 1;
        row.amount = Number(row.quantity) * Number(row.price || 0);
        next[idx] = row;
        return next;
      }

      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          quantity: 1,
          mrp: item.mrp || 0,
          price,
          taxRate: item.taxRate,
          amount: price,
        },
      ];
    });
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showSuggestions && filteredItems.length > 0) {
        setSelectedSuggestionIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showSuggestions && filteredItems.length > 0) {
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      }
    } else if (e.key === "Enter") {
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
          i.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (foundItem) {
        addItemToCart(foundItem);
        setBarcodeInput("");
        setShowSuggestions(false);
      } else {
        alert("Item not found: " + searchTerm);
        setBarcodeInput("");
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const qty = Number(row.quantity || 0);
        const rate = Number(row.price || 0);
        const taxRate = Number(row.taxRate || 0);

        const gross = rate * qty; // entered rate × qty
        const rateFraction = taxRate / 100;

        let taxable = gross;
        let taxAmount = 0;
        if (taxMode === "IN_TAX" && rateFraction > 0) {
          taxable = gross / (1 + rateFraction);
          taxAmount = gross - taxable; // peel out GST from inclusive price
        } else {
          taxAmount = taxable * rateFraction; // add GST on top
        }

        const lineTotal = taxMode === "IN_TAX" ? gross : taxable + taxAmount;
        const saving = Math.max(0, (Number(row.mrp || 0) - rate) * qty);

        acc.subtotal += taxable;
        acc.taxable += taxable;
        acc.tax += taxAmount;
        acc.total += lineTotal;
        acc.savings += saving;

        if (gstType === "IN_TAX") {
          acc.cgst += taxAmount / 2;
          acc.sgst += taxAmount / 2;
        } else {
          acc.igst += taxAmount;
        }

        return acc;
      },
      { subtotal: 0, taxable: 0, tax: 0, total: 0, savings: 0, cgst: 0, sgst: 0, igst: 0 }
    );
  }, [rows, gstType, taxMode]);

  // Round-off to nearest rupee for cleaner payable total
  const roundedTotal = Math.round(totals.total);
  const roundOffAmount = Number((roundedTotal - totals.total).toFixed(2));
  const payableTotal = Number((totals.total + roundOffAmount).toFixed(2));

  const computeDueStatus = (paid: number, total: number) => {
    if (total <= 0) return "PAID" as const;
    if (paid >= total) return "PAID" as const;
    if (paid > 0) return "PARTIAL" as const;
    return "PENDING" as const;
  };

  const normalizedAmountPaid = Number(amountPaid || 0);
  const remainingPayable = Math.max(0, payableTotal - normalizedAmountPaid);
  const dueStatus = computeDueStatus(normalizedAmountPaid, payableTotal);
  const dueBadgeClass =
    dueStatus === "PAID"
      ? "bg-green-100 text-green-700"
      : dueStatus === "PARTIAL"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!rows.some((r) => r.itemId)) return;

    // Sale requires customer (optional: allow walkin)
    if (!selectedPartyId && transactionType === "SALE") {
      alert("Please select a customer");
      return;
    }

    setLoading(true);
    const party = parties.find((p) => p.id === selectedPartyId);

    const invoiceDueStatus = dueStatus;
    const invoiceStatus: "PAID" | "UNPAID" | "PENDING" =
      invoiceDueStatus === "PAID" ? "PAID" : invoiceDueStatus === "PENDING" ? "PENDING" : "UNPAID";

    const invoiceData: any = {
      type: transactionType,
      invoiceNo: invoiceNumber,
      date: invoiceDate,
      partyId: selectedPartyId || "CASH",
      partyName: party?.name || "Cash Sale",
      originalRefNumber: isReturn && originalRefNumber ? originalRefNumber : undefined,
      items: rows.filter((r) => r.itemId),
      totalAmount: payableTotal,
      totalTax: totals.tax,
      status: invoiceStatus,
      amountPaid: normalizedAmountPaid,
      amountDue: remainingPayable,
      dueStatus: invoiceDueStatus,
      roundOff: roundOffAmount,
      taxMode,
      gstType,
      paymentMode,
      notes: "",
    };

    try {
      const resultInvoice = editInvoice
        ? await InvoiceService.update(editInvoice.id, invoiceData)
        : await InvoiceService.create(invoiceData);

      onSuccess(resultInvoice, shouldPrint);
    } catch (e) {
      console.error(e);
      alert("Error saving transaction");
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const prefix = editInvoice ? "Edit" : "New";
    switch (transactionType) {
      case "SALE":
        return `${prefix} Sale Invoice`;
      case "RETURN":
        return `${prefix} Sale Return / Credit Note`;
      case "PURCHASE":
        return `${prefix} Purchase Bill`;
      case "PURCHASE_RETURN":
        return `${prefix} Purchase Return / Debit Note`;
      default:
        return `${prefix} Transaction`;
    }
  };

  const getColor = () => {
    switch (transactionType) {
      case "SALE":
        return "blue";
      case "RETURN":
        return "red";
      case "PURCHASE":
        return "orange";
      case "PURCHASE_RETURN":
        return "red";
      default:
        return "blue";
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden max-w-full sm:max-w-5xl sm:mx-auto sm:rounded-xl sm:shadow-sm sm:border sm:border-slate-200">
      {/* Header */}
      <div className="p-3 sm:p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-wrap gap-2 sm:gap-0">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0" type="button">
            <ArrowLeft size={18} className="text-slate-600 sm:w-5 sm:h-5 w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{getTitle()}</h1>
            <div className="text-xs text-slate-500 mt-0.5 hidden sm:block">Sale Invoice Create</div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0 flex-wrap justify-end text-[11px] sm:text-sm">
          <select
            className="px-2 sm:px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as TransactionType)}
          >
            <optgroup label="Sales">
              <option value="SALE">Sale</option>
              <option value="RETURN">Return</option>
            </optgroup>
            <optgroup label="Purchases">
              <option value="PURCHASE">Purchase</option>
              <option value="PURCHASE_RETURN">Pur. Return</option>
            </optgroup>
          </select>
          <div className="text-slate-600 font-medium text-xs sm:text-base">#{invoiceNumber}</div>

          <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-xs ml-2 mt-2 sm:mt-0">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Tax Mode</span>
            <div className="flex items-center bg-slate-100 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setTaxMode("IN_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  taxMode === "IN_TAX" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-blue-700"
                }`}
              >
                Inclusive
              </button>
              <button
                type="button"
                onClick={() => setTaxMode("OUT_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  taxMode === "OUT_TAX" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-blue-700"
                }`}
              >
                Exclusive
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-xs ml-2 mt-2 sm:mt-0">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">GST Type</span>
            <div className="flex items-center bg-slate-100 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setGstType("IN_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  gstType === "IN_TAX" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-blue-700"
                }`}
              >
                CGST/SGST
              </button>
              <button
                type="button"
                onClick={() => setGstType("OUT_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  gstType === "OUT_TAX" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-blue-700"
                }`}
              >
                IGST
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Top Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
              {isPurchase ? "Supplier *" : "Customer *"}
            </label>
            <select
              required={transactionType === "SALE"}
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            >
              <option value="">{isPurchase ? "Select Supplier" : "Select Customer"}</option>
              {parties
                .filter((p) => isPurchase ? p.type === "SUPPLIER" : p.type === "CUSTOMER" || p.type === undefined)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
              {isReturn ? "Return / CN No." : "Invoice No."}
            </label>
            <input
              type="text"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 text-sm"
              value={invoiceNumber}
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Payment Mode</label>
            <select
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
            >
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online Payment</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          {isReturn && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Original Invoice No.</label>
              <input
                type="text"
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                value={originalRefNumber}
                onChange={(e) => setOriginalRefNumber(e.target.value)}
                placeholder="e.g. TXN-123"
              />
            </div>
          )}
        </div>

        {/* Barcode Scanner */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 space-y-3 sm:flex sm:items-center sm:space-y-0 sm:space-x-3">
          {!hideAddItemButton && (
            <button
              onClick={() => setShowItemModal(true)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center sm:justify-start space-x-2 transition-colors font-medium text-sm"
              type="button"
            >
              <Plus size={18} />
              <span>Add New Item</span>
            </button>
          )}

          <div className={`p-2 bg-${getColor()}-100 rounded-full text-${getColor()}-600 hidden sm:block flex-shrink-0`}>
            <ScanBarcode size={24} />
          </div>

          <div className="flex-1 relative min-w-0">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
              Scan Barcode / Item Name
            </label>
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode, type item name/code..."
              className="w-full bg-white border border-slate-300 rounded-md px-3 sm:px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={barcodeInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleBarcodeScan}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />

            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`px-3 sm:px-4 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 text-sm ${
                        index === selectedSuggestionIndex ? "bg-blue-100 text-blue-900" : "hover:bg-blue-50"
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
                        Stock: {item.stock} {item.unit} • Price: ₹{item.sellingPrice}
                        {item.code && ` • Code: ${item.code}`}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-center text-slate-500 text-sm">No items found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Items Table - Responsive */}
        <div>
          <div className="hidden sm:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-4/12">Item</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12 text-right pr-2">
                    {isReturn ? "Return Qty" : "Qty"}
                  </th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right pr-2">MRP</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-2/12 text-right pr-2">Rate</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12 text-right pr-2">Tax %</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12 text-right pr-2">Save</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b w-1/12 text-right pr-2">Amount</th>
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
                        value={row.quantity ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const value = handleNumber(e.target.value);
                          updateRow(index, "quantity", value ?? 0);
                        }}
                      />
                    </td>

                    <td className="py-3 px-2">
                      <input
                        type="number"
                        className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                        value={row.mrp ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const value = handleNumber(e.target.value);
                          updateRow(index, "mrp", value ?? 0);
                        }}
                        placeholder="MRP"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <input
                        type="number"
                        className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                        value={row.price ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const value = handleNumber(e.target.value);
                          updateRow(index, "price", value ?? 0);
                        }}
                      />
                    </td>

                    <td className="py-3 px-2">
                      <input
                        type="number"
                        className="w-full p-2 border border-slate-300 rounded text-right text-sm"
                        value={row.taxRate ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const value = handleNumber(e.target.value);
                          updateRow(index, "taxRate", value ?? 0);
                        }}
                        placeholder="GST %"
                      />
                    </td>

                    <td className="py-3 px-2 text-right text-slate-600">
                      {(() => {
                        const saving = Math.max(
                          0,
                          (Number(row.mrp || 0) - Number(row.price || 0)) * Number(row.quantity || 0)
                        );
                        return `₹${saving.toFixed(2)}`;
                      })()}
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
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-slate-500 font-semibold">Item</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
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
                  </div>
                  <button onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-5" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">{isReturn ? "Return Qty" : "Qty"}</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                      value={row.quantity ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const value = handleNumber(e.target.value);
                        updateRow(index, "quantity", value ?? 0);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">MRP</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                      value={row.mrp ?? ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const value = handleNumber(e.target.value);
                        updateRow(index, "mrp", value ?? 0);
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold">Rate</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                    value={row.price ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      updateRow(index, "price", value ?? 0);
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold">Tax Rate (%)</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                    value={row.taxRate ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      updateRow(index, "taxRate", value ?? 0);
                    }}
                  />
                </div>

                <div className="bg-slate-100 p-2 rounded text-right">
                  <span className="text-xs text-slate-500">Amount: </span>
                  <span className="font-semibold text-slate-800 text-sm">₹{Number(row.amount || 0).toFixed(2)}</span>
                </div>

                <div className="text-xs text-slate-600">
                  Saving: <span className="font-medium">₹{(() => {
                    const saving = Math.max(
                      0,
                      (Number(row.mrp || 0) - Number(row.price || 0)) * Number(row.quantity || 0)
                    );
                    return saving.toFixed(2);
                  })()}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            type="button"
            className="mt-3 sm:mt-4 w-full sm:w-auto flex items-center justify-center sm:justify-start space-x-2 text-blue-600 font-medium hover:text-blue-800 text-sm"
          >
            <Plus size={18} />
            <span>Add Row</span>
          </button>
        </div>

        {/* Totals, GST, and Payment Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 pt-4 sm:pt-6 border-t border-slate-100">
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Taxable Amount</span>
                <span>₹{totals.taxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-sm">
                <span>GST ({gstType === "IN_TAX" ? "CGST/SGST" : "IGST"})</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Entered Amount</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg sm:text-xl font-bold text-slate-800 border-t border-slate-300 pt-2 sm:pt-3">
                <span>Total</span>
                <span>₹{totals.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-sm border-t border-slate-200 pt-2">
                <span>Round Off</span>
                <span>
                  {roundOffAmount >= 0 ? "+" : "-"}₹{Math.abs(roundOffAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-lg sm:text-xl font-bold text-slate-800">
                <span>Payable Total</span>
                <span>₹{payableTotal.toFixed(2)}</span>
              </div>
              {totals.savings > 0 && (
                <div className="text-center mt-2">
                  <div className="inline-block bg-green-100 text-green-800 font-semibold px-3 py-1 rounded text-sm">
                    You Have Saved : ₹{totals.savings.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-sm h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Payment Summary</h3>
                <p className="text-[11px] text-slate-500">Use this to capture advance or on-the-spot payment.</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${dueBadgeClass}`}>
                {dueStatus}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Invoice Total (Rounded)</span>
                <span className="font-semibold text-slate-900">₹{payableTotal.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount Paid Now</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input
                    type="number"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={amountPaid ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      setAmountPaid(value ?? 0);
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-base sm:text-lg font-bold text-slate-800">
                <span>Remaining Payable</span>
                <span className="flex items-center gap-2">
                  ₹{remainingPayable.toFixed(2)}
                  <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${dueBadgeClass}`}>
                    {dueStatus}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-3 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div className="text-xs sm:text-sm text-slate-500 truncate">
          {rows.length} items • Type: <span className="font-semibold">{transactionType}</span>
        </div>

        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          <button
            onClick={onCancel}
            type="button"
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-100 text-sm"
          >
            Cancel
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={loading || !rows.some((r) => r.itemId)}
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Save size={18} />
            <span>Save</span>
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={loading || !rows.some((r) => r.itemId)}
            type="button"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                  await ItemService.create(itemFormData as Item);
                  alert("Item added successfully!");
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
                  window.location.reload();
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
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={itemFormData.name || ""}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Code</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.code || ""}
                    onChange={(e) => setItemFormData({ ...itemFormData, code: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.barcode || ""}
                    onChange={(e) => setItemFormData({ ...itemFormData, barcode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">MRP</label>
                  <input
                    type="number"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.mrp ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      setItemFormData({ ...itemFormData, mrp: value ?? 0 });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price *</label>
                  <input
                    required
                    type="number"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.sellingPrice ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      setItemFormData({ ...itemFormData, sellingPrice: value ?? 0 });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price *</label>
                  <input
                    required
                    type="number"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.purchasePrice ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      setItemFormData({ ...itemFormData, purchasePrice: value ?? 0 });
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock (Optional)</label>
                  <input
                    type="number"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.stock ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      setItemFormData({ ...itemFormData, stock: value ?? 0 });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.unit || "pcs"}
                    onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                  >
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilogram</option>
                    <option value="ltr">Liter</option>
                    <option value="box">Box</option>
                    <option value="mtr">Meter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={itemFormData.taxRate ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = handleNumber(e.target.value);
                      setItemFormData({ ...itemFormData, taxRate: value ?? 0 });
                    }}
                  />
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

export default InvoiceCreate;
