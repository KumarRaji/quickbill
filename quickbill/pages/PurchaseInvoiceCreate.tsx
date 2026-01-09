import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Barcode, Plus, Printer, Save, ScanBarcode, Sparkles, Trash2, X } from "lucide-react";
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

type PurchaseRow = InvoiceItem & {
  manualMode?: boolean;
  category?: string;
  code?: string;
  barcode?: string;
};

const PurchaseInvoiceCreate: React.FC<PurchaseInvoiceCreateProps> = ({
  items,
  editInvoice = null,
  hideAddItemButton = false,
  onCancel,
  onSuccess,
  onItemsRefresh,
}) => {
  const transactionType = "PURCHASE" as const;

  // Try to infer home state: prefer COMPANY_GSTIN prefix, fallback to explicit env, then default 33 (TN)
  const ENV_HOME_STATE_CODE = (import.meta.env.VITE_HOME_STATE_CODE || "").trim();
  const COMPANY_GSTIN = (import.meta.env.VITE_COMPANY_GSTIN || "").trim();
  const inferredHomeStateFromGSTIN = COMPANY_GSTIN.match(/^\d{2}/)?.[0];
  const HOME_STATE_CODE = inferredHomeStateFromGSTIN || ENV_HOME_STATE_CODE || "33";

  const stateHints: Record<string, string[]> = {
    "01": ["jammu", "kashmir", "ladakh"],
    "02": ["himachal"],
    "03": ["punjab"],
    "04": ["chandigarh"],
    "06": ["haryana"],
    "07": ["delhi"],
    "08": ["rajasthan"],
    "09": ["uttar pradesh", "uttar pradesh"],
    "10": ["bihar"],
    "18": ["assam"],
    "19": ["west bengal"],
    "20": ["jharkhand"],
    "21": ["odisha", "orissa"],
    "22": ["chhattisgarh"],
    "23": ["madhya pradesh"],
    "24": ["gujarat", "gj"],
    "27": ["maharashtra", "mh"],
    "29": ["karnataka"],
    "32": ["kerala"],
    "33": ["tamil nadu"],
    "36": ["telangana"],
    "37": ["andhra pradesh"],
  };

  const detectStateCode = (supplier?: Supplier | null): string | null => {
    if (!supplier) return null;

    const gstin = (supplier.gstin || "").trim();
    if (gstin.length >= 2) {
      const maybeCode = gstin.slice(0, 2);
      if (/^\d{2}$/.test(maybeCode)) return maybeCode;
    }

    const addr = (supplier.address || "").toLowerCase();
    if (addr) {
      for (const [code, hints] of Object.entries(stateHints)) {
        if (hints.some((h) => addr.includes(h))) return code;
      }
    }
    return null;
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => editInvoice?.invoiceNumber || "");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE" | "CHEQUE" | "CREDIT">("CASH");
  const [taxMode, setTaxMode] = useState<"IN_TAX" | "OUT_TAX">(editInvoice?.taxMode || "IN_TAX"); // IN_TAX => price inclusive of GST, OUT_TAX => add GST on top
  const [gstType, setGstType] = useState<"IN_TAX" | "OUT_TAX">(editInvoice?.gstType || "IN_TAX");
  const [amountPaid, setAmountPaid] = useState<number>(Number(editInvoice?.amountPaid || 0));

  const applySupplierGstType = (supplierId: string) => {
    const sup = suppliers.find((s) => String(s.id) === String(supplierId));
    if (!sup) return;
    const code = detectStateCode(sup);
    if (!code) return;
    setGstType(code === HOME_STATE_CODE ? "IN_TAX" : "OUT_TAX");
  };

  // barcode / suggestions
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleNumber = (val: string) => {
    if (val === "") return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  };

  // add item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemFormData, setItemFormData] = useState<Partial<Item>>({
    name: "",
    category: "",
    code: "",
    barcode: "",
    sellingPrice: 0,
    purchasePrice: 0,
    mrp: 0,
    stock: 0,
    unit: "pcs",
    taxRate: 0,
  });

  // Generate random barcode (EAN-13 format)
  const generateRandomBarcode = () => Math.floor(Math.random() * 1000000000000).toString().padStart(12, "0");

  const handleGenerateItemBarcode = () => {
    setItemFormData({ ...itemFormData, barcode: generateRandomBarcode() });
  };

  const handleGenerateRowBarcode = (index: number) => {
    setRows((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      copy[index] = { ...copy[index], barcode: generateRandomBarcode() };
      return copy.map(recalcRow);
    });
  };

  useEffect(() => {
    SupplierService.getAll().then(setSuppliers).catch(console.error);
  }, []);

  // Auto-set GST type based on supplier address/GSTIN vs home state when creating new bills
  useEffect(() => {
    if (!selectedPartyId || editInvoice) return;
    applySupplierGstType(selectedPartyId);
  }, [selectedPartyId, suppliers]);

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
    setInvoiceNumber(editInvoice.invoiceNumber || "");

    setPaymentMode((editInvoice.paymentMode as any) || "CASH");
    setTaxMode(editInvoice.taxMode || "OUT_TAX");
    setGstType(editInvoice.gstType || "IN_TAX");
    setAmountPaid(Number(editInvoice.amountPaid || 0));

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

  const createEmptyRow = (): PurchaseRow => ({
    itemId: "",
    itemName: "",
    quantity: 1,
    mrp: 0,
    price: 0,
    taxRate: 0,
    amount: 0,
    category: "",
    code: "",
    barcode: "",
  });

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const recalcRow = (row: PurchaseRow) => {
    row.amount = Number(row.price || 0) * Number(row.quantity || 0);
    return row;
  };

  const setManualMode = (index: number, enabled: boolean) => {
    setRows((prev) => {
      const newRows = [...prev];
      const row = { ...newRows[index] } as PurchaseRow;
      row.manualMode = enabled;
      if (enabled) {
        row.itemId = "";
        row.itemName = row.itemName || "";
        row.category = row.category || "";
        row.code = row.code || "";
        row.barcode = row.barcode || "";
      } else {
        // Reset manual entry when leaving manual mode
        row.itemName = "";
        row.mrp = 0;
        row.price = 0;
        row.taxRate = 0;
        row.amount = 0;
        row.category = "";
        row.code = "";
        row.barcode = "";
      }
      newRows[index] = row;
      return newRows;
    });
  };

  const updateRow = (index: number, field: keyof PurchaseRow, value: any) => {
    setRows((prev) => {
      const newRows = [...prev];
      const row = { ...newRows[index] } as PurchaseRow;

      if (field === "itemId") {
        const selectedItem = items.find((i) => i.id === value);
        if (selectedItem) {
          row.itemId = selectedItem.id;
          row.itemName = selectedItem.name;
          row.mrp = selectedItem.mrp || 0;
          row.price = Number(selectedItem.purchasePrice || 0);
          row.taxRate = Number(selectedItem.taxRate || 0);
          row.category = selectedItem.category || "";
          row.code = selectedItem.code || "";
          row.barcode = selectedItem.barcode || "";
          row.manualMode = false;
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

      const newRow: PurchaseRow = recalcRow({
        itemId: item.id,
        itemName: item.name,
        quantity: 1,
        mrp: item.mrp || 0,
        price,
        taxRate: Number(item.taxRate || 0),
        amount: 0,
        manualMode: false,
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
        const qty = Number(row.quantity || 0);
        const rate = Number(row.price || 0);
        const taxRate = Number(row.taxRate || 0);

        const gross = rate * qty;
        const rateFraction = taxRate / 100;

        let taxable = gross;
        let taxAmount = 0;
        if (taxMode === "IN_TAX" && rateFraction > 0) {
          taxable = gross / (1 + rateFraction);
          taxAmount = gross - taxable; // peel out GST from inclusive rate
        } else {
          taxAmount = taxable * rateFraction; // add GST on top
        }

        const lineTotal = taxMode === "IN_TAX" ? gross : taxable + taxAmount;

        acc.subtotal += taxable;
        acc.taxable += taxable;
        acc.tax += taxAmount;
        acc.total += lineTotal;

        if (gstType === "IN_TAX") {
          acc.cgst += taxAmount / 2;
          acc.sgst += taxAmount / 2;
        } else {
          acc.igst += taxAmount;
        }

        return acc;
      },
      { subtotal: 0, taxable: 0, tax: 0, total: 0, cgst: 0, sgst: 0, igst: 0 }
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

  const effectiveAmountPaid = Number(amountPaid || 0);
  const remainingPayable = Math.max(0, payableTotal - effectiveAmountPaid);
  const dueStatus = computeDueStatus(effectiveAmountPaid, payableTotal);
  const dueBadgeClass =
    dueStatus === "PAID"
      ? "bg-green-100 text-green-700"
      : dueStatus === "PARTIAL"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  const billNumberDisplay = invoiceNumber.trim() ? `#${invoiceNumber.trim()}` : "Enter Bill No.";

  const columnWidths = {
    item: "20%",
    category: "12%",
    code: "12%",
    barcode: "10%",
    qty: "10%",
    mrp: "10%",
    price: "10%",
    tax: "5%",
    amount: "8%",
    actions: "4%",
  };

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!rows.some((r) => r.itemId || (r.manualMode && r.itemName?.trim()))) return;
    if (!selectedPartyId) {
      alert('Please select a supplier');
      return;
    }
    const cleanedInvoiceNumber = invoiceNumber.trim();
    if (!cleanedInvoiceNumber) {
      alert('Please enter the Bill No.');
      return;
    }

    setLoading(true);
    const supplier = suppliers.find((s) => String(s.id) === selectedPartyId);

    // Ensure manual rows have a persisted itemId by creating items on the fly
    const rowsWithItems: PurchaseRow[] = [...rows];
    for (let i = 0; i < rowsWithItems.length; i++) {
      const r = rowsWithItems[i];
      if (r.manualMode && r.itemName?.trim() && !r.itemId) {
        const newItemPayload: Partial<Item> = {
          name: r.itemName.trim(),
          category: r.category?.trim() || undefined,
              code: r.code?.trim() || undefined,
              barcode: r.barcode?.trim() || undefined,
          sellingPrice: Number(r.price || 0),
          purchasePrice: Number(r.price || 0),
          mrp: Number(r.mrp || 0),
          stock: Number(r.quantity || 0),
          unit: 'pcs',
          taxRate: Number(r.taxRate || 0),
        };
        const created = await ItemService.create(newItemPayload as Item);
        r.itemId = created.id;
        r.itemName = created.name;
        r.manualMode = false;
        // Normalize price/tax from created item if available
        r.price = Number(created.purchasePrice || r.price || 0);
        r.taxRate = Number(created.taxRate || r.taxRate || 0);
        rowsWithItems[i] = recalcRow(r);
      }
    }
    // Update UI state with any newly created items
    setRows(rowsWithItems);

    const invoiceDueStatus = dueStatus;
    const invoiceStatus: "PAID" | "UNPAID" | "PENDING" =
      invoiceDueStatus === "PAID" ? "PAID" : invoiceDueStatus === "PENDING" ? "PENDING" : "UNPAID";

    const payload: any = {
      type: transactionType,
      invoiceNo: cleanedInvoiceNumber,
      invoiceNumber: cleanedInvoiceNumber,
      date: invoiceDate,
      partyId: selectedPartyId || "CASH",
      partyName: supplier?.name || "Cash Purchase",
      items: rowsWithItems.filter((r) => r.itemId),
      totalAmount: payableTotal,
      totalTax: totals.tax,
      status: invoiceStatus,
      amountPaid: effectiveAmountPaid,
      amountDue: remainingPayable,
      dueStatus: invoiceDueStatus,
      roundOff: roundOffAmount,
      taxMode,
      gstType,
      paymentMode,
      notes: "",
    };

    try {
      console.log('Saving purchase bill with payload:', payload);
      const savedRaw = editInvoice?.id
        ? await InvoiceService.update(editInvoice.id, payload)
        : await InvoiceService.create(payload);

      const saved: Invoice = {
        ...savedRaw,
        amountPaid: effectiveAmountPaid,
        amountDue: remainingPayable,
        dueStatus: invoiceDueStatus,
      };

      onSuccess(saved, shouldPrint);
    } catch (e: any) {
      console.error('Purchase bill save error:', e);
      alert(`Error saving purchase bill: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
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
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">
              {editInvoice ? "Edit Purchase Bill" : "New Purchase Bill"}
            </h1>
            <div className="text-xs text-slate-500 mt-0.5 hidden sm:block">Purchase Invoice Create</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto text-[11px] sm:text-sm">
          <button
            type="button"
            onClick={() => setInvoiceNumber(makePurchaseBillNo())}
            className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 whitespace-nowrap"
          >
            Regenerate
          </button>
          <div className="text-slate-600 font-medium text-xs sm:text-base">{billNumberDisplay}</div>

          <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-xs sm:ml-2 sm:mt-0 w-full sm:w-auto">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Tax Mode</span>
            <div className="flex items-center bg-slate-100 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setTaxMode("IN_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  taxMode === "IN_TAX" ? "bg-orange-600 text-white" : "text-slate-600 hover:text-orange-700"
                }`}
              >
                Inclusive
              </button>
              <button
                type="button"
                onClick={() => setTaxMode("OUT_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  taxMode === "OUT_TAX" ? "bg-orange-600 text-white" : "text-slate-600 hover:text-orange-700"
                }`}
              >
                Exclusive
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-xs sm:ml-2 sm:mt-0 w-full sm:w-auto">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">GST Type</span>
            <div className="flex items-center bg-slate-100 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setGstType("IN_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  gstType === "IN_TAX" ? "bg-orange-600 text-white" : "text-slate-600 hover:text-orange-700"
                }`}
              >
                CGST/SGST
              </button>
              <button
                type="button"
                onClick={() => setGstType("OUT_TAX")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  gstType === "OUT_TAX" ? "bg-orange-600 text-white" : "text-slate-600 hover:text-orange-700"
                }`}
              >
                IGST
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Party & Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Supplier *</label>
            <select
              required
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm"
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
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Bill No. *</label>
            <input
              type="text"
              placeholder="Enter bill number"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none placeholder-slate-400"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Payment Mode</label>
            <select
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm"
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

          <div className="p-2 bg-orange-100 rounded-full text-orange-600 hidden sm:block flex-shrink-0">
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
              className="w-full bg-white border border-slate-300 rounded-md px-3 sm:px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
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
                    className={`px-3 sm:px-4 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 text-sm ${index === selectedSuggestionIndex ? "bg-orange-100 text-orange-900" : "hover:bg-orange-50"
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

        {/* Items Table - Responsive */}
        <div>
          <div className="hidden sm:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b" style={{ width: columnWidths.item }}>Item</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b" style={{ width: columnWidths.category }}>Category</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b" style={{ width: columnWidths.code }}>Item Code</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b" style={{ width: columnWidths.barcode }}>Barcode</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b text-right pr-2" style={{ width: columnWidths.qty }}>Qty</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b text-right pr-2" style={{ width: columnWidths.mrp }}>MRP</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b text-right pr-2" style={{ width: columnWidths.price }}>Purchase Rate</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b text-right pr-2" style={{ width: columnWidths.tax }}>Tax %</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b text-right pr-2" style={{ width: columnWidths.amount }}>Amount</th>
                  <th className="py-2 text-sm font-semibold text-slate-500 border-b" style={{ width: columnWidths.actions }} />
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-3 pr-4 align-middle" style={{ width: columnWidths.item }}>
                      {row.manualMode ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                            placeholder="Enter item name"
                            value={row.itemName}
                            onChange={(e) => updateRow(index, "itemName", e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setManualMode(index, false)}
                            className="text-xs text-orange-600 hover:text-orange-700 px-2 py-1 border border-orange-200 rounded"
                          >
                            Back
                          </button>
                        </div>
                      ) : (
                        <select
                          className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                          value={row.itemId}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__manual__") {
                              setManualMode(index, true);
                              return;
                            }
                            updateRow(index, "itemId", val);
                          }}
                        >
                          <option value="">Select Item</option>
                          <option value="__manual__">+ Add Item (manual)</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} (Stock: {i.stock})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.category }}>
                      <input
                        type="text"
                        className="w-full h-10 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                        placeholder="Category"
                        value={row.category || ""}
                        onChange={(e) => updateRow(index, "category", e.target.value)}
                      />
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.code }}>
                      <input
                        type="text"
                        className="w-full h-10 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                        placeholder="Item Code"
                        value={row.code || ""}
                        onChange={(e) => updateRow(index, "code", e.target.value)}
                      />
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.barcode }}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="flex-1 h-10 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                          placeholder="Barcode"
                          value={row.barcode || ""}
                          onChange={(e) => updateRow(index, "barcode", e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleGenerateRowBarcode(index)}
                          className="h-10 px-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center"
                          title="Generate Barcode"
                        >
                          <Sparkles size={16} />
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.qty }}>
                      <input
                        type="number"
                        min="1"
                        className="w-full h-10 px-2 border border-slate-300 rounded text-right text-sm"
                        value={row.quantity}
                        onChange={(e) => updateRow(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.mrp }}>
                      <input
                        type="number"
                        className="w-full h-10 px-2 border border-slate-300 rounded text-right text-sm"
                        value={row.mrp || ""}
                        onChange={(e) => updateRow(index, "mrp", parseFloat(e.target.value) || 0)}
                        placeholder="MRP"
                      />
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.price }}>
                      <input
                        type="number"
                        className="w-full h-10 px-2 border border-slate-300 rounded text-right text-sm"
                        value={row.price}
                        onChange={(e) => updateRow(index, "price", parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    <td className="py-3 px-2 align-middle" style={{ width: columnWidths.tax }}>
                      <input
                        type="number"
                        className="w-full h-10 px-2 border border-slate-300 rounded text-right text-sm"
                        value={row.taxRate ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateRow(index, "taxRate", parseFloat(e.target.value) || 0)}
                        placeholder="GST %"
                      />
                    </td>

                    <td className="py-3 px-2 text-right font-medium text-slate-700 text-sm" style={{ width: columnWidths.amount }}>
                      ₹{Number(row.amount || 0).toFixed(2)}
                    </td>

                    <td className="py-3 pl-2 text-right" style={{ width: columnWidths.actions }}>
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
                    {row.manualMode ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-xs"
                          placeholder="Enter item name"
                          value={row.itemName}
                          onChange={(e) => updateRow(index, "itemName", e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setManualMode(index, false)}
                          className="text-[11px] text-orange-600 hover:text-orange-700 px-2 py-1 border border-orange-200 rounded"
                        >
                          Back
                        </button>
                      </div>
                    ) : (
                      <select
                        className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-xs mt-1"
                        value={row.itemId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__manual__") {
                            setManualMode(index, true);
                            return;
                          }
                          updateRow(index, "itemId", val);
                        }}
                      >
                        <option value="">Select Item</option>
                        <option value="__manual__">+ Add Item (manual)</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (Stock: {i.stock})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-5" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">Qty</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">MRP</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                      value={row.mrp || ""}
                      onChange={(e) => updateRow(index, "mrp", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">Category</label>
                    <input
                      type="text"
                      className="w-full h-10 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-xs"
                      placeholder="Category"
                      value={row.category || ""}
                      onChange={(e) => updateRow(index, "category", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">Item Code</label>
                    <input
                      type="text"
                      className="w-full h-10 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-xs"
                      placeholder="Item Code"
                      value={row.code || ""}
                      onChange={(e) => updateRow(index, "code", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold">Barcode</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 h-10 px-2 border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 outline-none text-xs"
                        placeholder="Barcode"
                        value={row.barcode || ""}
                        onChange={(e) => updateRow(index, "barcode", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateRowBarcode(index)}
                          className="h-10 px-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center"
                        title="Generate Barcode"
                      >
                        <Sparkles size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold">Purchase Rate</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                    value={row.price}
                    onChange={(e) => updateRow(index, "price", parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold">Tax Rate (%)</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded text-right text-xs"
                    value={row.taxRate ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateRow(index, "taxRate", parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="bg-slate-100 p-2 rounded text-right">
                  <span className="text-xs text-slate-500">Amount: </span>
                  <span className="font-semibold text-slate-800 text-sm">₹{Number(row.amount || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            type="button"
            className="mt-3 sm:mt-4 w-full sm:w-auto flex items-center justify-center sm:justify-start space-x-2 text-orange-600 font-medium hover:text-orange-800 text-sm"
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
                <span>{roundOffAmount >= 0 ? "+" : "-"}₹{Math.abs(roundOffAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg sm:text-xl font-bold text-slate-800">
                <span>Payable Total</span>
                <span>₹{payableTotal.toFixed(2)}</span>
              </div>
            </div>

          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 shadow-sm h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Payment Summary</h3>
                <p className="text-[11px] text-slate-500">Track how much of this bill is already paid.</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${dueBadgeClass}`}>
                {dueStatus}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Bill Total (Rounded)</span>
                <span className="font-semibold text-slate-900">₹{payableTotal.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount Paid Now</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input
                    type="number"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
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
          {rows.length} items • Type: <span className="font-semibold">PURCHASE</span>
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
            disabled={loading || !rows.some((r) => r.itemId || (r.manualMode && r.itemName?.trim()))}
            type="button"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Save size={16} />
            <span>Save</span>
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={loading || !rows.some((r) => r.itemId || (r.manualMode && r.itemName?.trim()))}
            type="button"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Printer size={16} />
            <span>Save & Print</span>
          </button>
        </div>
      </div>

      {/* Add New Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Add New Item</h2>
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
                    category: "",
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
              className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1"
            >
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.name} onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Category</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.category || ""} onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })} placeholder="e.g., Stationery, Grocery" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Item Code</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.code} onChange={(e) => setItemFormData({ ...itemFormData, code: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Barcode</label>
                    <div className="flex gap-2">
                      <input type="text" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.barcode} onChange={(e) => setItemFormData({ ...itemFormData, barcode: e.target.value })} />
                      <button
                        type="button"
                        onClick={handleGenerateItemBarcode}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1 flex-shrink-0"
                        title="Generate Barcode"
                      >
                        <Sparkles size={16} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">MRP</label>
                  <input type="number" step="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.mrp} onChange={(e) => setItemFormData({ ...itemFormData, mrp: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Purchase Price *</label>
                  <input required type="number" step="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.purchasePrice} onChange={(e) => setItemFormData({ ...itemFormData, purchasePrice: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Selling Price *</label>
                  <input required type="number" step="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.sellingPrice} onChange={(e) => setItemFormData({ ...itemFormData, sellingPrice: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Stock</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.stock} onChange={(e) => setItemFormData({ ...itemFormData, stock: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white text-sm" value={itemFormData.unit} onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}>
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilogram</option>
                    <option value="ltr">Liter</option>
                    <option value="box">Box</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                  <input type="number" step="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" value={itemFormData.taxRate} onChange={(e) => setItemFormData({ ...itemFormData, taxRate: Number(e.target.value) })} />
                </div>
              </div>
              <div className="pt-3 sm:pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
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
