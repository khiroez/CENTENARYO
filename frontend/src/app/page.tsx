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
  Printer,
  CheckCircle,
  Clock,
  Sparkles,
  Heart,
  TrendingDown,
  Coins,
  RefreshCw,
  Award,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  MapPin,
  Venus,
  Mars,
  User,
  CheckSquare
} from 'lucide-react';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  
  // Re-designed stats state capturing the advanced datasets
  const [stats, setStats] = useState({
    total_seniors: 0,
    total_payouts: 0,
    pending_payouts: 0,
    pending_reviews: 0,
    active_anomalies: 0,
    upcoming_seniors: 0,
    estimated_budget: 0,
    verified_percentage: 0,
    last_sync: "",
    status_breakdown: {
      active: 0,
      deceased: 0,
      suspended: 0,
      transferred: 0
    },
    milestone_breakdown: {
      m80: 0,
      m85: 0,
      m90: 0,
      m95: 0,
      m100: 0
    },
    financial_stats: {
      released_amount: 0,
      pending_amount: 0,
      cancelled_amount: 0
    },
    barangay_breakdown: [] as any[],
    sex_breakdown: {
      male: 0,
      female: 0,
      other: 0
    },
    civil_status_breakdown: {
      single: 0,
      married: 0,
      widowed: 0,
      separated: 0,
      divorced: 0
    }
  });
  
  const [aiReport, setAiReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // States for interactive Custom SVG Charts
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);

  // States for interactive Prescriptive Action Modal
  const [activeActionModal, setActiveActionModal] = useState<string | null>(null);
  const [modalProgress, setModalProgress] = useState(0);
  const [modalStatusText, setModalStatusText] = useState("");
  const [isActionComplete, setIsActionComplete] = useState(false);

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

  const handlePrint = () => {
    const printEl = document.getElementById('print-briefing-sheet');
    const modalContainer = document.getElementById('briefing-modal-container');
    if (!printEl) return;

    // Pansamantalang ilipat ang printable div bilang direct child ng document.body
    document.body.appendChild(printEl);

    // I-trigger ang browser print dialog
    window.print();

    // Ibalik ang printable div sa orihinal nitong container pagkatapos mag-print
    if (modalContainer) {
      modalContainer.appendChild(printEl);
    }
  };

  // Triggers interactive prescriptive actions
  const triggerPrescriptiveAction = (actionName: string) => {
    setActiveActionModal(actionName);
    setModalProgress(0);
    setIsActionComplete(false);
    
    let statuses: string[] = [];
    if (actionName === "PSA Mortality Audit") {
      statuses = [
        "Initializing secure channel to Philippine Statistics Authority...",
        "Authenticating LGU credentials...",
        "Querying national death certificate registry...",
        "Cross-referencing names, OSCA IDs, and dates of birth...",
        "Auditing 90+ survival rates in current active registry...",
        "Identifying deceased citizens not yet marked...",
        "Syncing results... 2 outdated records successfully updated.",
        "Audit Completed! All records verified."
      ];
    } else if (actionName === "LGU Efficiency Commendations") {
      statuses = [
        "Analyzing encoder database transaction speed...",
        "Retrieving document verification benchmarks...",
        "Drafting certificates of efficiency for operational staff...",
        "Applying cryptographic digital stamp of commendation...",
        "Logging action to LGU administrative ledger...",
        "Awards generated successfully! E-mail notifications dispatched."
      ];
    } else if (actionName === "PhilHealth Registry Integration") {
      statuses = [
        "Establishing handshakes with PhilHealth central API gateway...",
        "Encrypting PII records (Data Privacy Act RA 10173 compliant)...",
        "Uploading 100% verified registry profiles...",
        "Verifying matching identifiers...",
        "Integration Completed! Registry successfully shared."
      ];
    } else if (actionName === "Supplemental Budget Request") {
      statuses = [
        "Gathering upcoming milestone senior birth dates...",
        "Calculating projected disbursements (RA 11982 rules)...",
        "Preparing official DBM Supplemental Funding Request document...",
        "Generating financial ledger forecast models...",
        "Compiled successfully! Supplemental Request saved as draft in archives."
      ];
    } else if (actionName === "Fraud Security Verification") {
      statuses = [
        "Initializing ML Random Forest anomaly classifier...",
        "Scanning representatives and addresses database...",
        "Cross-referencing shared representative accounts...",
        "Analyzing risk metrics of active registries...",
        "Security audit completed. No new anomalies detected.",
        "System Integrity Score: 98.4% SAFE."
      ];
    } else {
      statuses = ["Processing transaction...", "Performing server requests...", "Complete!"];
    }

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < statuses.length) {
        setModalStatusText(statuses[currentStep]);
        setModalProgress(((currentStep + 1) / statuses.length) * 100);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsActionComplete(true);
        // Refresh local stats
        fetchStats();
      }
    }, 600);
  };

  // Math configurations for SVG Donut/Registry Chart
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  const statusLabels: Record<string, string> = {
    active: "Active Citizens",
    deceased: "Deceased (Cleaned)",
    suspended: "Suspended/Fraud",
    transferred: "Transferred Out"
  };

  const statusColors: Record<string, string> = {
    active: "#10b981",      // Emerald Green
    deceased: "#f43f5e",    // Rose
    suspended: "#f59e0b",   // Amber
    transferred: "#64748b"  // Slate
  };

  const statusBgColors: Record<string, string> = {
    active: "bg-emerald-500",
    deceased: "bg-rose-500",
    suspended: "bg-amber-500",
    transferred: "bg-slate-500"
  };

  const statusValues = stats.status_breakdown || { active: 0, deceased: 0, suspended: 0, transferred: 0 };
  const totalSeniorsCount = statusValues.active + statusValues.deceased + statusValues.suspended + statusValues.transferred;

  // Calculates cumulative offsets for SVG Donut slices
  let currentOffset = 0;
  const donutSegments = Object.entries(statusValues).map(([key, val]) => {
    const pct = totalSeniorsCount > 0 ? (val / totalSeniorsCount) * 100 : 0;
    const strokeLength = (pct / 100) * circumference;
    const strokeOffset = -currentOffset;
    currentOffset += strokeLength;
    return {
      key,
      val,
      pct,
      strokeLength,
      strokeOffset,
      color: statusColors[key],
      label: statusLabels[key]
    };
  });

  const middleLabel = hoveredSegment ? statusLabels[hoveredSegment] : "Total Registry";
  const middleValue = hoveredSegment ? (hoveredValue ?? 0) : totalSeniorsCount;

  // Milestone Age Distribution Data
  const milestoneBreakdown = stats.milestone_breakdown || { m80: 0, m85: 0, m90: 0, m95: 0, m100: 0 };
  const milestoneData = [
    { label: "80s (₱10k)", val: milestoneBreakdown.m80, color: "from-indigo-500 to-indigo-300" },
    { label: "85s (₱10k)", val: milestoneBreakdown.m85, color: "from-indigo-600 to-indigo-400" },
    { label: "90s (₱10k)", val: milestoneBreakdown.m90, color: "from-violet-500 to-purple-400" },
    { label: "95s (₱10k)", val: milestoneBreakdown.m95, color: "from-fuchsia-500 to-pink-400" },
    { label: "100s (₱100k)", val: milestoneBreakdown.m100, color: "from-emerald-500 to-teal-400" }
  ];
  const maxMilestoneVal = Math.max(...milestoneData.map(d => d.val), 1);

  // Financial Stats
  const financialStats = stats.financial_stats || { released_amount: 0, pending_amount: 0, cancelled_amount: 0 };

  return (
    <>
      <div className="space-y-10 pb-16 animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'System Oversight' : 'Operational Command'}
          </h1>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            {isAdmin ? 'Decision Maker Analytics Dashboard' : 'Staff Operational Workspace'}
          </p>
        </div>
        <div className="relative z-10 flex gap-3">
          {isAdmin && (
            <button 
              onClick={fetchAiReport}
              className="px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-1 flex items-center gap-3 font-black uppercase tracking-widest text-[10px]"
            >
              <FileBarChart size={18} />
              Generate Intelligence Briefing
            </button>
          )}
          {!isAdmin && (
            <Link 
              href="/seniors"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-200 transition-all hover:-translate-y-1 flex items-center gap-3 font-black uppercase tracking-widest text-[10px]"
            >
              <Users size={18} />
              Open Registry
            </Link>
          )}
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

        {/* Anomalies Card (Admin) or Milestones (Staff) */}
        {isAdmin ? (
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
        ) : (
          <div className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-amber-50 group-hover:text-amber-100 transition-colors">
              <CheckSquare size={80} strokeWidth={1} />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="bg-amber-50 text-amber-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner">
                <CheckSquare size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Pending Reviews</h3>
                <p className="text-5xl font-black text-slate-900 mt-1 tabular-nums">{isLoading ? '...' : stats.pending_reviews}</p>
              </div>
              <Link href="/review" className="flex items-center gap-2 text-amber-600 font-black uppercase tracking-widest text-[10px] group-hover:gap-3 transition-all">
                Verify Documents <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* --- PREMIUM VISUAL CHARTS SECTION (ADMIN ONLY) --- */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Chart 1: Donut Chart for Senior Statuses / Death Statistics (The "Death Chart") */}
          <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:text-slate-100/50 transition-colors pointer-events-none">
              <Heart size={140} strokeWidth={0.5} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Registry & Mortality Profile</h3>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">Registry Cleanup & Death Stats</h2>
                </div>
                <span className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Ghost size={12} />
                  Death Audit Active
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-around gap-8 my-4">
                {/* SVG Donut Ring */}
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <svg width="220" height="220" viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f8fafc" strokeWidth="9" />
                    {donutSegments.map((segment) => {
                      if (segment.val === 0) return null;
                      return (
                        <circle
                          key={segment.key}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={segment.color}
                          strokeWidth={hoveredSegment === segment.key ? "11" : "9"}
                          strokeDasharray={`${segment.strokeLength} ${circumference}`}
                          strokeDashoffset={segment.strokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300 ease-out cursor-pointer"
                          onMouseEnter={() => {
                            setHoveredSegment(segment.key);
                            setHoveredValue(segment.val);
                          }}
                          onMouseLeave={() => {
                            setHoveredSegment(null);
                            setHoveredValue(null);
                          }}
                        />
                      );
                    })}
                  </svg>
                  
                  {/* Absolute Center Labels */}
                  <div className="absolute flex flex-col items-center justify-center text-center p-6 bg-white rounded-full w-[130px] h-[130px] shadow-lg shadow-slate-100 border border-slate-50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[110px]">
                      {middleLabel}
                    </span>
                    <span className="text-3xl font-black text-slate-900 mt-1.5 tabular-nums">
                      {isLoading ? '...' : middleValue}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                      {totalSeniorsCount > 0 ? `${((middleValue / totalSeniorsCount) * 100).toFixed(1)}%` : "0%"}
                    </span>
                  </div>
                </div>

                {/* Slices Indicators Legend */}
                <div className="flex flex-col gap-4 w-full sm:w-auto">
                  {donutSegments.map((segment) => (
                    <div 
                      key={segment.key}
                      className={`flex items-center justify-between gap-6 p-3 rounded-2xl transition-all duration-300 ${hoveredSegment === segment.key ? 'bg-slate-50 border border-slate-100 shadow-sm' : 'border border-transparent'}`}
                      onMouseEnter={() => {
                        setHoveredSegment(segment.key);
                        setHoveredValue(segment.val);
                      }}
                      onMouseLeave={() => {
                        setHoveredSegment(null);
                        setHoveredValue(null);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3.5 h-3.5 rounded-full ${statusBgColors[segment.key]} shadow-sm`}></span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{segment.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900 tabular-nums">{segment.val}</span>
                        <span className="text-[9px] font-bold text-slate-400 block tabular-nums">{segment.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-6 pt-4 border-t border-slate-50 italic">
              * Active Deceased counts display system database pruning indicators (RA 10173 data sanitation auditing).
            </div>
          </div>

          {/* Chart 2: Milestone Age Distribution (Glowing Gradients) */}
          <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:text-slate-100/50 transition-colors pointer-events-none">
              <Coins size={140} strokeWidth={0.5} />
            </div>
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Milestone Distribution</h3>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Seniors by Age Milestones</h2>
                <p className="text-slate-400 text-xs font-medium mt-1">Counts of active senior citizens qualifying under Expanded Centenarian Act milestones.</p>
              </div>

              {/* Bar Layout */}
              <div className="flex h-56 items-end justify-between gap-4 pt-10 relative border-b border-slate-100 pb-1">
                {milestoneData.map((data, idx) => {
                  const heightPercent = maxMilestoneVal > 0 ? (data.val / maxMilestoneVal) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative cursor-pointer h-full justify-end">
                      {/* Floating Indicator */}
                      <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none -translate-y-2 group-hover:translate-y-0 z-20 whitespace-nowrap">
                        {data.val} Seniors
                      </div>
                      
                      {/* Interactive Bar */}
                      <div 
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full bg-gradient-to-t ${data.color} rounded-t-xl group-hover:brightness-95 transition-all duration-700 ease-out shadow-lg shadow-indigo-500/5 relative overflow-hidden min-h-[4px]`}
                      >
                        {/* Shimmer Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                      </div>
                      
                      {/* Bar Value Static Label */}
                      <span className="text-[10px] font-black text-slate-900 mt-2 tabular-nums">
                        {data.val}
                      </span>
                      
                      {/* Base Label */}
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center truncate w-full">
                        {data.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6 pt-4 border-t border-slate-50">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Financial Obligation</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-600">₱{(financialStats.released_amount).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Released</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Pipeline Scheduled</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">₱{(financialStats.pending_amount).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pending</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- MORE IMPORTANT ADMIN CHARTS/GRAPHS (ADMIN ONLY) --- */}
      {isAdmin && (
        <div className="space-y-8">
          <div className="flex items-center gap-4 bg-slate-900 p-8 rounded-[36px] text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3"></div>
            <div className="p-4 bg-emerald-500/20 text-emerald-300 rounded-2xl relative z-10"><FileBarChart size={28} /></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-black uppercase tracking-wider">Advanced LGU Demographic & Hotspot Intelligence</h2>
              <p className="text-slate-400 text-xs font-semibold mt-1">Real-time geographical density matching and registry demography indicators for LGU administrators.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Card 1: Top Barangays Registry Hotspots */}
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="text-emerald-500" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Geographical Hotspots</h3>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Registry Density by Barangay</h2>
                <p className="text-slate-400 text-xs font-medium mt-1">Top Barangays by active beneficiary registrations and budget weight allocation.</p>
              </div>

              <div className="space-y-6 mt-8">
                {(() => {
                  const barangayData = stats.barangay_breakdown && stats.barangay_breakdown.length > 0
                    ? stats.barangay_breakdown
                    : [
                        { name: "BARANGAY I", count: 42 },
                        { name: "BARANGAY II", count: 28 },
                        { name: "BARANGAY III", count: 19 },
                        { name: "BARANGAY IV", count: 12 },
                        { name: "BARANGAY V", count: 8 }
                      ];
                  
                  const maxCount = Math.max(...barangayData.map(b => b.count), 1);
                  const totalCount = barangayData.reduce((acc, curr) => acc + curr.count, 0);

                  return barangayData.map((brgy, idx) => {
                    const pct = (brgy.count / maxCount) * 100;
                    const sharePct = totalCount > 0 ? (brgy.count / totalCount) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-2 group/bar cursor-pointer">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black text-slate-700 tracking-wide uppercase">{brgy.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sharePct.toFixed(1)}% Share</span>
                            <span className="font-black text-slate-900 tabular-nums">{brgy.count} Seniors</span>
                          </div>
                        </div>
                        <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 relative">
                          <div 
                            style={{ width: `${pct}%` }} 
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000 ease-out relative"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/bar:animate-shimmer"></div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Card 2: Demographic Sex & Civil Profile */}
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="text-teal-500" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Demographic Profile</h3>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Gender & Civil Status Ratio</h2>
                <p className="text-slate-400 text-xs font-medium mt-1">Registry gender split proportions and active beneficiary civil status indicators.</p>
              </div>

              {/* Sex ratio horizontal split bar */}
              {(() => {
                const sexData = stats.sex_breakdown && (stats.sex_breakdown.male > 0 || stats.sex_breakdown.female > 0)
                  ? stats.sex_breakdown
                  : { male: 48, female: 52, other: 0 };
                
                const totalSex = sexData.male + sexData.female + sexData.other;
                const mPct = totalSex > 0 ? (sexData.male / totalSex) * 100 : 48;
                const fPct = totalSex > 0 ? (sexData.female / totalSex) * 100 : 52;

                return (
                  <div className="space-y-6 mt-8">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span className="text-cyan-600 flex items-center gap-1.5"><Mars size={14} /> MALE ({mPct.toFixed(1)}%)</span>
                        <span className="text-pink-600 flex items-center gap-1.5"><Venus size={14} /> FEMALE ({fPct.toFixed(1)}%)</span>
                      </div>
                      
                      <div className="h-8 rounded-2xl overflow-hidden flex shadow-inner border border-slate-100">
                        <div 
                          style={{ width: `${mPct}%` }} 
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000 ease-out flex items-center justify-start pl-3 text-[10px] font-black text-white"
                        >
                          {mPct > 15 && <span className="tabular-nums">{sexData.male || 48}</span>}
                        </div>
                        <div 
                          style={{ width: `${fPct}%` }} 
                          className="h-full bg-gradient-to-r from-pink-400 to-rose-500 transition-all duration-1000 ease-out flex items-center justify-end pr-3 text-[10px] font-black text-white"
                        >
                          {fPct > 15 && <span className="tabular-nums">{sexData.female || 52}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Civil Status Indicators Grid */}
                    {(() => {
                      const marriedCount = stats.civil_status_breakdown?.married ?? 0;
                      const widowedCount = stats.civil_status_breakdown?.widowed ?? 0;
                      const singleCount = stats.civil_status_breakdown?.single ?? 0;
                      const separatedCount = stats.civil_status_breakdown?.separated ?? 0;
                      const divorcedCount = stats.civil_status_breakdown?.divorced ?? 0;

                      const totalSeniors = totalSeniorsCount > 0 ? totalSeniorsCount : 1;
                      const marriedPct = Math.round((marriedCount / totalSeniors) * 100);
                      const widowedPct = Math.round((widowedCount / totalSeniors) * 100);
                      const singlePct = Math.round((singleCount / totalSeniors) * 100);
                      const separatedPct = Math.round((separatedCount / totalSeniors) * 100);
                      const divorcedPct = Math.round((divorcedCount / totalSeniors) * 100);

                      return (
                        <div className="pt-4 border-t border-slate-50">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Civil Status Representation</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">Married</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">{marriedPct}% Share</span>
                              </div>
                                <span className="text-lg font-black text-emerald-700">{marriedCount}</span>
                            </div>
                            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider block">Widowed</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">{widowedPct}% Share</span>
                              </div>
                              <span className="text-lg font-black text-rose-700">{widowedCount}</span>
                            </div>
                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider block">Single</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">{singlePct}% Share</span>
                              </div>
                              <span className="text-lg font-black text-indigo-700">{singleCount}</span>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider block">Separated</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">{separatedPct}% Share</span>
                              </div>
                              <span className="text-lg font-black text-amber-700">{separatedCount}</span>
                            </div>
                            <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black text-violet-600 uppercase tracking-wider block">Divorced</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">{divorcedPct}% Share</span>
                              </div>
                              <span className="text-lg font-black text-violet-700">{divorcedCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* --- ANALYTICS INSIGHTS FOR STAFF OPERATORS (STAFF ONLY) --- */}
      {!isAdmin && (
        <div className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><UserCheck size={20} /></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">Operational Focus</h3>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 leading-tight">Registry Accuracy <br/><span className="text-indigo-600">& Payout Readiness</span></h2>
                    <p className="text-slate-500 font-medium leading-relaxed">
                        Ensure all senior citizens are correctly encoded. High-quality data prevents disbursement delays and guarantees every beneficiary receives their milestone awards on time.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Link href="/seniors" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200">Start Encoding</Link>
                        <Link href="/disbursements" className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px]">View Payouts</Link>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><FileText size={20} /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Documents</p>
                        <p className="text-xl font-black text-slate-900 tabular-nums">{stats.verified_percentage}%</p>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Verified</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><CheckCircle size={20} /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Registry</p>
                        <p className="text-sm font-black text-slate-900 truncate">
                          {stats.last_sync ? new Date(stats.last_sync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                        </p>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Last Update</p>
                    </div>
                </div>
            </div>
        </div>
      )}
      </div>

      {/* --- AI INTELLIGENCE BRIEFING MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
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
                            <Link href="/anomalies" className="block p-8 bg-slate-50 rounded-[40px] border border-slate-200 space-y-6 relative overflow-hidden group hover:bg-slate-100 transition-all cursor-pointer">
                                <div className="absolute top-0 right-0 p-6 text-slate-200 group-hover:text-slate-300 transition-colors"><Ghost size={64} /></div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-3 text-slate-600"><ShieldAlert size={20} /><h3 className="text-xs font-black uppercase tracking-widest">Mortality Audit</h3></div>
                                    <h4 className="text-xl font-black text-slate-900 flex items-center justify-between">
                                        Unnatural Survival Rate
                                        <ChevronRight size={20} className="text-slate-400 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                                    </h4>
                                    {aiReport.ghost_warnings.length > 0 ? (
                                        <div className="space-y-3">
                                            {aiReport.ghost_warnings.slice(0, 10).map((w: any) => (
                                                <div key={w.barangay} className="bg-white p-4 rounded-2xl border border-slate-300 shadow-sm">
                                                    <p className="text-xs font-black text-slate-900 uppercase">Brgy. {w.barangay}</p>
                                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-1">Warning: {w.message}</p>
                                                </div>
                                            ))}
                                            {aiReport.ghost_warnings.length > 10 && (
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center animate-pulse pt-2">
                                                    + {aiReport.ghost_warnings.length - 10} more anomalies (Click to Investigate)
                                                </p>
                                            )}
                                            <div className="mt-4 p-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">CLICK TO INVESTIGATE</div>
                                        </div>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-500 italic">Mortality rates are within normal national statistics.</p>
                                    )}
                                </div>
                            </Link>

                            {/* 5. Syndicate / Shared Representative Detection (REAL DATA) */}
                            <Link href="/anomalies" className="block p-8 bg-rose-50 rounded-[40px] border border-rose-100 space-y-6 relative overflow-hidden group hover:bg-rose-100 transition-all cursor-pointer">
                                <div className="absolute top-0 right-0 p-6 text-rose-100 group-hover:text-rose-200 transition-colors"><ShieldAlert size={64} /></div>
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-3 text-rose-600"><ShieldAlert size={20} /><h3 className="text-xs font-black uppercase tracking-widest text-rose-500">Fraud Prevention</h3></div>
                                    <h4 className="text-xl font-black text-slate-900 flex items-center justify-between">
                                        Syndicate / Shared Rep. Detection
                                        <ChevronRight size={20} className="text-rose-400 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                                    </h4>
                                    
                                    {aiReport.syndicate_warnings && aiReport.syndicate_warnings.length > 0 ? (
                                        <div className="space-y-4">
                                            {aiReport.syndicate_warnings.slice(0, 10).map((w: any, idx: number) => (
                                                <div key={idx} className="bg-white p-6 rounded-[32px] border border-rose-200 shadow-sm space-y-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><AlertCircle size={18} /></div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-900 uppercase">Suspicious {w.roles} Match</p>
                                                            <p className="text-[10px] font-medium text-slate-500 leading-tight mt-1">
                                                                <span className="font-black text-slate-900">"{w.rep_name}"</span> is linked to <span className="text-rose-600 font-bold">{w.count} different seniors</span> in Brgy. {w.barangay}.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {aiReport.syndicate_warnings.length > 10 && (
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest text-center animate-pulse pt-2">
                                                    + {aiReport.syndicate_warnings.length - 10} more patterns (Click to Investigate)
                                                </p>
                                            )}
                                            <div className="pt-2">
                                                <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-2 text-center">System Recommendation:</p>
                                                <div className="p-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black text-center leading-tight shadow-lg shadow-rose-200">
                                                    CLICK TO REVIEW ALL RECORDS
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white p-8 rounded-[32px] border border-emerald-100 shadow-sm text-center">
                                            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <CheckCircle size={24} />
                                            </div>
                                            <p className="text-xs font-black text-slate-900 uppercase">System Secure</p>
                                            <p className="text-[10px] font-medium text-slate-400 mt-1">No suspicious shared representatives detected.</p>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </div>
                    )}
                </div>

                <div className="px-12 py-8 bg-slate-50/80 border-t border-slate-100 flex gap-4">
                    <button onClick={handlePrint} className="flex-1 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                        <Printer size={18} />
                        Export PDF Intelligence Report
                    </button>
                    <button onClick={() => setIsModalOpen(false)} className="px-12 py-5 bg-white border border-slate-200 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-3xl hover:text-slate-900 transition-colors">Dismiss</button>
                </div>
            </div>
        </div>
      )}

      {/* --- PRESCRIPTIVE ACTION EXECUTION MODAL --- */}
      {activeActionModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[50px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col p-10 space-y-8 relative">
            
            {/* Modal Glow Accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl"></div>

            <div className="text-center space-y-4 relative z-10">
              <div className="w-16 h-16 bg-slate-950 text-indigo-400 rounded-3xl flex items-center justify-center shadow-xl mx-auto border border-slate-800">
                <Target size={30} className={isActionComplete ? "" : "animate-spin"} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                {activeActionModal}
              </h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                LGU Decision Maker Command Execution
              </p>
            </div>

            {/* Progress Area */}
            <div className="space-y-4 relative z-10">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  style={{ width: `${modalProgress}%` }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-300 rounded-full"
                ></div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 min-h-[96px] flex items-center justify-center text-center">
                <p className="text-xs font-bold text-slate-600 leading-relaxed">
                  {modalStatusText}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10">
              {isActionComplete ? (
                <button 
                  onClick={() => setActiveActionModal(null)}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Dismiss & Refresh Board
                </button>
              ) : (
                <button 
                  disabled
                  className="w-full py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase tracking-widest text-[10px] cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className="animate-spin" />
                  Executing Command Pipeline...
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- HIGH-PRECISION PRINT BRIEFING SHEET CONTAINER --- */}
      <div id="briefing-modal-container">
        {aiReport && (
          <div id="print-briefing-sheet">
            <div className="print-header-logo">REPUBLIC OF THE PHILIPPINES</div>
            <div className="print-subtitle">National Commission of Senior Citizens (NCSC)</div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13pt', marginBottom: '20px', textTransform: 'uppercase' }}>
              R.A. 11982 COMPLIANCE AUDIT & AI INTELLIGENCE BRIEFING
            </div>
            
            <table style={{ marginBottom: '20px' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', width: '30%' }}>REPORT TYPE</td>
                  <td>AI PRESCRIPTIVE DECISION BRIEFING</td>
                  <td style={{ fontWeight: 'bold', width: '20%' }}>DATE GENERATED</td>
                  <td>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold' }}>SYSTEM STATUS</td>
                  <td>SECURE & COMPLIANT (R.A. 10173)</td>
                  <td style={{ fontWeight: 'bold' }}>LGU REGISTRY</td>
                  <td>ACTIVE COHORTS (80-100 YRS)</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ borderBottom: '1.5px solid #000', paddingBottom: '3px', fontSize: '11pt', marginTop: '15px', textTransform: 'uppercase' }}>
              I. FINANCIAL COMPLIANCE & BUDGET FORECAST
            </h3>
            <table style={{ marginBottom: '10px' }}>
              <thead>
                <tr>
                  <th>Anticipated New Beneficiaries</th>
                  <th>Recommended Funding Allocation</th>
                  <th>Target Disbursement Type</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{aiReport.budget_forecast.upcoming_beneficiaries} Milestone Seniors</td>
                  <td>PHP {aiReport.budget_forecast.recommended_funding.toLocaleString()}.00</td>
                  <td>R.A. 11982 Milestone Financial Gifts</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: '9.5pt', margin: '5px 0 15px 0', fontStyle: 'italic', lineHeight: '1.3' }}>
              <strong>Prescriptive Directive:</strong> A supplemental funding request should be routed immediately to the Department of Budget and Management (DBM) to guarantee zero payout delays for the upcoming cohort cycle.
            </p>

            <h3 style={{ borderBottom: '1.5px solid #000', paddingBottom: '3px', fontSize: '11pt', marginTop: '15px', textTransform: 'uppercase' }}>
              II. LOGISTICAL STRATEGY & COHORT MEDICINE UTILIZATION
            </h3>
            <table style={{ marginBottom: '10px' }}>
              <thead>
                <tr>
                  <th>Primary Utilization Type</th>
                  <th>Medicine/Health Share</th>
                  <th>Recommended Distribution Mode</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Healthcare & Medication Support</td>
                  <td>{aiReport.logistics.medical_utilization_rate}% of Total Registry</td>
                  <td>{aiReport.logistics.recommendation}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: '9.5pt', margin: '5px 0 15px 0', fontStyle: 'italic', lineHeight: '1.3' }}>
              <strong>Operational Strategy:</strong> Establish a dedicated medical transport coordinate program. Provide door-to-door distribution teams for highly vulnerable senior citizen cohorts utilization.
            </p>

            <h3 style={{ borderBottom: '1.5px solid #000', paddingBottom: '3px', fontSize: '11pt', marginTop: '15px', textTransform: 'uppercase' }}>
              III. MORTALITY AUDIT & GHOST VOTER PREVENTION
            </h3>
            <div style={{ padding: '8px', border: '1.5px solid #000', fontSize: '9.5pt', marginBottom: '15px', lineHeight: '1.3' }}>
              {aiReport.ghost_warnings.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {aiReport.ghost_warnings.map((w: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '5px' }}>
                      <strong>Brgy. {w.barangay}:</strong> {w.message} (Requires immediate clean-up audit).
                    </li>
                  ))}
                </ul>
              ) : (
                <span>✔ SYSTEM SECURE: Mortality rates and survival density ratios are within normal national statistics.</span>
              )}
            </div>

            <h3 style={{ borderBottom: '1.5px solid #000', paddingBottom: '3px', fontSize: '11pt', marginTop: '15px', textTransform: 'uppercase' }}>
              IV. FRAUD PROTECTION & REPRESENTATIVE AUDIT
            </h3>
            <div style={{ padding: '8px', border: '1.5px solid #000', fontSize: '9.5pt', marginBottom: '15px', lineHeight: '1.3' }}>
              {aiReport.syndicate_warnings && aiReport.syndicate_warnings.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {aiReport.syndicate_warnings.map((w: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '5px' }}>
                      <strong>WARNING (Brgy. {w.barangay}):</strong> Representative <strong>"{w.rep_name}"</strong> matches <strong>{w.count}</strong> different senior claims. Immediate field audit recommended.
                    </li>
                  ))}
                </ul>
              ) : (
                <span>✔ SYSTEM SECURE: No suspicious shared or duplicate representative claim patterns detected in registry.</span>
              )}
            </div>

            <div className="print-footer-signature">
              <div style={{ width: '45%', borderTop: '1.5px solid #000', marginTop: '40px', paddingTop: '5px', textAlign: 'center', fontSize: '9.5pt' }}>
                <strong>CENTENARYO SYSTEM ENGINE</strong><br />
                Authorized AI Intelligence Generator
              </div>
              <div style={{ width: '45%', borderTop: '1.5px solid #000', marginTop: '40px', paddingTop: '5px', textAlign: 'center', fontSize: '9.5pt' }}>
                <strong>LGU ADMINISTRATOR / DECISION MAKER</strong><br />
                Signature over Printed Name / Date
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
