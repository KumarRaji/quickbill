import React, { useState, useEffect, useMemo } from 'react';
import { Party, Payment } from '../types';
import { PaymentService, Supplier } from '../services/api';
import { Plus, Search, TrendingUp, Calendar } from 'lucide-react';
import { X } from 'lucide-react';

interface PaymentOutProps {
  parties: Party[];
  suppliers: Supplier[];
  onRefresh: () => void;
}

const PaymentOut: React.FC<PaymentOutProps> = ({ parties, suppliers, onRefresh }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ Pagination + page size
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState<Partial<Payment>>({
    partyId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    mode: 'CASH',
    notes: '',
  });

  const fetchPayments = async () => {
    const data = await PaymentService.getAll();
    const outPayments = data.filter((p) => p.type === 'OUT');
    outPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setPayments(outPayments);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partyId || !formData.amount) return;

    setLoading(true);
    try {
      const selectedSupplier = suppliers.find((s) => String(s.id) === formData.partyId);

      await PaymentService.create({
        ...formData,
        partyName: selectedSupplier?.name || 'Unknown',
        type: 'OUT',
      } as Payment);

      setFormData({
        partyId: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        mode: 'CASH',
        notes: '',
      });

      setIsModalOpen(false);
      fetchPayments();
      onRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Filter first
  const filteredPayments = useMemo(() => {
    return payments.filter((p) =>
      (p.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [payments, searchTerm]);

  // ✅ Pagination after filtering
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + pageSize);

  const handlePrevious = () => setPage((prev) => Math.max(1, prev - 1));
  const handleNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 pb-6">
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          Payment Out (Supplier Payments)
        </h1>

        <button
          onClick={() => {
            setFormData({
              partyId: '',
              amount: 0,
              date: new Date().toISOString().split('T')[0],
              mode: 'CASH',
              notes: '',
            });
            setIsModalOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Record Payment</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        {/* ✅ Search + page size */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md w-full">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by supplier name..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1); // ✅ reset on search
              }}
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs font-medium text-slate-600">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1); // ✅ reset on page size change
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-auto flex-1 hidden sm:block">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  Date
                </th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  Paid To
                </th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  Mode
                </th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  Notes
                </th>
                <th className="px-4 lg:px-6 py-3 sm:py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                  Amount Paid
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {paginatedPayments.map((payment) => {
                const supplier = suppliers.find((s) => String(s.id) === String(payment.partyId));
                const displayName = supplier?.name || payment.partyName;
                
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                      <div className="flex items-center space-x-2">
                        <Calendar size={14} />
                        <span>{new Date(payment.date).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap font-medium text-slate-900 text-sm">
                      {displayName}
                    </td>

                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                        {payment.mode}
                      </span>
                    </td>

                    <td className="px-4 lg:px-6 py-3 sm:py-4 text-sm text-slate-600">
                      {payment.notes || '-'}
                    </td>

                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right font-bold text-orange-600 text-sm">
                      - ₹{payment.amount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 lg:px-6 py-12 text-center text-slate-400">
                    <TrendingUp size={48} className="mx-auto mb-2 opacity-20" />
                    No payments made yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile view - Card layout */}
        <div className="sm:hidden p-3 space-y-3 flex-1 overflow-auto">
          {paginatedPayments.map((payment) => {
            const supplier = suppliers.find((s) => String(s.id) === String(payment.partyId));
            const displayName = supplier?.name || payment.partyName;
            
            return (
              <div key={payment.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Date</div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Calendar size={14} />
                      <span>{new Date(payment.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                    {payment.mode}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Paid To</div>
                  <div className="text-sm font-medium text-slate-900">{displayName}</div>
                </div>
                {payment.notes && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Notes</div>
                    <div className="text-sm text-slate-600">{payment.notes}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount Paid</div>
                  <div className="text-sm font-bold text-orange-600">- ₹{payment.amount.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
          {filteredPayments.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <TrendingUp size={48} className="mx-auto mb-2 opacity-20" />
              <p>No payments made yet.</p>
            </div>
          )}
        </div>

        {/* ✅ Pagination bar (Previous | 1 | Next style) */}
        {filteredPayments.length > 0 && (
          <div className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-medium">
                {startIndex + 1}–
                {Math.min(startIndex + paginatedPayments.length, filteredPayments.length)}
              </span>{' '}
              of <span className="font-medium">{filteredPayments.length}</span> payments
            </p>

            <div className="inline-flex items-center gap-2 text-xs sm:text-sm">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>

              <span className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                {currentPage}
              </span>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Record Payment Out</h2>
              <button onClick={() => {
                setIsModalOpen(false);
                setFormData({
                  partyId: '',
                  amount: 0,
                  date: new Date().toISOString().split('T')[0],
                  mode: 'CASH',
                  notes: '',
                });
              }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Paid To (Supplier) *
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                  value={formData.partyId}
                  onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400">₹</span>
                    <input
                      required
                      type="number"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                <div className="flex space-x-2">
                  {['CASH', 'ONLINE', 'CHEQUE'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFormData({ ...formData, mode: mode as any })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border ${
                        formData.mode === mode
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({
                      partyId: '',
                      amount: 0,
                      date: new Date().toISOString().split('T')[0],
                      mode: 'CASH',
                      notes: '',
                    });
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default PaymentOut;
