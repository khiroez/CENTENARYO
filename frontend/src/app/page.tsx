"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  CreditCard, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  Activity,
  ChevronRight,
  ShieldAlert,
  FileBarChart,
  X,
  Target,
  UserCheck,
  Truck,
  Ghost,
  AlertCircle,
  FileText,
  Printer
} from 'lucide-react';
import { authFetch } from '@/lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_seniors: 0,
    total_payouts: 0,
    active_anomalies: 0,
    upcoming_seniors: 0,
    estimated_budget: 0
  });
  
  const [aiReport, setAiReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/stats/`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAiReport = async () => {
    setIsReportLoading(true);
    setIsModalOpen(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/ai-report/`);
      if (res.ok) {
        const data = await res.json();
        setAiReport(data);
      }
    } catch (error) {
      console.error("Error fetching AI report:", error);
    } finally {
      setIsReportLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-16 animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">System Oversight</h1>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            Decision Maker Analytics Dashboard
          </p>
        </div>
        <div className="relative z-10 flex gap-3">
          <button 
            onClick={fetchAiReport}
            className="px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-1 flex items-center gap-3 font-black uppercase tracking-widest text-[10px]"
          >
            <FileBarChart size={18} />
            Generate Intelligence Briefing
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Seniors Card */}
        <div className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-indigo-50 group-hover:text-indigo-100 transition-colors">
            <Users size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="bg-indigo-50 text-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner">
              <Users size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Registry Volume</h3>
              <p className="text-5xl font-black text-slate-900 mt-1 tabular-nums">{isLoading ? '...' : stats.total_seniors}</p>
            </div>
            <Link href="/seniors" className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-[10px] group-hover:gap-3 transition-all">
              Manage Records <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Payouts Card */}
        <div className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-emerald-50 group-hover:text-emerald-100 transition-colors">
            <CreditCard size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="bg-emerald-50 text-emerald-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner">
              <CreditCard size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Released Payouts</h3>
              <p className="text-5xl font-black text-slate-900 mt-1 tabular-nums">{isLoading ? '...' : stats.total_payouts}</p>
            </div>
            <Link href="/disbursements" className="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-[10px] group-hover:gap-3 transition-all">
              Financial Logs <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Anomalies Card */}
        <div className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-rose-50 group-hover:text-rose-100 transition-colors">
            <AlertTriangle size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="bg-rose-50 text-rose-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Anomaly Detections</h3>
              <p className="text-5xl font-black text-slate-900 mt-1 tabular-nums">{isLoading ? '...' : stats.active_anomalies}</p>
            </div>
            <Link href="/anomalies" className="flex items-center gap-2 text-rose-600 font-black uppercase tracking-widest text-[10px] group-hover:gap-3 transition-all">
              Fraud Review <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Analytics Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-10 rounded-[48px] text-white relative overflow-hidden shadow-2xl">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Target size={20} /></div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Prescriptive Analytics</h3>
              </div>
              <h2 className="text-3xl font-black leading-tight">Automated Intelligence <br/><span className="text-indigo-400">Reports Available</span></h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm">
                Our AI analyzes patterns in representative lists, utilization data, and mortality rates to prevent fraud and optimize budget allocation.
              </p>
            </div>
            <button 
              onClick={fetchAiReport}
              className="mt-12 w-fit flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 transition-all"
            >
              Analyze System Patterns
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-10">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Security Health</h3>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">ALL SYSTEMS GO</span>
            </div>
            <div className="space-y-8 flex-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><ShieldAlert size={20} /></div>
                        <div><p className="text-xs font-black text-slate-900 uppercase">Audit Integrity</p><p className="text-[10px] font-bold text-slate-400 tracking-wider">Signals Active</p></div>
                    </div>
                    <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="w-[100%] h-full bg-indigo-500"></div></div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><AlertCircle size={20} /></div>
                        <div><p className="text-xs font-black text-slate-900 uppercase">Anomaly Detection</p><p className="text-[10px] font-bold text-slate-400 tracking-wider">98% Accuracy</p></div>
                    </div>
                    <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="w-[98%] h-full bg-emerald-500"></div></div>
                </div>
            </div>
            <Link href="/auditlogs" className="mt-10 py-5 bg-slate-50 hover:bg-slate-100 rounded-3xl text-center text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all border border-slate-100">Access Secure Audit Trail</Link>
        </div>
      </div>

      {/* --- AI INTELLIGENCE BRIEFING MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[50px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col">
                <div className="px-12 py-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><FileText size={28} /></div>
                        <div><h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">AI Intelligence Briefing</h2><p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Prescriptive Recommendations for LGU Decision Makers</p></div>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-10">
                    {isReportLoading ? (
                        <div className="py-20 text-center space-y-4"><div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mx-auto"></div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Scanning Database Patterns...</p></div>
                    ) : aiReport && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            
                            {/* 1. Budget Deficit */}
                            <div className="p-8 bg-indigo-50 rounded-[40px] border border-indigo-100 space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 text-indigo-100 group-hover:text-indigo-200 transition-colors"><TrendingUp size={64} /></div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-3 text-indigo-600"><TrendingUp size={20} /><h3 className="text-xs font-black uppercase tracking-widest">Financial Planning</h3></div>
                                    <h4 className="text-xl font-black text-slate-900">Budget Deficit Early Warning</h4>
                                    <div className="bg-white p-6 rounded-[32px] border border-indigo-200 shadow-sm space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Forecast for Next Cycle</p>
                                        <p className="text-3xl font-black text-slate-900">₱{aiReport.budget_forecast.recommended_funding.toLocaleString()}</p>
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{aiReport.budget_forecast.upcoming_beneficiaries} New Milestone Beneficiaries</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed">Recommendation: Draft Supplemental Budget Request to DBM now to avoid payout delays.</p>
                                </div>
                            </div>

                            {/* 3. Door-to-Door Logistics */}
                            <div className="p-8 bg-emerald-50 rounded-[40px] border border-emerald-100 space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 text-emerald-100 group-hover:text-emerald-200 transition-colors"><Truck size={64} /></div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-3 text-emerald-600"><Truck size={20} /><h3 className="text-xs font-black uppercase tracking-widest">Operational Logistics</h3></div>
                                    <h4 className="text-xl font-black text-slate-900">Routing Recommendation</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="text-4xl font-black text-slate-900">{aiReport.logistics.medical_utilization_rate}%</div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">of seniors utilize funds for Medicine</p>
                                    </div>
                                    <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center ${aiReport.logistics.medical_utilization_rate > 50 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        Strategy: {aiReport.logistics.recommendation}
                                    </div>
                                </div>
                            </div>

                            {/* 4. Ghost Pensioner Anomaly */}
                            <div className="p-8 bg-slate-50 rounded-[40px] border border-slate-200 space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 text-slate-200 group-hover:text-slate-300 transition-colors"><Ghost size={64} /></div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-3 text-slate-600"><ShieldAlert size={20} /><h3 className="text-xs font-black uppercase tracking-widest">Mortality Audit</h3></div>
                                    <h4 className="text-xl font-black text-slate-900">Unnatural Survival Rate</h4>
                                    {aiReport.ghost_warnings.length > 0 ? (
                                        <div className="space-y-3">
                                            {aiReport.ghost_warnings.map((w: any) => (
                                                <div key={w.barangay} className="bg-white p-4 rounded-2xl border border-slate-300 shadow-sm">
                                                    <p className="text-xs font-black text-slate-900 uppercase">Brgy. {w.barangay}</p>
                                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-1">Warning: {w.message}</p>
                                                </div>
                                            ))}
                                            <div className="mt-4 p-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">ACTION: Immediate Spot Inspection</div>
                                        </div>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-500 italic">Mortality rates are within normal national statistics.</p>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                <div className="px-12 py-8 bg-slate-50/80 border-t border-slate-100 flex gap-4">
                    <button onClick={() => window.print()} className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                        <Printer size={18} />
                        Export PDF Intelligence Report
                    </button>
                    <button onClick={() => setIsModalOpen(false)} className="px-12 py-5 bg-white border border-slate-200 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-3xl hover:text-slate-900 transition-colors">Dismiss</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
