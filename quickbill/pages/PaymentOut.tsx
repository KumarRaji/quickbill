
import React, { useState, useEffect } from 'react';
import { Party, Payment } from '../types';
import { PaymentService } from '../services/api';
import { Plus, Search, TrendingUp, Calendar } from 'lucide-react';
import { X } from 'lucide-react';

interface PaymentOutProps {
  parties: Party[];
  onRefresh: () => void;
}

const PaymentOut: React.FC<PaymentOutProps> = ({ parties, onRefresh }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Payment>>({
    partyId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    mode: 'CASH',
    note: ''
  });

  const fetchPayments = async () => {
    const data = await PaymentService.getAll();
    setPayments(data.filter(p => p.type === 'OUT'));
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.partyId || !formData.amount) return;

    setLoading(true);
    try {
      const selectedParty = parties.find(p => p.id === formData.partyId);
      await PaymentService.create({
          ...formData,
          partyName: selectedParty?.name || 'Unknown',
          type: 'OUT'
      } as Payment);
      
      setFormData({ 
        partyId: '', amount: 0, date: new Date().toISOString().split('T')[0], mode: 'CASH', note: '' 
      });
      setIsModalOpen(false);
      fetchPayments();
      onRefresh(); // Refresh parent data
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => 
    p.partyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Payment Out (Supplier Payments)</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Record Payment</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by supplier name..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Paid To</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Mode</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    <div className="flex items-center space-x-2">
                       <Calendar size={14} />
                       <span>{new Date(payment.date).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    {payment.partyName}
                    {payment.note && <div className="text-xs text-slate-400 font-normal mt-0.5">{payment.note}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                        {payment.mode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-orange-600">
                    - ₹{payment.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                   <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <TrendingUp size={48} className="mx-auto mb-2 opacity-20" />
                      No payments made yet.
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
              <h2 className="text-lg font-bold text-slate-800">Record Payment Out</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paid To (Supplier) *</label>
                <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                    value={formData.partyId}
                    onChange={(e) => setFormData({...formData, partyId: e.target.value})}
                >
                    <option value="">Select Party</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                            onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input 
                        type="date" 
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                 </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                  <div className="flex space-x-2">
                      {['CASH', 'ONLINE', 'CHEQUE'].map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setFormData({...formData, mode: mode as any})}
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
  );
};

export default PaymentOut;
