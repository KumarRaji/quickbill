
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { UserService } from '../services/api';
import { Plus, Search, ShieldCheck, Trash2, User as UserIcon } from 'lucide-react';
import { X } from 'lucide-react';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'STAFF' as UserRole
  });

  const fetchUsers = async () => {
    try {
      const data = await UserService.getAll();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.name || !formData.username || !formData.password) return;
    setError('');
    setLoading(true);

    try {
      await UserService.create(formData);
      setFormData({ name: '', username: '', password: '', role: 'STAFF' });
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('Are you sure you want to delete this user?')) {
        try {
            await UserService.delete(id);
            fetchUsers();
        } catch (err: any) {
            alert(err.message);
        }
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
           <p className="text-slate-500 text-sm">Create and manage access for your team</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Create New User</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">User Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Username</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                    <div className="flex items-center space-x-3">
                        <div className="bg-slate-100 p-2 rounded-full">
                            <UserIcon size={16} className="text-slate-500" />
                        </div>
                        <span>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    @{u.username}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.role !== 'SUPER_ADMIN' && (
                        <button 
                          onClick={() => handleDelete(u.id)}
                          className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Create User</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input 
                    required
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                <input 
                    required
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <input 
                    required
                    type="password" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                >
                    <option value="STAFF">Staff (Limited Access)</option>
                    <option value="ADMIN">Admin (Full Access)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                    {formData.role === 'STAFF' 
                        ? 'Staff can only create invoices and view items. No delete/report access.'
                        : 'Admins can view reports, adjust stock, and delete items.'
                    }
                </p>
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
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;