

import React, { useState } from 'react';
import { Item, UserRole } from '../types';
import { Search, Plus, Edit2, Archive, Trash2, ScanBarcode, CheckCircle2 } from 'lucide-react';
import { ItemService } from '../services/api';
import { X } from 'lucide-react';

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
    stock: 0,
    unit: 'pcs',
    taxRate: 0
  });
  const [loading, setLoading] = useState(false);

  // Both Admin and Super Admin can manage items fully
  const canDelete = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.barcode && i.barcode.includes(searchTerm))
  );

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
      name: '', code: '', barcode: '', sellingPrice: 0, purchasePrice: 0, stock: 0, unit: 'pcs', taxRate: 0 
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

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent) => {
    // If it's a keyboard event, only trigger on Enter
    if ((e as React.KeyboardEvent).key && (e as React.KeyboardEvent).key !== 'Enter') {
      return;
    }
    
    e.preventDefault();
    const code = formData.barcode?.trim();
    if (!code) return;

    const found = items.find(i => i.barcode === code);
    
    if (found) {
       // If we are already editing this item, do nothing
       if (found.id === editingId) return;

       const confirmLoad = window.confirm(`Product "${found.name}" found with this barcode. Do you want to load its details for editing?`);
       if (confirmLoad) {
         setEditingId(found.id);
         setFormData(found);
       }
    } else {
      // If not found, we could potentially query an external API here in the future
      // For now, we just indicate it's a new barcode
      // window.alert('No existing item found. You can add details for this new barcode.');
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
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Name, Code or Barcode..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Item Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Selling Price</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Purchase Price</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Stock</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="flex space-x-3 text-xs text-slate-400 mt-1">
                      {item.code && <span>Code: {item.code}</span>}
                      {item.barcode && <span className="flex items-center"><ScanBarcode size={10} className="mr-1"/> {item.barcode}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-700">
                    ₹{item.sellingPrice}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                    ₹{item.purchasePrice}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      item.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
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
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Item' : 'Add New Item'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                 <label className="block text-sm font-bold text-blue-800 mb-1 flex items-center">
                    <ScanBarcode size={16} className="mr-2" /> 
                    Scan Barcode
                 </label>
                 <div className="flex space-x-2">
                    <input 
                      type="text" 
                      className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      value={formData.barcode}
                      onChange={e => setFormData({...formData, barcode: e.target.value})}
                      onKeyDown={handleBarcodeScan}
                      placeholder="Scan barcode here + Enter..."
                      autoFocus={!editingId}
                    />
                    <button 
                      type="button"
                      onClick={(e) => handleBarcodeScan(e)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      title="Search Item"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                 </div>
                 <p className="text-xs text-blue-600 mt-1">
                    Press Enter to auto-fill details if item exists.
                 </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Code / SKU</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price *</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.sellingPrice || ''}
                    onChange={e => setFormData({...formData, sellingPrice: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.purchasePrice || ''}
                    onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">
                     {editingId ? 'Stock Qty' : 'Opening Stock *'}
                   </label>
                   <input 
                    required
                    type="number" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.stock || ''}
                    onChange={e => setFormData({...formData, stock: parseFloat(e.target.value)})}
                  />
                </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                   <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                   >
                     <option value="pcs">Pieces</option>
                     <option value="kg">Kg</option>
                     <option value="ltr">Liters</option>
                     <option value="m">Meters</option>
                     <option value="box">Box</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate %</label>
                   <input 
                    type="number" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.taxRate || ''}
                    onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              
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
