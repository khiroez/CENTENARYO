"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Search, Filter, ShieldAlert, Activity, ChevronRight, ChevronLeft, User, MapPin, Phone, Briefcase, Users, FileText, X, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useSearchParams } from 'next/navigation';
import { useUI } from '@/context/UIContext';

export default function AnomalyReviewPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { addNotification } = useNotifications();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const rowRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});
  
  // Profile Modal State
  const [selectedSenior, setSelectedSenior] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const { showModal, showConfirm } = useUI();

  useEffect(() => {
    fetchAnomalies();
  }, []);

  // Scroll to highlight
  useEffect(() => {
    if (highlightId && !isLoading && anomalies.length > 0) {
      const timer = setTimeout(() => {
        const element = rowRefs.current[highlightId];
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [highlightId, isLoading, anomalies]);

  const fetchAnomalies = async (url?: string) => {
    setIsLoading(true);
    let targetUrl = url || `${process.env.NEXT_PUBLIC_API_URL}/anomalies/`;
    
    if (!url && searchQuery) {
        targetUrl += `?search=${encodeURIComponent(searchQuery)}`;
    }

    try {
      const res = await authFetch(targetUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
            setAnomalies(data.results);
            setNextPage(data.next);
            setPrevPage(data.previous);
            setTotalCount(data.count);
        } else {
            setAnomalies(data); 
            setTotalCount(data.length);
        }
      }
    } catch (error) {
      console.error("Error fetching anomalies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsSafe = async (id: number) => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/anomalies/${id}/mark_as_safe/`, {
        method: 'POST',
      });

      if (res.ok) {
        const anomaly = anomalies.find(a => a.id === id);
        setAnomalies(prev => prev.filter(a => a.id !== id));
        setTotalCount(prev => prev - 1);
        
        showModal('success', 'Anomaly Resolved', `Record for ${anomaly?.senior_name || 'Senior'} has been marked as SAFE.`);

        // TRIGGER NOTIFICATION
        addNotification({
          type: 'ML_FLAG',
          title: 'Anomaly Resolved',
          description: `Flag #${id} for ${anomaly?.senior_name || 'Senior'} was marked as SAFE.`,
          link: '/anomalies'
        });
      }
    } catch (error) {
      console.error("Error marking as safe:", error);
    }
  };

  const handleSuspendRecord = async (id: number) => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/anomalies/${id}/suspend_record/`, {
        method: 'POST',
      });

      if (res.ok) {
        setAnomalies(prev => prev.filter(a => a.id !== id));
        setTotalCount(prev => prev - 1);
        showModal('error', 'Record Suspended', 'The senior record has been frozen. All pending payouts are held until manual verification is complete.');
      }
    } catch (error) {
      console.error("Error suspending record:", error);
    }
  };

  const openConfirm = (type: 'safe' | 'suspend', flagId: number) => {
      if (type === 'safe') {
          showConfirm(
              'Mark Record as Safe?',
              'This will resolve the AI flag and confirm the record is legitimate. The senior will remain ACTIVE.',
              () => handleMarkAsSafe(flagId)
          );
      } else {
          showConfirm(
              'Hold Payout & Suspend?',
              'This will freeze all pending disbursements and mark the senior as SUSPENDED for manual LGU verification.',
              () => handleSuspendRecord(flagId)
          );
      }
  };

  const viewProfile = async (seniorId: number) => {
    try {
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${seniorId}/`);
        if (res.ok) {
            const data = await res.json();
            setSelectedSenior(data);
            setIsProfileModalOpen(true);
        }
    } catch (error) {
        console.error("Error fetching senior profile:", error);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex justify-between items-end bg-white p-8 rounded-3xl border border-rose-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <ShieldAlert size={32} className="mr-3 text-rose-500" />
            Anomaly Review 
          </h1>
          <p className="text-slate-500 mt-2 flex items-center font-medium">
            <Activity size={16} className="mr-2 text-rose-400" />
            Prescriptive Analytics: Review flagged records and take decisive action.
          </p>
        </div>
        
        {/* Search and Filter Controls */}
        <div className="relative z-10 flex gap-4">
          <button 
            onClick={async () => {
              setIsLoading(true);
              await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/ai-report/`);
              fetchAnomalies();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Activity size={18} />
            Refresh AI Scan
          </button>
          <div className="relative w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search Name or OSCA ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAnomalies()}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none text-sm font-medium transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Anomalies Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col relative">
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Pending Review Flags</h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">Showing {anomalies.length} of {totalCount} detected anomalies</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Flag ID</th>
                <th className="px-8 py-5">Senior Record</th>
                <th className="px-8 py-5">Anomaly Details (AI Reason)</th>
                <th className="px-8 py-5">Confidence Score</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin"></div>
                      <span className="font-semibold text-slate-500">Scanning flags...</span>
                    </div>
                  </td>
                </tr>
              ) : anomalies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center font-bold text-slate-400">
                    No suspicious patterns detected. System secure.
                  </td>
                </tr>
              ) : (
                anomalies.map((anomaly) => (
                  <tr 
                    key={anomaly.id} 
                    ref={el => { rowRefs.current[anomaly.id] = el; }}
                    className={`hover:bg-slate-50/80 transition-all group ${highlightId === anomaly.id.toString() ? 'bg-rose-50/80 ring-2 ring-rose-500/20 ring-inset animate-pulse z-10' : ''}`}
                  >
                    <td className="px-8 py-5 font-mono font-bold text-slate-400 tracking-tighter">#{anomaly.id.toString().padStart(4, '0')}</td>
                    <td className="px-8 py-5">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800 uppercase">{anomaly.senior_name || "N/A"}</span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{anomaly.senior_osca_id || "OSCA-ID"}</span>
                        </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-xl max-w-md">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-xs font-medium text-amber-800 leading-relaxed italic">
                          {anomaly.flag_reason}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>AI Certainty</span>
                            <span className="text-rose-500">{(anomaly.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${anomaly.confidence_score * 100}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        <button 
                          onClick={() => openConfirm('safe', anomaly.id)}
                          className="w-48 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} />
                          Mark as Safe
                        </button>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => viewProfile(anomaly.senior)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all"
                          >
                            View Profile
                          </button>
                          <button 
                            onClick={() => openConfirm('suspend', anomaly.id)}
                            className="px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-all"
                          >
                            Hold Payout
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Showing {anomalies.length} of {totalCount} detected anomalies
            </div>
            <div className="flex gap-3">
                <button 
                    disabled={!prevPage}
                    onClick={() => {
                        if (prevPage) {
                            fetchAnomalies(prevPage);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-slate-600 text-sm flex items-center shadow-sm"
                >
                    <ChevronLeft size={16} className="mr-1" /> Prev
                </button>
                <button 
                    disabled={!nextPage}
                    onClick={() => {
                        if (nextPage) {
                            fetchAnomalies(nextPage);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-slate-600 text-sm flex items-center shadow-sm"
                >
                    Next <ChevronRight size={16} className="ml-1" />
                </button>
            </div>
        </div>
      </div>

      {/* Removed legacy local confirm modal - using global UIContext */}

      {/* Senior Profile Modal (Auditor View) */}
      {isProfileModalOpen && selectedSenior && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center px-10 py-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200"><User size={28} /></div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{selectedSenior.first_name} {selectedSenior.last_name}</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">OSCA ID: {selectedSenior.osca_id}</p>
                    </div>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <div className="p-10 overflow-y-auto flex-1 custom-scrollbar space-y-10">
                {/* Status Alert */}
                <div className={`p-6 rounded-3xl flex items-center gap-5 border ${selectedSenior.status === 'SUSPENDED' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    {selectedSenior.status === 'SUSPENDED' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}
                    <div>
                        <h4 className="font-black uppercase tracking-tighter text-lg">Current Status: {selectedSenior.status}</h4>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80">This record is currently being audited for potential syndicate fraud.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Section 1: Demographics */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2"><MapPin size={20} className="text-indigo-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Residence & Contact</h3></div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                            <div className="flex justify-between border-b border-slate-200/60 pb-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Barangay</span><span className="text-xs font-bold text-slate-700">{selectedSenior.barangay}</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Birth Date</span><span className="text-xs font-bold text-slate-700">{selectedSenior.date_of_birth}</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</span><span className="text-xs font-bold text-slate-700">{selectedSenior.annex_a_data?.contact_number || 'N/A'}</span></div>
                        </div>

                        <div className="flex items-center gap-3 mb-2 mt-8"><Users size={20} className="text-indigo-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Authorized Representative</h3></div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                            {selectedSenior.annex_a_data?.reps?.map((rep: any, idx: number) => (
                                <div key={idx} className="flex flex-col gap-1 p-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                                    <span className="text-xs font-black text-slate-800 uppercase">{rep.name}</span>
                                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{rep.relation}</span>
                                </div>
                            )) || <p className="text-xs text-slate-400 italic">No representative listed.</p>}
                        </div>
                    </div>

                    {/* Section 2: Socio-Economic */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2"><Briefcase size={20} className="text-indigo-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Annex A - Socio Economic</h3></div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intended Utilization</span>
                                <div className="flex flex-wrap gap-2">
                                    {selectedSenior.annex_a_data?.utilization?.map((u: string, idx: number) => (
                                        <span key={idx} className="px-3 py-1 bg-white rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200 text-slate-600">{u}</span>
                                    )) || 'N/A'}
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-slate-200/60 pt-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Beneficiary</span><span className="text-xs font-bold text-slate-700">{selectedSenior.annex_a_data?.primary_ben_name || 'N/A'}</span></div>
                        </div>

                        <div className="flex items-center gap-3 mb-2 mt-8"><FileText size={20} className="text-indigo-500" /><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Audit Evidence (Mock)</h3></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="aspect-video bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-slate-400 gap-2">
                                <FileText size={24} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Valid OSCA ID</span>
                            </div>
                            <div className="aspect-video bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 text-slate-400 gap-2">
                                <User size={24} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Photo Proof</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3 text-rose-500">
                    <ShieldAlert size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Threat Level: HIGH (Syndicate Pattern)</span>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => { setIsProfileModalOpen(false); openConfirm('safe', anomalies.find(a => a.senior === selectedSenior.id)?.id); }} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-200 transition-all">Mark as Safe</button>
                    <button onClick={() => { setIsProfileModalOpen(false); openConfirm('suspend', anomalies.find(a => a.senior === selectedSenior.id)?.id); }} className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-rose-200 transition-all">Suspend Record</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
