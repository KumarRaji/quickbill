import React, { useMemo, useState, useEffect } from "react";
import { Invoice, User } from "../types";
import { InvoiceService } from "../services/api";
import { FileText, RefreshCw } from "lucide-react";

type Props = {
  invoices: Invoice[];
  currentUser: User;
  onCancel: () => void;
  onSuccess: (returnInvoiceId: string) => void;
};

type ReturnRow = {
  itemId: string;
  itemName: string;
  soldQty: number;
  price: number;
  taxRate: number;
  returnQty: number;
};

const SaleReturn: React.FC<Props> = ({ invoices, currentUser, onCancel, onSuccess }) => {
  const saleInvoices = useMemo(() => invoices.filter((i) => i.type === "SALE"), [invoices]);

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

  // ✅ number input helpers
  const parseQty = (val: string) => {
    if (val === "") return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  };

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

  const rows: ReturnRow[] = useMemo(() => {
    if (!selectedInvoice) return [];
    return (selectedInvoice.items || []).map((it) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      soldQty: Number(it.quantity || 0),
      price: Number(it.price || 0),
      taxRate: Number(it.taxRate || 0),
      returnQty: 0,
    }));
  }, [selectedInvoice]);

  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  // When invoice changes, reset return rows
  useEffect(() => {
    setReturnRows(rows);
    setReason("");

    const nextInputs: Record<string, string> = {};
    for (const r of rows) nextInputs[r.itemId] = "0";
    setQtyInputs(nextInputs);

    if (selectedInvoice) {
      setSearchQuery(`${selectedInvoice.invoiceNumber} — ${selectedInvoice.partyName}`);
    }
  }, [selectedInvoiceId, rows, selectedInvoice]);

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id);
    setSearchQuery(`${invoice.invoiceNumber} — ${invoice.partyName}`);
    setShowDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showDropdown]);

  // ✅ FIXED: removed extra "return"
  const selectedReturnItems = useMemo(
    () => returnRows.filter((r) => r.returnQty > 0),
    [returnRows]
  );

  const totals = useMemo(() => {
    const subtotal = selectedReturnItems.reduce((sum, r) => sum + r.price * r.returnQty, 0);
    const tax = 0;
    return { subtotal, tax, grand: subtotal };
  }, [selectedReturnItems]);

  const setQty = (itemId: string, qty: number) => {
    setReturnRows((prev) =>
      prev.map((r) => {
        if (r.itemId !== itemId) return r;
        const safeQty = clamp(qty, 0, r.soldQty);
        return { ...r, returnQty: safeQty };
      })
    );
  };

  const canSubmit = !!selectedInvoice && selectedReturnItems.length > 0 && !!currentUser && !submitting;

  const handleSubmit = async () => {
    if (!selectedInvoice) return;

    for (const r of selectedReturnItems) {
      if (r.returnQty > r.soldQty) {
        alert(`Return qty cannot exceed sold qty for ${r.itemName}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        processedBy: currentUser?.name || (currentUser as any)?.username || "Unknown",
        reason: reason?.trim() || undefined,
        items: selectedReturnItems.map((r) => ({ itemId: r.itemId, quantity: r.returnQty })),
      };

      const resp = await InvoiceService.applySaleReturnToOriginal(selectedInvoice.id, payload);
      onSuccess(resp.returnInvoiceId);
    } catch (e: any) {
      console.error("Sale return error:", e);
      alert(e?.response?.data?.message || e?.message || "Failed to process sale return");
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthorized =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "STAFF";

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
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 pb-6">
      <div className="max-w-7xl mx-auto h-full flex flex-col space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Sale Return</h1>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-3 sm:px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm"
              type="button"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-slate-700 hover:bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
              type="button"
            >
              {submitting ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
              <span className="hidden sm:inline">Create Credit Note</span>
              <span className="sm:hidden">Credit Note</span>
            </button>
          </div>
        </div>

      {/* Select Invoice */}
      <div
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-xs sm:text-sm font-medium text-slate-700">Enter the TXN *</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const value = searchQuery.trim();
              if (!value) return;
              const exactMatch = saleInvoices.find(
                (inv) => inv.invoiceNumber?.toLowerCase() === value.toLowerCase()
              );
              if (exactMatch) handleSelectInvoice(exactMatch);
              else if (filteredInvoices.length > 0) handleSelectInvoice(filteredInvoices[0]);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search by invoice number or party name..."
          className="mt-2 w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
        />

        {showDropdown && filteredInvoices.length > 0 && (
          <div className="absolute z-10 mt-1 w-[calc(100%-1.5rem)] max-h-60 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
            {filteredInvoices.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => handleSelectInvoice(inv)}
                className="w-full text-left px-3 sm:px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 focus:outline-none focus:bg-blue-50"
              >
                <div className="font-medium text-slate-800 text-xs sm:text-sm">
                  {inv.invoiceNumber} — {inv.partyName}
                </div>
                <div className="text-xs text-slate-500">₹{inv.totalAmount}</div>
              </button>
            ))}
          </div>
        )}

        {showDropdown && searchQuery && filteredInvoices.length === 0 && (
          <div className="absolute z-10 mt-1 w-[calc(100%-1.5rem)] bg-white border border-slate-300 rounded-lg shadow-lg p-4 text-center text-slate-500 text-xs sm:text-sm">
            No invoices found
          </div>
        )}
      </div>

      {/* Invoice Items */}
      {selectedInvoice && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700 text-xs sm:text-sm">
            Sold Items (select quantities to return)
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:flex sm:flex-col sm:flex-1 sm:min-h-0">
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 sm:py-4">Invoice No</th>
                    <th className="px-4 lg:px-6 py-3 sm:py-4">Item</th>
                    <th className="px-4 lg:px-6 py-3 sm:py-4 text-center">Sold Qty</th>
                    <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Price</th>
                    <th className="px-4 lg:px-6 py-3 sm:py-4 text-center">Tax %</th>
                    <th className="px-4 lg:px-6 py-3 sm:py-4 text-center">Return Qty</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {returnRows.map((r) => (
                    <tr key={r.itemId} className="hover:bg-slate-50">
                      <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-600 text-sm">
                        {selectedInvoice?.invoiceNumber || "N/A"}
                      </td>
                      <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">{r.itemName}</td>
                      <td className="px-4 lg:px-6 py-3 sm:py-4 text-center text-slate-700 text-sm">{r.soldQty}</td>
                      <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-700 text-sm">₹{r.price}</td>
                      <td className="px-4 lg:px-6 py-3 sm:py-4 text-center text-slate-600 text-sm">{r.taxRate}%</td>

                      <td className="px-4 lg:px-6 py-3 sm:py-4 text-center">
                        <input
                          type="number"
                          min={0}
                          max={r.soldQty}
                          inputMode="numeric"
                          value={qtyInputs[r.itemId] ?? "0"}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setQtyInputs((prev) => ({ ...prev, [r.itemId]: raw }));

                            const parsed = parseQty(raw);
                            if (parsed === undefined) {
                              setQty(r.itemId, 0);
                              return;
                            }
                            setQty(r.itemId, clamp(parsed, 0, r.soldQty));
                          }}
                          onBlur={() => {
                            const raw = (qtyInputs[r.itemId] ?? "").trim();
                            const parsed = parseQty(raw);
                            const finalQty = clamp(parsed ?? 0, 0, r.soldQty);

                            setQty(r.itemId, finalQty);
                            setQtyInputs((prev) => ({ ...prev, [r.itemId]: String(finalQty) }));
                          }}
                          className="w-24 px-2 sm:px-3 py-2 border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                        />
                        <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">max {r.soldQty}</div>
                      </td>
                    </tr>
                  ))}

                  {returnRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 lg:px-6 py-10 text-center text-slate-400 text-sm">
                        No items found in invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden p-3 space-y-3 flex-1 overflow-auto min-h-0">
            {returnRows.map((r) => (
              <div key={r.itemId} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
                <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">{r.itemName}</div>
                    <div className="text-xs text-slate-500 mt-1">Invoice: {selectedInvoice?.invoiceNumber || "N/A"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs py-2">
                  <div>
                    <span className="text-slate-500">Sold Qty</span>
                    <div className="font-medium text-slate-900">{r.soldQty}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Price</span>
                    <div className="font-medium text-slate-900">₹{r.price}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tax %</span>
                    <div className="font-medium text-slate-900">{r.taxRate}%</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Return Qty</span>
                    <input
                      type="number"
                      min={0}
                      max={r.soldQty}
                      inputMode="numeric"
                      value={qtyInputs[r.itemId] ?? "0"}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setQtyInputs((prev) => ({ ...prev, [r.itemId]: raw }));

                        const parsed = parseQty(raw);
                        if (parsed === undefined) {
                          setQty(r.itemId, 0);
                          return;
                        }
                        setQty(r.itemId, clamp(parsed, 0, r.soldQty));
                      }}
                      onBlur={() => {
                        const raw = (qtyInputs[r.itemId] ?? "").trim();
                        const parsed = parseQty(raw);
                        const finalQty = clamp(parsed ?? 0, 0, r.soldQty);

                        setQty(r.itemId, finalQty);
                        setQtyInputs((prev) => ({ ...prev, [r.itemId]: String(finalQty) }));
                      }}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">max {r.soldQty}</div>
                  </div>
                </div>
              </div>
            ))}
            {returnRows.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">No items found in invoice.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Totals and Reason */}
      {selectedInvoice && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
              <div className="text-xs text-slate-500 font-medium">Return Subtotal</div>
              <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{totals.subtotal.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 sm:p-4">
              <div className="text-xs text-orange-600 font-medium">Credit Note Total</div>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">₹{totals.grand.toFixed(2)}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">Reason (optional)</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs sm:text-sm"
              placeholder="e.g., Damaged / Wrong size / Customer changed mind..."
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default SaleReturn;
