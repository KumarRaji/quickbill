import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Eye, Edit, Trash2, Printer } from "lucide-react";
import { Invoice } from "../types";
import { InvoiceService } from "../services/api";

interface PurchaseBillsProps {
  onCreateNew: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onPrintInvoice: (invoice: Invoice) => void;
}

export default function PurchaseBills({
  onCreateNew,
  onViewInvoice,
  onEditInvoice,
  onPrintInvoice,
}: PurchaseBillsProps) {
  const [bills, setBills] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // search + filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID">("ALL");
  const [fromDate, setFromDate] = useState<string>(""); // yyyy-mm-dd
  const [toDate, setToDate] = useState<string>(""); // yyyy-mm-dd

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Helpers before useMemo to avoid TDZ when filtering
  const getDueStatus = (bill: Invoice) => {
    const total = Number(bill.totalAmount ?? 0);
    const paid = Number(bill.amountPaid ?? 0);
    const dueValue = bill.amountDue;
    const due = dueValue !== undefined && dueValue !== null ? Number(dueValue) : Math.max(0, total - paid);

    if (due <= 0) return "PAID" as const;
    if (paid > 0 && paid < total) return "PARTIAL" as const;
    if (paid >= total) return "PAID" as const;
    return "PENDING" as const;
  };

  const getDueBadgeClass = (status: "PAID" | "PARTIAL" | "PENDING") => {
    if (status === "PAID") return "bg-green-100 text-green-800";
    if (status === "PARTIAL") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700";
  };

  const getRemainingDue = (bill: Invoice) => {
    const total = Number(bill.totalAmount ?? 0);
    const paid = Number(bill.amountPaid ?? 0);
    const dueValue = bill.amountDue;
    const due = dueValue !== undefined && dueValue !== null ? Number(dueValue) : Math.max(0, total - paid);
    return Math.max(0, due);
  };

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

      // ✅ Optimistic remove
      setBills((p) => p.filter((x) => x.id !== bill.id));

      await InvoiceService.delete(bill.id);

      // ✅ refresh for accuracy
      await loadBills();
    } catch (err) {
      console.error("Delete failed:", err);
      setBills(prev);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBills = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return bills.filter((bill) => {
      const invoiceNo = (bill.invoiceNumber ?? "").toString().toLowerCase();
      const supplier = (bill.partyName ?? "").toString().toLowerCase();
      const dueStatus = getDueStatus(bill);

      // search
      const matchesSearch = !term || invoiceNo.includes(term) || supplier.includes(term);

      // status filter
      const matchesStatus = statusFilter === "ALL" || dueStatus === statusFilter;

      // date filter (safe)
      const billDate = bill.date ? new Date(bill.date) : null;
      const fromOk = !fromDate || (billDate && billDate >= new Date(fromDate + "T00:00:00"));
      const toOk = !toDate || (billDate && billDate <= new Date(toDate + "T23:59:59"));

      return matchesSearch && matchesStatus && !!fromOk && !!toOk;
    });
  }, [bills, searchTerm, statusFilter, fromDate, toDate]);

  // ✅ paginate
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBills = filteredBills.slice(startIndex, startIndex + pageSize);

  const handlePrevious = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Purchase Bills</h1>

            <button
              onClick={onCreateNew}
              className="flex items-center justify-center sm:justify-start space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm w-full sm:w-auto"
              type="button"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">New Purchase</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>

        {/* Filters Row */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 items-end">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by bill number or supplier..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* From Date */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "ALL" | "PENDING" | "PARTIAL" | "PAID");
                  setPage(1);
                }}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </select>
            </div>

            {/* Rows */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rows</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear filters */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("ALL");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="mt-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : paginatedBills.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No purchase bills found</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Bill No.</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Supplier</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Items</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Tax Rate (%)</th>
                    <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                    <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Due Status</th>
                    <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paginatedBills.map((bill) => {
                    const amount = Number(bill.totalAmount ?? 0);
                    const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : "-";
                    const supplier = bill.partyName || "-";
                    const dueStatus = getDueStatus(bill);
                    const remainingDue = getRemainingDue(bill);

                    const items = Array.isArray(bill.items) ? bill.items : [];
                    const isDeleting = deletingId === bill.id;

                    return (
                      <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 lg:px-6 py-4 text-sm font-medium text-slate-900">{bill.invoiceNumber || "-"}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600">{dateStr}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600">{supplier}</td>

                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600">
                          <div className="max-w-xs">
                            {items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-xs">
                                {item.itemName} (x{item.quantity})
                              </div>
                            ))}
                            {items.length > 2 && <div className="text-xs text-slate-400">+{items.length - 2} more</div>}
                          </div>
                        </td>

                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 text-right">
                          {items.length > 0 ? `${items[0].taxRate || 0}%` : "-"}
                        </td>

                        <td className="px-4 lg:px-6 py-4 text-sm text-slate-900 text-right font-medium">
                          ₹{amount.toFixed(2)}
                        </td>

                        <td className="px-4 lg:px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDueBadgeClass(dueStatus)}`}
                            >
                              {dueStatus}
                            </span>
                            <span className="text-[11px] text-slate-500">Due: ₹{remainingDue.toFixed(2)}</span>
                          </div>
                        </td>

                        <td className="px-4 lg:px-6 py-4 text-center">
                          <div className="flex justify-center space-x-1 lg:space-x-2">
                            <button
                              onClick={() => onViewInvoice(bill)}
                              disabled={isDeleting}
                              className={`p-1 rounded ${
                                isDeleting ? "text-slate-400 cursor-not-allowed" : "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              }`}
                              title="View"
                              type="button"
                            >
                              <Eye size={18} />
                            </button>

                            <button
                              onClick={() => onPrintInvoice(bill)}
                              disabled={isDeleting}
                              className={`p-1 rounded ${
                                isDeleting ? "text-slate-400 cursor-not-allowed" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                              }`}
                              title="Print"
                              type="button"
                            >
                              <Printer size={18} />
                            </button>

                            <button
                              onClick={() => onEditInvoice(bill)}
                              disabled={isDeleting}
                              className={`p-1 rounded ${
                                isDeleting ? "text-slate-400 cursor-not-allowed" : "text-green-600 hover:text-green-800 hover:bg-green-50"
                              }`}
                              title="Edit"
                              type="button"
                            >
                              <Edit size={18} />
                            </button>

                            <button
                              onClick={() => handleDelete(bill)}
                              disabled={isDeleting}
                              className={`p-1 rounded ${
                                isDeleting ? "text-slate-400 cursor-not-allowed" : "text-red-600 hover:text-red-800 hover:bg-red-50"
                              }`}
                              title={isDeleting ? "Deleting..." : "Delete"}
                              type="button"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          {isDeleting && <div className="mt-1 text-[11px] text-slate-400">Deleting...</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3 p-3">
              {paginatedBills.map((bill) => {
                const amount = Number(bill.totalAmount ?? 0);
                const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : "-";
                const supplier = bill.partyName || "-";
                const dueStatus = getDueStatus(bill);
                const remainingDue = getRemainingDue(bill);
                const items = Array.isArray(bill.items) ? bill.items : [];
                const isDeleting = deletingId === bill.id;

                return (
                  <div key={bill.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2 cursor-pointer hover:bg-slate-50">
                    <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm">{bill.invoiceNumber || "-"}</div>
                        <div className="text-xs text-slate-500">{dateStr}</div>
                      </div>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getDueBadgeClass(dueStatus)}`}
                      >
                        {dueStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 font-semibold mb-1">Supplier</div>
                        <div className="text-slate-900">{supplier}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-semibold mb-1">Amount</div>
                        <div className="font-medium text-slate-900">₹{amount.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500">Due: ₹{remainingDue.toFixed(2)}</div>

                    <div className="bg-slate-100 p-2 rounded text-xs space-y-1">
                      <div className="font-semibold text-slate-600">Items ({items.length})</div>
                      {items.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="text-slate-700">
                          {item.itemName} (x{item.quantity}) - Tax: {item.taxRate || 0}%
                        </div>
                      ))}
                      {items.length > 2 && <div className="text-slate-500">+{items.length - 2} more items</div>}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => onViewInvoice(bill)}
                        disabled={isDeleting}
                        className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs font-medium transition-colors ${
                          isDeleting ? "text-slate-400 cursor-not-allowed" : "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        }`}
                        type="button"
                      >
                        <Eye size={16} />
                        <span className="hidden xs:inline">View</span>
                      </button>

                      <button
                        onClick={() => onPrintInvoice(bill)}
                        disabled={isDeleting}
                        className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs font-medium transition-colors ${
                          isDeleting ? "text-slate-400 cursor-not-allowed" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        }`}
                        type="button"
                      >
                        <Printer size={16} />
                        <span className="hidden xs:inline">Print</span>
                      </button>

                      <button
                        onClick={() => onEditInvoice(bill)}
                        disabled={isDeleting}
                        className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs font-medium transition-colors ${
                          isDeleting ? "text-slate-400 cursor-not-allowed" : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                        type="button"
                      >
                        <Edit size={16} />
                        <span className="hidden xs:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => handleDelete(bill)}
                        disabled={isDeleting}
                        className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs font-medium transition-colors ${
                          isDeleting ? "text-slate-400 cursor-not-allowed" : "text-red-600 hover:text-red-800 hover:bg-red-50"
                        }`}
                        type="button"
                      >
                        <Trash2 size={16} />
                        <span className="hidden xs:inline">Delete</span>
                      </button>
                    </div>
                    {isDeleting && <div className="text-[11px] text-slate-400 text-center">Deleting...</div>}
                  </div>
                );
              })}
            </div>

            {/* ✅ Pagination Bar */}
            <div className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <p className="text-xs text-slate-500 order-2 sm:order-1">
                Showing{" "}
                <span className="font-medium">
                  {startIndex + 1}–{Math.min(startIndex + paginatedBills.length, filteredBills.length)}
                </span>{" "}
                of <span className="font-medium">{filteredBills.length}</span> bills
              </p>

              <div className="inline-flex items-center gap-2 text-xs sm:text-sm order-1 sm:order-2 w-full sm:w-auto">
                <button
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                  className="flex-1 sm:flex-initial bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                  type="button"
                >
                  Prev
                </button>

                <span className="px-2 sm:px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                  {currentPage}
                </span>

                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className="flex-1 sm:flex-initial bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
