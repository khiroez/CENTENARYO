"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Home, Users, FileText, AlertTriangle, Settings, Activity, ClipboardList, LogOut, Shield, UserCircle } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  // RBAC: Define which links are visible per role
  const navLinks = [
    { name: 'Dashboard', href: '/', icon: Home, roles: ['STAFF', 'ADMIN'] },
    { name: 'Senior Registry', href: '/seniors', icon: Users, roles: ['STAFF', 'ADMIN'] },
    { name: 'Disbursements', href: '/disbursements', icon: FileText, roles: ['STAFF', 'ADMIN'] },
    { name: 'Anomaly Review', href: '/anomalies', icon: AlertTriangle, roles: ['ADMIN'] },
    { name: 'Audit Logs', href: '/auditlogs', icon: ClipboardList, roles: ['ADMIN'] },
  ];

  // Filter links based on user role
  const visibleLinks = navLinks.filter(link => 
    user && link.roles.includes(user.role)
  );

  return (
    <aside className="w-72 bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white min-h-screen hidden md:flex flex-col border-r border-slate-800 shadow-2xl z-20">
      <div className="p-6 flex items-center space-x-3 border-b border-white/5">
        <div className="bg-indigo-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
          <Activity className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">CENTENARYO</h1>
          <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mt-0.5">
            {isAdmin ? 'Admin Portal' : 'Staff Portal'}
          </p>
        </div>
      </div>
      
      <div className="px-4 py-6 flex-1">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-2">Main Navigation</p>
        <nav className="space-y-1.5">
          {visibleLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all group relative overflow-hidden ${
                  isActive 
                    ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                    : 'hover:bg-slate-800/60 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent transition-opacity"></div>
                )}
                <Icon size={20} className={`relative z-10 ${isActive ? '' : 'group-hover:text-indigo-400 transition-colors'}`} />
                <span className={`relative z-10 ${isActive ? '' : 'font-medium group-hover:translate-x-1 transition-transform'}`}>
                  {link.name}
                </span>
                {link.roles.length === 1 && link.roles[0] === 'ADMIN' && (
                  <Shield size={12} className="relative z-10 ml-auto text-amber-500/60" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* User Profile Card + Logout */}
      <div className="p-4 border-t border-white/5 space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
              isAdmin 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              <UserCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${
                isAdmin ? 'text-emerald-400' : 'text-blue-400'
              }`}>
                {user.role === 'ADMIN' ? '🕵️ Admin' : '👨‍💻 Staff'}
              </p>
            </div>
          </div>
        )}

        <button 
          onClick={logout}
          className="flex items-center justify-center space-x-2 px-4 py-3 w-full bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-400 hover:text-rose-300 transition-all border border-rose-500/10 hover:border-rose-500/30"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm">Mag-sign out</span>
        </button>
      </div>
    </aside>
  );
}
