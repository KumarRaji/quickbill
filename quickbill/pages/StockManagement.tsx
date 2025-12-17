import React, { useState, useEffect } from 'react';
import { StockService, StockItem, SupplierService, Supplier } from '../services/api';
import { Plus, Search, Package, ArrowRight, Edit2, Trash2, X, Barcode, Upload } from 'lucide-react';

interface StockManagementProps {
  onRefresh: () => void;
}

const StockManagement: React.FC<StockManagementProps> = ({ onRefresh }) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState<Partial<StockItem>>({
    name: '',
    code: '',
    barcode: '',
    supplier_id: '',
    purchase_price: 0,
    quantity: 0,
    unit: 'PCS',
  });

  const [moveData, setMoveData] = useState({
    selling_price: 0,
    mrp: 0,
    tax_rate: 0,
  });

  const fetchStock = async () => {
    const data = await StockService.getAll();
    setStock(data);
  };

  const fetchSuppliers = async () => {
    const data = await SupplierService.getAll();
    setSuppliers(data);
  };

  useEffect(() => {
    fetchStock();
    fetchSuppliers();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      barcode: '',
      supplier_id: '',
      purchase_price: 0,
      quantity: 0,
      unit: 'PCS',
    });
    setSelectedStock(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.purchase_price || !formData.quantity) return;

    setLoading(true);
    try {
      if (selectedStock) {
        await StockService.update(selectedStock.id, formData);
      } else {
        await StockService.create(formData as Omit<StockItem, 'id'>);
      }
      resetForm();
      setIsModalOpen(false);
      await fetchStock();
      onRefresh();
    } catch (error) {
      console.error(error);
      alert('Failed to save stock');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: StockItem) => {
    setSelectedStock(item);
    setFormData({
      name: item.name,
      code: item.code,
      barcode: item.barcode,
      supplier_id: item.supplier_id,
      purchase_price: item.purchase_price,
      quantity: item.quantity,
      unit: item.unit,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this stock item?')) return;
    try {
      await StockService.delete(id);
      await fetchStock();
      onRefresh();
    } catch (error) {
      console.error(error);
      alert('Failed to delete stock');
    }
  };

  const handleMoveToItems = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || !moveData.selling_price || !moveData.tax_rate) return;

    setLoading(true);
    try {
      await StockService.moveToItems(selectedStock.id, moveData);
      setIsMoveModalOpen(false);
      setSelectedStock(null);
      setMoveData({ selling_price: 0, mrp: 0, tax_rate: 0 });
      await fetchStock();
      onRefresh();
      alert('Stock moved to Items successfully!');
    } catch (error) {
      console.error(error);
      alert('Failed to move stock to items');
    } finally {
      setLoading(false);
    }
  };

  const filteredStock = stock.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.barcode && s.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredStock.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedStock = filteredStock.slice(startIndex, startIndex + pageSize);

  const handlePrevious = () => setPage((prev) => Math.max(1, prev - 1));
  const handleNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

  const stats = {
    totalItems: stock.length,
    totalValue: stock.reduce((sum, s) => sum + (s.purchase_price * s.quantity), 0),
    lowStock: stock.filter((s) => s.quantity <= 5).length,
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Stock Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Upload size={18} />
            <span>Bulk Upload</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus size={18} />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Products</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.totalItems}</h3>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Package size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Stock Value</p>
            <h3 className="text-2xl font-bold text-slate-800">
              ₹{stats.totalValue.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <ArrowRight size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500 font-medium">Low Stock Items</p>
            <h3 className="text-2xl font-bold text-orange-600">{stats.lowStock}</h3>
          </div>
          <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
            <ArrowRight size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search stock by item name or code..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-medium text-slate-600">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
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
          <table className="w-full text-left">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">ITEM Info</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Purchase Price</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Quantity</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStock.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      {item.code && <span>Code: {item.code}</span>}
                      {item.code && item.barcode && <span className="mx-1">•</span>}
                      {item.barcode && (
                        <span className="flex items-center gap-1">
                          <Barcode size={12} />
                          {item.barcode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{item.supplier_name || '-'}</td>
                  <td className="px-6 py-4 text-right text-slate-600">₹{Number(item.purchase_price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        item.quantity <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStock(item);
                          setMoveData({
                            selling_price: item.purchase_price * 1.2,
                            mrp: item.purchase_price * 1.3,
                            tax_rate: 18,
                          });
                          setIsMoveModalOpen(true);
                        }}
                        className="text-green-600 hover:text-green-700"
                        title="Move to Items"
                      >
                        <ArrowRight size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStock.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Package size={48} className="mx-auto mb-2 opacity-20" />
                    No stock items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredStock.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-medium">
                {startIndex + 1}–
                {Math.min(startIndex + paginatedStock.length, filteredStock.length)}
              </span>{' '}
              of <span className="font-medium">{filteredStock.length}</span> items
            </p>

            <div className="inline-flex items-center gap-2 text-sm">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">
                {currentPage}
              </span>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{selectedStock ? 'Edit Stock' : 'Add Stock'}</h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Code</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="PCS">Pieces</option>
                    <option value="kg">Kilogram</option>
                    <option value="ltr">Liter</option>
                    <option value="box">Box</option>
                    <option value="mtr">Meter</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move to Items Modal */}
      {isMoveModalOpen && selectedStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Move to Items Master</h2>
              <button onClick={() => { setIsMoveModalOpen(false); setSelectedStock(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMoveToItems} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-sm font-medium text-blue-900">{selectedStock.name}</p>
                <p className="text-xs text-blue-600">Purchase Price: ₹{selectedStock.purchase_price}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={moveData.selling_price}
                  onChange={(e) => setMoveData({ ...moveData, selling_price: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MRP</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={moveData.mrp}
                  onChange={(e) => setMoveData({ ...moveData, mrp: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={moveData.tax_rate}
                  onChange={(e) => setMoveData({ ...moveData, tax_rate: parseFloat(e.target.value) })}
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => { setIsMoveModalOpen(false); setSelectedStock(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Moving...' : 'Move to Items'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Bulk Upload Stock</h2>
              <button onClick={() => { setIsBulkModalOpen(false); setBulkFile(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600">
                Upload <b>.csv</b> or <b>.xlsx</b> with columns:
                <div className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono">
                  name, code, barcode, supplier_id, purchase_price, quantity, unit
                </div>
              </div>
              <button
                onClick={() => {
                  const csv = 'name,code,barcode,supplier_id,purchase_price,quantity,unit\nSample Item,ITEM-001,1234567890123,,100,50,PCS\n';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'stock_sample.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm w-fit"
              >
                Download Sample CSV
              </button>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={loading}
              />
              {bulkFile && <p className="text-xs text-slate-500">Selected: <span className="font-medium">{bulkFile.name}</span></p>}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => { setIsBulkModalOpen(false); setBulkFile(null); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  disabled={loading || !bulkFile}
                  onClick={async () => {
                    if (!bulkFile) return;
                    setLoading(true);
                    try {
                      const result = await StockService.bulkUpload(bulkFile);
                      alert(`${result.message}\nRows: ${result.totalRows}\nAffected: ${result.affectedRows}`);
                      setIsBulkModalOpen(false);
                      setBulkFile(null);
                      fetchStock();
                    } catch (error: any) {
                      alert(error.message || 'Bulk upload failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
