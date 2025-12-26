import React, { useState } from 'react';
import { Party } from '../types';
import { Search, Plus, Phone, MapPin, Edit2, Trash2 } from 'lucide-react';
import { PartyService } from '../services/api';

interface PartiesProps {
  parties: Party[];
  onRefresh: () => void;
}

const Parties: React.FC<PartiesProps> = ({ parties, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Party>>({
    name: '',
    phone: '',
    gstin: '',
    address: '',
    balance: 0,
    type: 'CUSTOMER'
  });
  const [loading, setLoading] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // 🔹 Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);


  const filteredParties = parties.filter(p =>
    (p.type === 'CUSTOMER' || !p.type) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.phone && p.phone.includes(searchTerm)))
  );

  const totalPages = Math.max(1, Math.ceil(filteredParties.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedParties = filteredParties.slice(startIndex, startIndex + pageSize);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = { ...formData, type: 'CUSTOMER' as const, balance: formData.balance ?? 0 };
      if (editingParty) {
        await PartyService.update(editingParty.id, dataToSave);
      } else {
        await PartyService.create(dataToSave as Party);
      }
      setFormData({ name: '', phone: '', gstin: '', address: '', balance: 0, type: 'CUSTOMER' });
      setEditingParty(null);
      setIsModalOpen(false);
      onRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (party: Party) => {
    setEditingParty(party);
    setFormData(party);
    setIsModalOpen(true);
  };

  const handleDelete = async (party: Party) => {
    if (confirm(`Are you sure you want to delete ${party.name}?`)) {
      try {
        await PartyService.delete(party.id);
        onRefresh();
      } catch (error: any) {
        console.error(error);
        const message = error.message || 'Failed to delete party';
        alert(message);
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingParty(null);
    setFormData({ name: '', phone: '', gstin: '', address: '', balance: 0, type: 'CUSTOMER' });
  };

  const handlePrevious = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Customers</h1>
          <button
            onClick={() => {
              setEditingParty(null);
              setFormData({ name: '', phone: '', gstin: '', address: '', balance: 0, type: 'CUSTOMER' });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-xs sm:text-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Customer</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Search */}
              <div className="relative w-full sm:max-w-md">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search customers by name or phone..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Rows dropdown */}
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-medium text-slate-600">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 sm:px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    Name
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    Phone
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    Balance
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {paginatedParties.map((party) => (
                  <tr key={party.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900 text-sm">{party.name}</div>
                      {party.gstin && (
                        <div className="text-xs text-slate-400 mt-1">GST: {party.gstin}</div>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-slate-600 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <Phone size={14} />
                        <span>{party.phone}</span>
                      </div>
                    </td>
                    <td
                      className={`px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap font-medium text-xs sm:text-sm ${party.balance > 0
                        ? 'text-green-600'
                        : party.balance < 0
                          ? 'text-red-600'
                          : 'text-slate-600'
                        }`}
                    >
                      ₹{Math.abs(party.balance).toLocaleString()}{' '}
                      {party.balance > 0 ? 'Cr' : party.balance < 0 ? 'Dr' : ''}
                    </td>
                    <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => handleEdit(party)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(party)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredParties.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 lg:px-6 py-12 text-center text-xs sm:text-sm text-slate-400">
                      No customers found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden overflow-auto flex-1 p-3 space-y-3">
            {paginatedParties.map((party) => (
              <div key={party.id} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2">
                <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-200">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">{party.name}</div>
                    {party.gstin && (
                      <div className="text-xs text-slate-400 mt-1">GST: {party.gstin}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-xs py-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} />
                    <span>{party.phone}</span>
                  </div>
                  {party.address && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{party.address}</span>
                    </div>
                  )}
                </div>
                <div className="py-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Balance: </span>
                  <span
                    className={`font-medium text-sm ${party.balance > 0
                      ? 'text-green-600'
                      : party.balance < 0
                        ? 'text-red-600'
                        : 'text-slate-600'
                      }`}
                  >
                    ₹{Math.abs(party.balance).toLocaleString()}{' '}
                    {party.balance > 0 ? 'Cr' : party.balance < 0 ? 'Dr' : ''}
                  </span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleEdit(party)}
                    className="flex-1 px-2 py-1.5 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(party)}
                    className="flex-1 px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filteredParties.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">No customers found matching your search.</div>
            )}
          </div>

          {/* 🔹 Pagination bar */}
          {filteredParties.length > 0 && (
            <div className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <p className="text-xs text-slate-500 order-2 sm:order-1">
                Showing{' '}
                <span className="font-medium">
                  {startIndex + 1}–
                  {Math.min(startIndex + paginatedParties.length, filteredParties.length)}
                </span>{' '}
                of <span className="font-medium">{filteredParties.length}</span> customers
              </p>

              <div className="inline-flex items-center gap-2 text-xs sm:text-sm order-1 sm:order-2 w-full sm:w-auto">
                <button
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                  className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Prev
                </button>

                <span className="px-2 sm:px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                  {currentPage}
                </span>

                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {editingParty ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    required
                    type="tel"
                    maxLength={15}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                  Opening Balance
                </label>
                <input
                  type="number"
                  step="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.balance ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setFormData({
                      ...formData,
                      balance: e.target.value === '' ? undefined : value,
                    });
                  }}
                />
              </div>

              <div className="pt-3 sm:pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Saving...' : editingParty ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple X icon component for the modal since it's used inside
const X = ({ size = 24 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default Parties;
