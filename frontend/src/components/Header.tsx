"use client";

import { Search, Bell, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { user, isAdmin } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/80 h-20 flex items-center justify-between px-8 sticky top-0 z-10 transition-all">
      <div className="flex items-center flex-1">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search OSCA IDs, names, or reference numbers..." 
            className="w-full pl-11 pr-4 py-2.5 bg-slate-100/70 border border-transparent rounded-full focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm text-slate-700 font-medium placeholder:text-slate-400 transition-all shadow-inner"
          />
        </div>
      </div>
      <div className="flex items-center space-x-5">
        {/* Role Badge */}
        {user && (
          <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${
            isAdmin 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isAdmin ? '🕵️ Admin Mode' : '👨‍💻 Staff Mode'}
          </span>
        )}
        <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative">
          <Bell size={22} />
          <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
        </button>
        <div className={`h-10 w-10 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:-translate-y-0.5 transition-all ${
          isAdmin
            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30'
            : 'bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-indigo-500/30'
        }`}>
          <User size={18} />
        </div>
      </div>
    </header>
  );
}
