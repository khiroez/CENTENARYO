"use client";

import { Bell, User, AlertTriangle, Gift, FileWarning, CheckCircle, TrendingDown, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, NotificationType } from '@/context/NotificationContext';
import { useUI } from '@/context/UIContext';

export default function Header() {
  const { user, isAdmin } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { showModal } = useUI();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const getIcon = (type: NotificationType) => {
    switch (type) {
        case 'ML_FLAG': return <AlertTriangle className="text-rose-500" size={18} />;
        case 'MILESTONE': return <Gift className="text-emerald-500" size={18} />;
        case 'DOCUMENT': return <FileWarning className="text-rose-500" size={18} />;
        case 'PAYROLL': return <CheckCircle className="text-blue-500" size={18} />;
        case 'SECURITY': return <ShieldAlert className="text-amber-500" size={18} />;
        case 'BUDGET': return <TrendingDown className="text-indigo-500" size={18} />;
        default: return <Bell size={18} />;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notifId: string, link: string, targetId?: string | number) => {
    markAsRead(notifId);
    
    // RBAC Check for Restricted Links
    if (link.includes('/anomalies') && !isAdmin) {
      showModal('security', 'Access Restricted', "Admin-level clearance is required to review AI anomaly patterns and security logs. Please contact your supervisor for authorization.");
      setIsNotificationsOpen(false);
      return;
    }

    setIsNotificationsOpen(false);
    
    // Add targetId to link as query param for highlighting
    const finalLink = targetId ? `${link}?highlight=${targetId}` : link;
    router.push(finalLink);
  };

  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/80 h-20 flex items-center justify-between px-8 sticky top-0 z-[100] transition-all">
      <div className="flex items-center flex-1">
        {/* Search bar removed as requested */}
      </div>
      <div className="flex items-center space-x-5">
        {/* Role Badge */}
        {user && (
          <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${
            isAdmin 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' 
              : 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
          }`}>
            {isAdmin ? '🕵️ Admin Mode' : '👨‍💻 Staff Mode'}
          </span>
        )}

        {/* Notification Bell & Dropdown */}
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2.5 rounded-full transition-all relative ${
                    isNotificationsOpen ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isNotificationsOpen && (
                <div className="absolute right-0 mt-4 w-[380px] bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 z-[110]">
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Intelligence Feed</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Actionable Notifications</p>
                        </div>
                        <button 
                            onClick={() => setIsNotificationsOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto py-2 custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-12 text-center">
                                <Bell className="mx-auto text-slate-200 mb-4" size={40} />
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No new alerts</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div 
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif.id, notif.link, notif.targetId)}
                                    className={`px-6 py-5 hover:bg-slate-50 cursor-pointer transition-all border-b border-slate-50 last:border-0 group relative overflow-hidden ${!notif.isRead ? 'bg-indigo-50/30' : ''}`}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transition-transform origin-top ${notif.isRead ? 'scale-y-0 group-hover:scale-y-100' : 'scale-y-100'}`}></div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md transition-all group-hover:border-indigo-100 group-hover:bg-indigo-50/30">
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-sm font-black transition-colors ${notif.isRead ? 'text-slate-800 group-hover:text-indigo-600' : 'text-indigo-900'}`}>{notif.title}</h4>
                                                <span className="text-[10px] font-bold text-slate-400">{notif.time}</span>
                                            </div>
                                            <p className={`text-xs font-medium leading-relaxed ${notif.isRead ? 'text-slate-500' : 'text-slate-600'}`}>{notif.description}</p>
                                            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                Take Action Now →
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-5 bg-slate-50/50 text-center border-top border-slate-100">
                        <button 
                            onClick={markAllAsRead}
                            className="text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                        >
                            Mark All as Read
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
}

