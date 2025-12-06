
import React, { useState, useEffect } from 'react';
import { Expense } from '../types';
import { ExpenseService } from '../services/api';
import { Plus, Search, Wallet, Calendar } from 'lucide-react';
import { X } from 'lucide-react';

interface ExpensesProps {
  onRefresh: () => void;
}

const Expenses: React.FC<ExpensesProps> = ({ onRefresh }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Expense>>({
    category: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const CATEGORIES = ['Rent', 'Salaries', 'Electricity', 'Internet', 'Office Supplies', 'Travel', 'Food', 'Other'];

  const fetchExpenses = async () => {
    const data = await ExpenseService.getAll();
    setExpenses(data);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.category || !formData.amount) return;

    setLoading(true);
    try {
      await ExpenseService.create(formData as Expense);
      setFormData({ 
        category: '', amount: 0, date: new Date().toISOString().split('T')[0], note: '' 
      });
      setIsModalOpen(false);
      fetchExpenses();
      onRefresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.note && e.note.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
           <div className="text-sm text-slate-500">Total: <span className="font-bold text-slate-700">₹{totalExpense.toLocaleString()}</span></div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Add Expense</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Category</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Note</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    <div className="flex items-center space-x-2">
                       <Calendar size={14} />
                       <span>{new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                     <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full font-medium border border-red-100">
                        {expense.category}
                     </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-sm">
                    {expense.note || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-800">
                    ₹{expense.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                   <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <Wallet size={48} className="mx-auto mb-2 opacity-20" />
                      No expenses recorded yet.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Add Expense</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            value={formData.amount || ''}
                            onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input 
                        type="date" 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea 
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  placeholder="Optional description..."
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
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
