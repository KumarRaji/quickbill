import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Eye, Edit2, Trash2 } from "lucide-react";
import { Invoice } from "../types";
import { InvoiceService } from "../services/api";

interface PurchaseBillsProps {
  onCreateNew: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
}

export default function PurchaseBills({
  onCreateNew,
  onViewInvoice,
  onEditInvoice,
}: PurchaseBillsProps) {
  const [bills, setBills] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await InvoiceService.getAll();
      const purchaseOnly = (Array.isArray(data) ? data : []).filter(
        (inv: Invoice) => inv.type === "PURCHASE"
      );
      setBills(purchaseOnly);
    } catch (error) {
      console.error("Error loading purchase bills:", error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleDelete = async (bill: Invoice) => {
    const ok = window.confirm("Delete this purchase bill?");
    if (!ok) return;

    const prev = bills;

    try {
      setDeletingId(bill.id);

      // ✅ Optimistic remove (instant UI)
      setBills((p) => p.filter((x) => x.id !== bill.id));

      await InvoiceService.delete(bill.id); // ✅ API call

      // ✅ optional: refresh from server to stay accurate
      await loadBills();
    } catch (err) {
      console.error("Delete failed:", err);

      // rollback
      setBills(prev);

      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBills = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return bills;

    return bills.filter((bill) => {
      const invoiceNo = (bill.invoiceNumber ?? "").toString().toLowerCase();
      const supplier = (bill.partyName ?? "").toString().toLowerCase();
      return invoiceNo.includes(term) || supplier.includes(term);
    });
  }, [bills, searchTerm]);

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Purchase Bills</h1>

          <button
            onClick={onCreateNew}
            className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            type="button"
          >
            <Plus size={20} />
            <span>New Purchase</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by bill number or supplier..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Bills List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : filteredBills.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No purchase bills found</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Bill No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Items</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Tax Rate (%)</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredBills.map((bill) => {
                  const amount = Number(bill.totalAmount ?? 0);
                  const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : "-";
                  const supplier = bill.partyName || "-";
                  const status = bill.status || "UNPAID";

                  const items = Array.isArray(bill.items) ? bill.items : [];
                  const isDeleting = deletingId === bill.id;

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{bill.invoiceNumber || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{dateStr}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{supplier}</td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="max-w-xs">
                          {items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-xs">
                              {item.itemName} (x{item.quantity})
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div className="text-xs text-slate-400">+{items.length - 2} more</div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 text-right">
                        {items.length > 0 ? `${items[0].taxRate || 0}%` : '-'}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-900 text-right font-medium">
                        ₹{amount.toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            status === "PAID" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => onViewInvoice(bill)}
                            disabled={isDeleting}
                            className={`p-2 rounded-lg transition-colors ${
                              isDeleting ? "text-slate-400 cursor-not-allowed" : "text-blue-600 hover:bg-blue-50"
                            }`}
                            title="View"
                            type="button"
                          >
                            <Eye size={18} />
                          </button>

                          <button
                            onClick={() => onEditInvoice(bill)}
                            disabled={isDeleting}
                            className={`p-2 rounded-lg transition-colors ${
                              isDeleting ? "text-slate-400 cursor-not-allowed" : "text-green-600 hover:bg-green-50"
                            }`}
                            title="Edit"
                            type="button"
                          >
                            <Edit2 size={18} />
                          </button>

                          <button
                            onClick={() => handleDelete(bill)}
                            disabled={isDeleting}
                            className={`p-2 rounded-lg transition-colors ${
                              isDeleting ? "text-slate-400 cursor-not-allowed" : "text-red-600 hover:bg-red-50"
                            }`}
                            title={isDeleting ? "Deleting..." : "Delete"}
                            type="button"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {isDeleting && (
                          <div className="mt-1 text-[11px] text-slate-400">Deleting...</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
