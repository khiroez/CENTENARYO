"use client";

import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, Activity, User, Clock, Database, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import { authFetch } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, actionFilter]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
      });
      if (actionFilter !== 'all') query.append('action', actionFilter);

      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/auditlogs/?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.results || []);
        setTotalRecords(data.count || 0);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuditLogs();
  };

  const renderActionBadge = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CREATE':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-black tracking-widest uppercase">CREATE</span>;
      case 'UPDATE':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-black tracking-widest uppercase">UPDATE</span>;
      case 'DELETE':
        return <span className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-black tracking-widest uppercase">DELETE</span>;
      case 'LOGIN':
        return <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-black tracking-widest uppercase">LOGIN</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black tracking-widest uppercase">{action || 'SYSTEM'}</span>;
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <div className="bg-slate-900 p-2.5 rounded-xl mr-4 text-white shadow-sm">
              <History size={28} />
            </div>
            System Audit Logs
            <ShieldCheck size={20} className="text-emerald-500 ml-3" />
          </h1>
          <p className="text-slate-500 mt-3 font-medium max-w-xl">
            Real-time tracking of all system modifications and user activities for regulatory compliance and fraud prevention.
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <form onSubmit={handleSearch} className="relative w-full md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={18} />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search User or Model..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all text-sm font-medium" />
          </form>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <Filter size={16} className="text-slate-400 mr-2" />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="bg-transparent text-xs font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer">
              <option value="all">ALL ACTIONS</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGINS</option>
            </select>
          </div>
          <button onClick={() => fetchAuditLogs()} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all shadow-sm"><RefreshCcw size={18} /></button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-8 py-5">Date & Time</th>
                <th className="px-8 py-5">User</th>
                <th className="px-8 py-5">Action</th>
                <th className="px-8 py-5">Target</th>
                <th className="px-8 py-5">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr><td colSpan={5} className="p-20 text-center"><div className="flex flex-col items-center gap-4"><div className="w-10 h-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div><span className="font-semibold text-slate-500">Accessing secure logs...</span></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center font-bold text-slate-400 uppercase tracking-widest">No audit trails found.</td></tr>
              ) : (
                logs.map((log) => {
                  const timeInfo = formatDateTime(log.created_at);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{timeInfo.date}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{timeInfo.time}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">
                            {log.user?.username?.substring(0, 2).toUpperCase() || "SY"}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{log.user?.username || "System Auto"}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{log.ip_address || "Internal"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">{renderActionBadge(log.action)}</td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <Database size={14} className="text-slate-300" />
                             <span className="font-black text-xs uppercase tracking-tighter text-slate-600">{log.target_model}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 ml-6">ID: {log.target_object_id?.substring(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="max-w-md truncate">
                          <span className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                             {log.changes_summary}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Logs: {totalRecords}</span>
          <div className="flex gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black disabled:opacity-30 hover:bg-slate-50 transition-all uppercase">Prev</button>
              <button disabled={currentPage >= Math.ceil(totalRecords / 50)} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black disabled:opacity-30 hover:bg-slate-800 transition-all uppercase shadow-lg shadow-slate-200">Next</button>
          </div>
      </div>

    </div>
  );
}
