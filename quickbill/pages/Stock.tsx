
import React, { useState, useMemo } from 'react';
import { Item, UserRole } from '../types';
import { ItemService } from '../services/api';
import { Search, Boxes, ArrowUpCircle, ArrowDownCircle, AlertTriangle, X } from 'lucide-react';

interface StockProps {
  items: Item[];
  onRefresh: () => void;
  userRole?: UserRole;
}

const Stock: React.FC<StockProps> = ({ items, onRefresh, userRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REDUCE'>('ADD');
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentRemark, setAdjustmentRemark] = useState('');
  const [loading, setLoading] = useState(false);

  // Allow Super Admin to adjust stock too
  const canAdjust = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.code && i.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalValue = items.reduce((sum, i) => sum + (i.stock * i.purchasePrice), 0);
    const lowStock = items.filter(i => i.stock <= 5).length;
    return { totalItems, totalValue, lowStock };
  }, [items]);

  const openAdjustmentModal = (item: Item) => {
    setSelectedItem(item);
    setAdjustmentType('ADD');
    setAdjustmentQty(0);
    setAdjustmentRemark('');
    setIsModalOpen(true);
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !adjustmentQty) return;

    setLoading(true);
    try {
      // Calculate actual change: ADD = +qty, REDUCE = -qty
      const change = adjustmentType === 'ADD' ? adjustmentQty : -adjustmentQty;
      await ItemService.adjustStock(selectedItem.id, change);
      
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
        <h1 className="text-2xl font-bold text-slate-800">Stock Management</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div>
               <p className="text-sm text-slate-500 font-medium">Total Products</p>
               <h3 className="text-2xl font-bold text-slate-800">{stats.totalItems}</h3>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
               <Boxes size={24} />
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div>
               <p className="text-sm text-slate-500 font-medium">Total Stock Value</p>
               <h3 className="text-2xl font-bold text-slate-800">₹{stats.totalValue.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
               <ArrowUpCircle size={24} />
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div>
               <p className="text-sm text-slate-500 font-medium">Low Stock Items</p>
               <h3 className="text-2xl font-bold text-orange-600">{stats.lowStock}</h3>
            </div>
            <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
               <AlertTriangle size={24} />
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search stock by item name or code..." 
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
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Purchase Price</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Current Stock</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Stock Value</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    {item.code && <div className="text-xs text-slate-400">Code: {item.code}</div>}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-slate-500">
                    ₹{item.purchasePrice}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-800">
                     ₹{(item.stock * item.purchasePrice).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {canAdjust ? (
                      <button 
                        onClick={() => openAdjustmentModal(item)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                      >
                        Adjust Stock
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Restricted</span>
                    )}
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

       {/* Adjustment Modal */}
       {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Adjust Stock</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdjustment} className="p-6 space-y-4">
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                 <div className="text-sm text-slate-500">Item Name</div>
                 <div className="font-bold text-slate-800">{selectedItem.name}</div>
                 <div className="flex justify-between mt-2 text-sm">
                    <span>Current Stock:</span>
                    <span className="font-bold">{selectedItem.stock} {selectedItem.unit}</span>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Adjustment Type</label>
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={() => setAdjustmentType('ADD')}
                        className={`flex-1 py-2 flex items-center justify-center space-x-2 rounded-lg border ${
                            adjustmentType === 'ADD' 
                            ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <ArrowUpCircle size={16} />
                        <span>Add (+)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setAdjustmentType('REDUCE')}
                        className={`flex-1 py-2 flex items-center justify-center space-x-2 rounded-lg border ${
                            adjustmentType === 'REDUCE' 
                            ? 'bg-red-50 border-red-500 text-red-700 font-bold' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <ArrowDownCircle size={16} />
                        <span>Reduce (-)</span>
                    </button>
                </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">
                    {adjustmentType === 'ADD' ? 'Quantity to Add' : 'Quantity to Reduce'} *
                 </label>
                 <input 
                    required
                    type="number" 
                    min="0.1"
                    step="any"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={adjustmentQty || ''}
                    onChange={e => setAdjustmentQty(parseFloat(e.target.value))}
                 />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea 
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={adjustmentRemark}
                  onChange={e => setAdjustmentRemark(e.target.value)}
                  placeholder="e.g., Opening Stock, Damage, Theft..."
                />
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
                  {loading ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;