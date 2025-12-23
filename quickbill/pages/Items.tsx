import React, { useState, useRef } from 'react';
import { Item, UserRole } from '../types';
import { Search, Plus, Edit2, Trash2, ScanBarcode, X, Upload, Sparkles, Printer } from 'lucide-react';
import { ItemService } from '../services/api';
import Barcode from 'react-barcode';
import JsBarcode from 'jsbarcode';

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

  // ✅ Bulk upload states
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const barcodeRef = useRef<HTMLDivElement>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const canDelete = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  // Generate random barcode (EAN-13 format)
  const generateBarcode = () => {
    const randomDigits = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
    setFormData({ ...formData, barcode: randomDigits });
    setShowBarcodePreview(true);
  };

  // Print barcode
  const printBarcode = () => {
    if (!barcodeRef.current) return;
    const printWindow = window.open('', '', 'width=600,height=400');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcodes</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: Arial; }
            .barcode-container { text-align: center; }
          </style>
        </head>
        <body>
          <div class="barcode-container">${barcodeRef.current.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 100);
    }, 500);
  };

  // Print selected barcodes
  const printSelectedBarcodes = () => {
    const itemsToPrint = items.filter(item => selectedItems.includes(item.id) && item.barcode);
    if (itemsToPrint.length === 0) {
      alert('No items with barcodes selected');
      return;
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    
    itemsToPrint.forEach(item => {
      const container = document.createElement('div');
      container.style.cssText = 'page-break-inside: avoid; margin: 20px; text-align: center; display: inline-block; width: 200px;';
      const itemNameDiv = document.createElement('div');
      itemNameDiv.style.cssText = 'font-size: 14px; margin-bottom: 3px; color: #333; font-weight: bold;';
      itemNameDiv.textContent = item.name;
      const mrpDiv = document.createElement('div');
      mrpDiv.style.cssText = 'font-size: 11px; margin-bottom: 5px;';
      mrpDiv.textContent = item.mrp && item.mrp > 0 ? `MRP: ₹${item.mrp}` : '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.appendChild(itemNameDiv);
      container.appendChild(mrpDiv);
      container.appendChild(svg);
      tempDiv.appendChild(container);
    });
    
    setTimeout(() => {
      const svgs = tempDiv.querySelectorAll('svg');
      itemsToPrint.forEach((item, idx) => {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, item.barcode, { width: 1.5, height: 50, fontSize: 12 });
        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        svgs[idx].parentElement?.replaceChild(img, svgs[idx]);
      });
      
      setTimeout(() => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) {
          document.body.removeChild(tempDiv);
          return;
        }
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Barcodes</title>
              <style>
                body { font-family: Arial; padding: 20px; }
                @media print { body { padding: 10px; } }
              </style>
            </head>
            <body>${tempDiv.innerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => printWindow.close(), 100);
          document.body.removeChild(tempDiv);
        }, 250);
      }, 100);
    }, 100);
  };

  // Toggle item selection
  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select all items
  const selectAllItems = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id));
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (i.barcode && i.barcode.includes(searchTerm))
  );

  // ✅ Pagination
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
    } catch (error: any) {
      alert(error.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Download sample CSV
  const downloadSampleCSV = () => {
    const header =
      'name,code,barcode,sellingPrice,purchasePrice,mrp,stock,unit,taxRate\n';
    const sample =
      'Pen,PEN-01,8901234567890,10,6,12,100,pcs,0\n';
    const blob = new Blob([header + sample], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ✅ Bulk Upload submit
  const handleBulkUpload = async () => {
    if (!bulkFile) return alert('Please choose a file');

    setBulkLoading(true);
    try {
      const result = await ItemService.bulkUpload(bulkFile);

      alert(
        `${result?.message || 'Upload completed'}\nRows: ${
          result?.totalRows ?? '-'
        }\nAffected: ${result?.affectedRows ?? '-'}`
      );

      setBulkOpen(false);
      setBulkFile(null);
      onRefresh();
    } catch (e: any) {
      alert(e.message || 'Bulk upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Items</h1>

        {/* ✅ Buttons */}
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <button
              onClick={printSelectedBarcodes}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Printer size={18} />
              <span>Print Barcodes ({selectedItems.length})</span>
            </button>
          )}
          
          <button
            onClick={() => setBulkOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Upload size={18} />
            <span>Bulk Upload</span>
          </button>

          <button
            onClick={handleAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            <span>Add Item</span>
          </button>
        </div>
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
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-12">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                    onChange={selectAllItems}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
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
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">
                  Tax Rate (%)
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
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
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

                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                    {item.taxRate}%
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
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
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
      </div>

      {/* Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
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

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Item Code
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.barcode || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, barcode: e.target.value });
                        setShowBarcodePreview(!!e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      onClick={generateBarcode}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1"
                      title="Generate Barcode"
                    >
                      <Sparkles size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    MRP
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.mrp ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setFormData({ ...formData, mrp: !isNaN(value) ? value : undefined });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Selling Price *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.sellingPrice ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setFormData({
                        ...formData,
                        sellingPrice: !isNaN(value) ? value : undefined,
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purchase Price *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.purchasePrice ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setFormData({
                        ...formData,
                        purchasePrice: !isNaN(value) ? value : undefined,
                      });
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stock (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.stock ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setFormData({ ...formData, stock: !isNaN(value) ? value : undefined });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit *
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.unit || 'pcs'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilogram</option>
                    <option value="ltr">Liter</option>
                    <option value="box">Box</option>
                    <option value="mtr">Meter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.taxRate ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setFormData({ ...formData, taxRate: !isNaN(value) ? value : undefined });
                    }}
                  />
                </div>
              </div>

              {showBarcodePreview && formData.barcode && formData.barcode.length >= 8 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-slate-600">Barcode Preview:</p>
                    <button
                      type="button"
                      onClick={printBarcode}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-xs"
                    >
                      <Printer size={14} />
                      Print
                    </button>
                  </div>
                  <div ref={barcodeRef} className="flex justify-center">
                    <Barcode value={formData.barcode} width={1.5} height={50} fontSize={12} />
                  </div>
                </div>
              )}

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

      {/* ✅ Bulk Upload Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Bulk Upload Items</h2>
              <button
                onClick={() => {
                  if (!bulkLoading) {
                    setBulkOpen(false);
                    setBulkFile(null);
                  }
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600">
                Upload <b>.csv</b> or <b>.xlsx</b> with columns:
                <div className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono">
                  name, code, barcode, sellingPrice, purchasePrice, mrp, stock, unit, taxRate
                </div>
              </div>

              <button
                onClick={downloadSampleCSV}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm w-fit"
              >
                Download Sample CSV
              </button>

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={bulkLoading}
              />

              {bulkFile && (
                <p className="text-xs text-slate-500">
                  Selected: <span className="font-medium">{bulkFile.name}</span>
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    if (!bulkLoading) {
                      setBulkOpen(false);
                      setBulkFile(null);
                    }
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={bulkLoading}
                >
                  Cancel
                </button>

                <button
                  disabled={bulkLoading || !bulkFile}
                  onClick={handleBulkUpload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {bulkLoading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Items;
