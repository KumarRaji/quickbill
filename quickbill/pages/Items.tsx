import React, { useState } from 'react';
import { Item, UserRole } from '../types';
import { Search, Plus, Edit2, Trash2, ScanBarcode, X } from 'lucide-react';
import { ItemService } from '../services/api';

interface ItemsProps {
  items: Item[];
  onRefresh: () => void;
  userRole?: UserRole;
}

const Items: React.FC<ItemsProps> = ({ items, onRefresh, userRole }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Item>>({
    name: '',
    code: '',
    barcode: '',
    sellingPrice: 0,
    purchasePrice: 0,
    mrp: 0,
    stock: 0,
    unit: 'pcs',
    taxRate: 0,
  });

  const [loading, setLoading] = useState(false);

  // Both Admin and Super Admin can manage items fully
  const canDelete = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  // ✅ Filter first (so pagination can use it)
  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (i.barcode && i.barcode.includes(searchTerm))
  );

  // ✅ Pagination after filteredItems
  const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(10);
 

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const handlePrevious = () => setPage((prev) => Math.max(1, prev - 1));
  const handleNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

  const handleEdit = (item: Item) => {
    setEditingId(item.id);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      setLoading(true);
      try {
        await ItemService.delete(id);
        onRefresh();
      } catch (error: any) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      barcode: '',
      sellingPrice: 0,
      purchasePrice: 0,
      mrp: 0,
      stock: 0,
      unit: 'pcs',
      taxRate: 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await ItemService.update(editingId, formData);
      } else {
        await ItemService.create(formData as Item);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Items / Inventory</h1>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus size={18} />
          <span>Add Item</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
       <div className="p-4 border-b border-slate-200 bg-slate-50">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    
    {/* Search */}
    <div className="relative w-full sm:max-w-md">
      <Search
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
        size={18}
      />
      <input
        type="text"
        placeholder="Search by Name, Code or Barcode..."
        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setPage(1); // ✅ reset to first page on search
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
          setPage(1); // ✅ reset to first page when pageSize changes
        }}
        className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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


        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  Item Name
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                  MRP
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                  Selling Price
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                  Purchase Price
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">
                  Stock
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="flex space-x-3 text-xs text-slate-400 mt-1">
                      {item.code && <span>Code: {item.code}</span>}
                      {item.barcode && (
                        <span className="flex items-center">
                          <ScanBarcode size={10} className="mr-1" /> {item.barcode}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                    {item.mrp && item.mrp > 0 ? `₹${item.mrp}` : '-'}
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-700">
                    ₹{item.sellingPrice}
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                    ₹{item.purchasePrice}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.stock <= 5
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {item.stock} {item.unit}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>

                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ✅ Pagination bar (same style as Parties) */}
          {filteredItems.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-medium">
                  {startIndex + 1}–
                  {Math.min(startIndex + paginatedItems.length, filteredItems.length)}
                </span>{' '}
                of <span className="font-medium">{filteredItems.length}</span> items
              </p>

              <div className="inline-flex items-center gap-2 text-sm">
                <button
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                  {currentPage}
                </span>

                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* keep your other fields as-is */}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Items;
