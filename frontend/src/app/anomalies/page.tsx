"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Search, Filter, ShieldAlert, Activity, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/api';

export default function AnomalyReviewPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/anomalies/`);
      if (res.ok) {
        const data = await res.json();
        setAnomalies(data.results || data); 
      }
    } catch (error) {
      console.error("Error fetching anomalies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/anomalies/${id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_resolved: true }),
      });

      if (res.ok) {
        // Alisin sa UI ang na-resolve na item
        setAnomalies(prev => prev.filter(anomaly => anomaly.id !== id));
      }
    } catch (error) {
      console.error("Error resolving anomaly:", error);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Page Header (Matching the Premium Dashboard Look) */}
      <div className="flex justify-between items-end bg-white p-8 rounded-3xl border border-rose-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <ShieldAlert size={32} className="mr-3 text-rose-500" />
            Anomaly Review 
          </h1>
          <p className="text-slate-500 mt-2 flex items-center font-medium">
            <Activity size={16} className="mr-2 text-rose-400" />
            Prescriptive Analytics: Suriin at aksyunan ang mga flagged records ng Machine Learning engine.
          </p>
        </div>
        
        {/* Search and Filter Controls */}
        <div className="relative z-10 flex gap-4">
          <div className="relative w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search OSCA ID..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none text-sm font-medium transition-all shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm">
            <Filter size={18} />
            Filter
          </button>
        </div>
      </div>

      {/* Anomalies Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col relative">
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Pending Review Flags</h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">Lahat ng records na may risk score na lagpas 0.60</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-20 text-center text-slate-500 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border-4 border-rose-100 border-t-rose-500 animate-spin mb-4"></div>
              <span className="font-semibold">Kumukuha ng datos mula sa AI Engine...</span>
            </div>
          ) : anomalies.length === 0 ? (
            <div className="p-20 text-center text-slate-500 flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-emerald-500" size={32} />
              </div>
              <p className="text-xl font-bold text-slate-800 mb-1">Lahat ay Na-resolba Na!</p>
              <p className="text-sm font-medium">Walang nakitang banta ang Machine Learning system natin sa ngayon.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
                <tr>
                  <th className="px-8 py-5">Flag ID</th>
                  <th className="px-8 py-5">Senior Record</th>
                  <th className="px-8 py-5">Detalye ng Anomaly (AI Reason)</th>
                  <th className="px-8 py-5">Confidence Score</th>
                  <th className="px-8 py-5 text-right">Aksyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anomalies.map((anomaly) => (
                  <tr key={anomaly.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-6 text-sm font-bold text-slate-400">
                      #{anomaly.id}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[15px]">{anomaly.senior_name || "Unidentified Record"}</span>
                        <span className="text-slate-500 font-mono text-xs font-semibold mt-0.5">{anomaly.senior_osca_id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-600 max-w-md whitespace-normal">
                      <div className="flex items-start gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <span className="font-medium text-slate-700 leading-snug">{anomaly.flag_reason || "Unusual pattern detected by Isolation Forest."}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center w-32">
                          <span className="font-bold text-slate-700 text-xs">AI Certainty</span>
                          <span className={`font-black text-sm ${anomaly.confidence_score > 0.8 ? 'text-rose-600' : 'text-amber-600'}`}>
                            {Math.round((anomaly.confidence_score || 0) * 100)}%
                          </span>
                        </div>
                        <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${anomaly.confidence_score > 0.8 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-amber-400'}`} 
                            style={{ width: `${(anomaly.confidence_score || 0) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        <button 
                          onClick={() => handleResolve(anomaly.id)}
                          className="w-48 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} />
                          Mark as Validated
                        </button>
                        
                        <div className="flex gap-2">
                          <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-all">
                            View Profile
                          </button>
                          <button className="px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-bold rounded-lg hover:bg-rose-100 transition-all">
                            Cancel Payout
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
