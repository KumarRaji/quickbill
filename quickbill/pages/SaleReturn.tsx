import React, { useMemo, useState } from "react";
import { Invoice, User } from "../types";
import { InvoiceService } from "../services/api";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";

type Props = {
  invoices: Invoice[];
  currentUser: User;
  onCancel: () => void;
  onSuccess: (returnInvoiceId: string) => void;
};

type ReturnRow = {
  itemId: string;
  itemName: string;
  soldQty: number; // current sold qty (already net after previous returns)
  price: number;
  taxRate: number;
  returnQty: number;
};

const SaleReturn: React.FC<Props> = ({ invoices, currentUser, onCancel, onSuccess }) => {
  // Only SALE invoices can be returned
  const saleInvoices = useMemo(
    () => invoices.filter((i) => i.type === "SALE"),
    [invoices]
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  const selectedInvoice = useMemo(
    () => saleInvoices.find((i) => i.id === selectedInvoiceId) || null,
    [saleInvoices, selectedInvoiceId]
  );

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return saleInvoices;
    const query = searchQuery.toLowerCase();
    return saleInvoices.filter(
      (inv) =>
        inv.invoiceNumber?.toLowerCase().includes(query) ||
        inv.partyName?.toLowerCase().includes(query)
    );
  }, [saleInvoices, searchQuery]);

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Build rows ONLY from original invoice items (no new products allowed)
  const rows: ReturnRow[] = useMemo(() => {
    if (!selectedInvoice) return [];
    return (selectedInvoice.items || []).map((it) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      soldQty: Number(it.quantity || 0), // IMPORTANT: this should be current net sold qty (backend updates it)
      price: Number(it.price || 0),
      taxRate: Number(it.taxRate || 0),
      returnQty: 0,
    }));
  }, [selectedInvoice]);

  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);

  // When invoice changes, reset return rows
  React.useEffect(() => {
    setReturnRows(rows);
    setReason("");
    if (selectedInvoice) {
      setSearchQuery(`${selectedInvoice.invoiceNumber} — ${selectedInvoice.partyName}`);
    }
  }, [selectedInvoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id);
    setSearchQuery(`${invoice.invoiceNumber} — ${invoice.partyName}`);
    setShowDropdown(false);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  const selectedReturnItems = useMemo(() => {
    return returnRows.filter((r) => r.returnQty > 0);
  }, [returnRows]);

  const totals = useMemo(() => {
    const subtotal = selectedReturnItems.reduce((sum, r) => sum + r.price * r.returnQty, 0);
    const tax = selectedReturnItems.reduce(
      (sum, r) => sum + (r.price * r.returnQty * r.taxRate) / 100,
      0
    );
    const grand = subtotal + tax;
    return { subtotal, tax, grand };
  }, [selectedReturnItems]);

  const setQty = (itemId: string, qty: number) => {
    setReturnRows((prev) =>
      prev.map((r) => {
        if (r.itemId !== itemId) return r;

        // ✅ Validation: cannot return more than sold
        const safeQty = Math.max(0, Math.min(qty, r.soldQty));
        return { ...r, returnQty: safeQty };
      })
    );
  };

  const canSubmit =
    !!selectedInvoice &&
    selectedReturnItems.length > 0 &&
    !!currentUser &&
    !submitting;

  const handleSubmit = async () => {
    if (!selectedInvoice) return;

    // ✅ extra validation on frontend
    for (const r of selectedReturnItems) {
      if (r.returnQty <= 0) continue;
      if (r.returnQty > r.soldQty) {
        alert(`Return qty cannot exceed sold qty for ${r.itemName}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        processedBy: currentUser?.name || currentUser?.username || "Unknown",
        reason: reason?.trim() || undefined,
        items: selectedReturnItems.map((r) => ({
          itemId: r.itemId,
          quantity: r.returnQty,
        })),
      };

      // Backend will:
      // - create RETURN invoice linked to original
      // - update original invoice_items qty and original totals
      // - add stock back
      // - audit log
      const resp = await InvoiceService.applySaleReturnToOriginal(selectedInvoice.id, payload);

      // expect: { returnInvoiceId: "123" }
      onSuccess(resp.returnInvoiceId);
    } catch (e: any) {
      console.error('Sale return error:', e);
      alert(e?.response?.data?.message || e?.message || "Failed to process sale return");
    } finally {
      setSubmitting(false);
    }
  };

  // Permission: example (you can change based on your roles)
  const isAuthorized = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "STAFF";

  if (!isAuthorized) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-red-600 font-semibold">
          Access Denied
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Sale Return</h1>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
          Create Credit Note
        </button>
      </div>

      {/* Select Invoice */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative" onClick={(e) => e.stopPropagation()}>
        <label className="text-sm font-medium text-slate-700">Enter the TXN *</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const value = searchQuery.trim();
              if (value) {
                const exactMatch = saleInvoices.find(
                  (inv) => inv.invoiceNumber.toLowerCase() === value.toLowerCase()
                );
                if (exactMatch) {
                  handleSelectInvoice(exactMatch);
                } else if (filteredInvoices.length > 0) {
                  handleSelectInvoice(filteredInvoices[0]);
                }
              }
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search by invoice number or party name..."
          className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        {showDropdown && filteredInvoices.length > 0 && (
          <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] max-h-60 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
            {filteredInvoices.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => handleSelectInvoice(inv)}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 focus:outline-none focus:bg-blue-50"
              >
                <div className="font-medium text-slate-800">{inv.invoiceNumber} — {inv.partyName}</div>
                <div className="text-sm text-slate-500">₹{inv.totalAmount}</div>
              </button>
            ))}
          </div>
        )}
        
        {showDropdown && searchQuery && filteredInvoices.length === 0 && (
          <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] bg-white border border-slate-300 rounded-lg shadow-lg p-4 text-center text-slate-500">
            No invoices found
          </div>
        )}
      </div>

      {/* Invoice Items (only sold items) */}
      {selectedInvoice && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
            Sold Items (select quantities to return)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Invoice No</th>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3 text-center">Sold Qty</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3 text-center">Tax %</th>
                  <th className="px-6 py-3 text-center">Return Qty</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {returnRows.map((r) => (
                  <tr key={r.itemId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-600">{selectedInvoice?.invoiceNumber || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{r.itemName}</td>
                    <td className="px-6 py-4 text-center text-slate-700">{r.soldQty}</td>
                    <td className="px-6 py-4 text-right text-slate-700">₹{r.price}</td>
                    <td className="px-6 py-4 text-center text-slate-600">{r.taxRate}%</td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={r.soldQty}
                        value={r.returnQty}
                        onChange={(e) => setQty(r.itemId, Number(e.target.value))}
                        className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="text-[11px] text-slate-400 mt-1">
                        max {r.soldQty}
                      </div>
                    </td>
                  </tr>
                ))}

                {returnRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      No items found in invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Return summary (ONLY returned items) */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">Return Subtotal</div>
                <div className="text-lg font-bold text-slate-800">₹{totals.subtotal.toFixed(2)}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">Return Tax</div>
                <div className="text-lg font-bold text-slate-800">₹{totals.tax.toFixed(2)}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">Credit Note Total</div>
                <div className="text-lg font-bold text-red-600">₹{totals.grand.toFixed(2)}</div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="e.g., Damaged / Wrong size / Customer changed mind..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaleReturn;
