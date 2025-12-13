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
    return purchaseInvoices.filter(
      (inv) =>
        String(inv.invoiceNumber || "").toLowerCase().includes(q) ||
        String(inv.partyName || "").toLowerCase().includes(q)
    );
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <RefreshCw size={18} /> Purchase Return
          </h1>
        </div>
      </div>

      {/* Select Purchase Bill */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Search Bill (Invoice No / Supplier)</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Search..."
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Select Purchase Bill</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
            >
              <option value="">-- Select --</option>
              {filteredInvoices.map((inv) => (
                <option key={inv.id} value={String(inv.id)}>
                  {inv.invoiceNumber} — {inv.partyName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-sm text-slate-600">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Damaged, wrong item, etc."
          />
        </div>
      </div>

      {!selectedInvoice ? (
        <div className="text-slate-500 text-center py-10">
          <FileText className="mx-auto mb-2" />
          Select a purchase bill to return items.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 font-medium">
              Bill Items (Remaining)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-right px-4 py-2">Qty Left</th>
                    <th className="text-right px-4 py-2">Price</th>
                    <th className="text-right px-4 py-2">Tax %</th>
                    <th className="text-right px-4 py-2">Return Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.itemId} className="border-t border-slate-100">
                      <td className="px-4 py-2">{r.itemName}</td>
                      <td className="px-4 py-2 text-right">{r.purchasedQty}</td>
                      <td className="px-4 py-2 text-right">{r.price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{r.taxRate.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={r.purchasedQty}
                          value={r.returnQty}
                          onChange={(e) => updateQty(r.itemId, Number(e.target.value))}
                          className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                Subtotal: <span className="font-medium text-slate-900">{totals.subtotal.toFixed(2)}</span>{" "}
                | Tax: <span className="font-medium text-slate-900">{totals.tax.toFixed(2)}</span>{" "}
                | Grand: <span className="font-semibold text-slate-900">{totals.grand.toFixed(2)}</span>
              </div>

              <button
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
              >
                Process Purchase Return
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PurchaseReturn;
