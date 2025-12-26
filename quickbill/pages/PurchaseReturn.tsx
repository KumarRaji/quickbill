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
  purchasedQty: number; // remaining qty in original purchase bill (net after previous returns)
  price: number;
  taxRate: number;
  returnQty: number;
};

const PurchaseReturn: React.FC<Props> = ({ invoices, currentUser, onCancel, onSuccess }) => {
  // Only PURCHASE invoices can be returned
  const purchaseInvoices = useMemo(
    () => invoices.filter((i) => i.type === "PURCHASE"),
    [invoices]
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const selectedInvoice = useMemo(() => {
    const inv = purchaseInvoices.find((i) => String(i.id) === selectedInvoiceId);
    return inv || null;
  }, [purchaseInvoices, selectedInvoiceId]);

  const returnRows: ReturnRow[] = useMemo(() => {
    if (!selectedInvoice) return [];

    return (selectedInvoice.items || []).map((it) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      purchasedQty: Number(it.quantity || 0),
      price: Number(it.price || 0),
      taxRate: Number(it.taxRate || 0),
      returnQty: 0,
    }));
  }, [selectedInvoice]);

  const [rows, setRows] = useState<ReturnRow[]>([]);

  // When invoice changes, reset rows
  React.useEffect(() => {
    setRows(returnRows);
  }, [selectedInvoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return purchaseInvoices;
    
    return purchaseInvoices.filter((inv) => {
      const invoiceNum = String(inv.invoiceNumber || "").trim().toLowerCase();
      const partyName = String(inv.partyName || "").trim().toLowerCase();
      return invoiceNum.includes(q) || partyName.includes(q);
    });
  }, [purchaseInvoices, searchQuery]);

  const updateQty = (itemId: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.itemId === itemId ? { ...r, returnQty: Number.isFinite(qty) ? qty : 0 } : r
      )
    );
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    for (const r of rows) {
      if (!r.returnQty || r.returnQty <= 0) continue;
      const sub = r.price * r.returnQty;
      const t = (sub * r.taxRate) / 100;
      subtotal += sub;
      tax += t;
    }

    const grand = subtotal + tax;
    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      grand: Number(grand.toFixed(2)),
    };
  }, [rows]);

  const handleSubmit = async () => {
    if (!selectedInvoice) return;

    const items = rows
      .filter((r) => r.returnQty > 0)
      .map((r) => ({
        itemId: r.itemId,
        quantity: r.returnQty,
      }));

    if (items.length === 0) {
      alert("Please enter return quantity for at least one item.");
      return;
    }

    // client-side validation (server validates again)
    for (const r of rows) {
      if (r.returnQty > 0 && r.returnQty > r.purchasedQty) {
        alert(`Return qty cannot exceed purchased qty for: ${r.itemName}`);
        return;
      }
    }

    try {
      const resp = await InvoiceService.applyPurchaseReturnToOriginal(selectedInvoice.id, {
        items,
        reason,
        processedBy: currentUser?.name || currentUser?.username || "Unknown",
      });
      onSuccess(resp.returnInvoiceId);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to process purchase return");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 pb-6">
      <div className="max-w-7xl mx-auto h-full flex flex-col space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw size={20} /> Purchase Return
          </h1>

          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center sm:justify-start gap-2 rounded-lg px-3 sm:px-4 py-2 border border-slate-300 hover:bg-slate-100 text-xs sm:text-sm"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>

      {/* Select Purchase Bill */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 relative" onClick={(e) => e.stopPropagation()}>
        <label className="text-xs sm:text-sm font-medium text-slate-700">Search Bill (Invoice No / Supplier) *</label>
        <input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          onKeyDown={(e) => {
            if (!showSuggestions || filteredInvoices.length === 0) return;
            
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightedIndex((prev) => 
                prev < filteredInvoices.length - 1 ? prev + 1 : prev
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
            } else if (e.key === "Enter" && highlightedIndex >= 0) {
              e.preventDefault();
              const selected = filteredInvoices[highlightedIndex];
              setSelectedInvoiceId(String(selected.id));
              setSearchQuery("");
              setShowSuggestions(false);
              setHighlightedIndex(-1);
            }
          }}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
          placeholder="Search by invoice number or supplier name..."
        />
        {showSuggestions && searchQuery.trim() && filteredInvoices.length > 0 && (
          <div className="absolute z-10 w-[calc(100%-1.5rem)] mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto" onMouseDown={(e) => e.preventDefault()}>
            {filteredInvoices.map((inv, index) => (
              <div
                key={inv.id}
                onMouseDown={() => {
                  setSelectedInvoiceId(String(inv.id));
                  setSearchQuery("");
                  setShowSuggestions(false);
                  setHighlightedIndex(-1);
                }}
                className={`px-3 sm:px-4 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 text-xs sm:text-sm ${
                  highlightedIndex === index ? "bg-blue-100" : "hover:bg-blue-50"
                }`}
              >
                <div className="font-medium text-slate-800">{inv.invoiceNumber}</div>
                <div className="text-xs text-slate-500">{inv.partyName}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 sm:mt-4">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
            placeholder="Damaged, wrong item, etc."
          />
        </div>
      </div>

      {purchaseInvoices.length === 0 ? (
        <div className="text-slate-500 text-center py-10">
          <FileText className="mx-auto mb-2" />
          <p className="text-xs sm:text-sm">No purchase bills found.</p>
        </div>
      ) : !selectedInvoice ? (
        <div className="text-slate-500 text-center py-10">
          <FileText className="mx-auto mb-2" />
          <p className="text-xs sm:text-sm">Select a purchase bill to return items.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700 text-xs sm:text-sm">
              Bill Items (Remaining)
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:flex sm:flex-col sm:flex-1 sm:min-h-0">
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 sm:py-4">Item</th>
                      <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Qty Left</th>
                      <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Price</th>
                      <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Tax %</th>
                      <th className="px-4 lg:px-6 py-3 sm:py-4 text-right">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.itemId} className="hover:bg-slate-50">
                        <td className="px-4 lg:px-6 py-3 sm:py-4 font-medium text-slate-800 text-sm">{r.itemName}</td>
                        <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-700 text-sm">{r.purchasedQty}</td>
                        <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-700 text-sm">₹{r.price.toFixed(2)}</td>
                        <td className="px-4 lg:px-6 py-3 sm:py-4 text-right text-slate-600 text-sm">{r.taxRate.toFixed(2)}%</td>
                        <td className="px-4 lg:px-6 py-3 sm:py-4 text-right">
                          <input
                            type="number"
                            min={0}
                            max={r.purchasedQty}
                            value={r.returnQty}
                            onChange={(e) => updateQty(r.itemId, Number(e.target.value))}
                            className="w-20 sm:w-24 rounded-lg border border-slate-300 px-2 sm:px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden p-3 space-y-3 flex-1 overflow-auto min-h-0">
              {rows.map((r) => (
                <div key={r.itemId} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
                  <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 text-sm">{r.itemName}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs py-2">
                    <div>
                      <span className="text-slate-500">Qty Left</span>
                      <div className="font-medium text-slate-900">{r.purchasedQty}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Price</span>
                      <div className="font-medium text-slate-900">₹{r.price.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Tax %</span>
                      <div className="font-medium text-slate-900">{r.taxRate.toFixed(2)}%</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Return Qty</span>
                      <input
                        type="number"
                        min={0}
                        max={r.purchasedQty}
                        value={r.returnQty}
                        onChange={(e) => updateQty(r.itemId, Number(e.target.value))}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals and Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs text-slate-500 font-medium">Subtotal</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{totals.subtotal.toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs text-slate-500 font-medium">Tax</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{totals.tax.toFixed(2)}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs text-blue-600 font-medium">Grand Total</div>
                <div className="text-lg sm:text-2xl font-bold text-blue-600">₹{totals.grand.toFixed(2)}</div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-colors"
            >
              Process Purchase Return
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default PurchaseReturn;
