
import React, { useState } from 'react';
import { User } from '../types';
import { AuthService } from '../services/api';
import { Lock, User as UserIcon, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await AuthService.login(username, password);
      onLogin(user);
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-2 sm:p-6">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg w-full max-w-xs sm:max-w-sm overflow-hidden flex flex-col">
        <div className="bg-blue-600 p-4 sm:p-6 text-center">
          <div className="w-11 sm:w-14 h-11 sm:h-14 bg-white rounded-lg flex items-center justify-center text-blue-600 font-bold text-lg sm:text-2xl mx-auto mb-2 sm:mb-3">
            Q
          </div>
          <h1 className="text-sm sm:text-xl font-bold text-white">Welcome to QuickBill</h1>
          <p className="text-blue-100 text-xs mt-0.5 sm:mt-1">Sign in to manage your business</p>
        </div>
        
        <div className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-2 sm:p-2.5 rounded text-xs text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs sm:text-sm"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 sm:py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-3 sm:mt-4 pt-3 sm:pt-3 border-t border-slate-100 text-center">
             <p className="text-[8px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Demo Credentials (user / pass):</p>
             <div className="flex justify-center flex-wrap gap-1 sm:gap-1.5 text-[8px] sm:text-xs">
               <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 sm:px-2 py-0.5 rounded">superadmin / password</span>
               <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1 sm:px-2 py-0.5 rounded">admin / password</span>
               <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1 sm:px-2 py-0.5 rounded">staff / password</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;