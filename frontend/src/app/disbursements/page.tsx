"use client";

import React, { useState, useEffect } from 'react';
import { Banknote, Search, CheckCircle, Clock, AlertCircle, Filter, ChevronLeft, ChevronRight, Download, X, History } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { useUI } from '@/context/UIContext';

const renderStatusBadge = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'RELEASED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle size={13} /> Released
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={13} /> Pending
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
          {status || 'UNKNOWN'}
        </span>
      );
  }
};

export default function DisbursementsPage() {
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDisbursement, setSelectedDisbursement] = useState<any>(null);
  const [disbursementHistory, setDisbursementHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { showModal, showConfirm } = useUI();

  const handleGeneratePayroll = async () => {
    setIsGenerating(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/disbursements/generate_payroll/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quarter: 'Q1', year: new Date().getFullYear() })
      });
      if (res.ok) {
        const data = await res.json();
        showModal('success', 'Payroll Generated!', data.message);
        fetchDisbursements();
      }
    } catch (error) {
      console.error("Error generating payroll:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const openPayrollConfirm = () => {
    showConfirm(
        'Generate Quarterly Payroll?',
        'This will automatically identify all eligible seniors and create pending disbursement records for the current quarter.',
        handleGeneratePayroll
    );
  };
  const fetchSeniorHistory = async (seniorId: number) => {
    setIsHistoryLoading(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/disbursements/?search=${selectedDisbursement?.senior_osca_id}`);
      if (res.ok) {
        const data = await res.json();
        // Filter only for this specific senior to be sure
        setDisbursementHistory(data.results);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isDetailModalOpen && selectedDisbursement) {
      fetchSeniorHistory(selectedDisbursement.senior);
    }
  }, [isDetailModalOpen, selectedDisbursement]);

  const exportExcelReport = () => {
    // Advanced HTML Excel Spreadsheet Generation
    const headers = [
      "Reference Number", 
      "OSCA ID", 
      "Beneficiary Name", 
      "Barangay", 
      "Disbursement Type", 
      "Milestone Age", 
      "Amount (PHP)", 
      "Quarter", 
      "Year", 
      "Release Date", 
      "Status", 
      "Date Created"
    ];
    
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Payouts Report</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th { font-weight: bold; background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-family: sans-serif; font-size: 10pt; }
          td { border: 1px solid #cbd5e1; padding: 8px; font-family: sans-serif; font-size: 10pt; }
        </style>
      </head>
      <body>
        <h2>CENTENARYO Disbursements & Payouts Report</h2>
        <p>Report Filter: ${statusFilter.toUpperCase()} | Generated Date: ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;
    
    disbursements.forEach(d => {
      const typeLabel = d.disbursement_type === 'SOCIAL_PENSION' ? 'Social Pension' : 'Milestone Gift';
      const ageLabel = d.disbursement_type === 'SOCIAL_PENSION' ? 'N/A' : (d.milestone_age || '—');
      const dateCreated = d.created_at ? new Date(d.created_at).toLocaleDateString() : '—';
      
      tableHtml += `
        <tr>
          <td style="mso-number-format:'\\@';">${d.reference_number || ''}</td>
          <td style="mso-number-format:'\\@';">${d.senior_osca_id || ''}</td>
          <td>${d.senior_name || ''}</td>
          <td>${d.senior_barangay || ''}</td>
          <td>${typeLabel}</td>
          <td>${ageLabel}</td>
          <td style="mso-number-format:'#\\,##0\\.00';">${parseFloat(d.amount).toFixed(2)}</td>
          <td>${d.quarter || ''}</td>
          <td>${d.year || ''}</td>
          <td>${d.release_date || '—'}</td>
          <td>${d.status || ''}</td>
          <td>${dateCreated}</td>
        </tr>
      `;
    });
    
    tableHtml += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Payouts_Report_${statusFilter.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    fetchDisbursements();
  }, [currentPage, statusFilter]);

  const fetchDisbursements = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/disbursements/?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDisbursements(data.results);
        setTotalRecords(data.count);
        setTotalPages(Math.ceil(data.count / 50));
      }
    } catch (error) {
      console.error("Error fetching disbursements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/disbursements/?search=${searchTerm}`);
      if (res.ok) {
        const data = await res.json();
        setDisbursements(data.results);
        setTotalRecords(data.count);
        setTotalPages(Math.ceil(data.count / 50));
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkReleased = async (id: number) => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/disbursements/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RELEASED' }),
      });
      if (res.ok) {
        setDisbursements(prev =>
          prev.map(d => d.id === id ? { ...d, status: 'RELEASED' } : d)
        );
      }
    } catch (error) {
      console.error("Error updating disbursement:", error);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500">

      {/* Page Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end bg-white p-8 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-70 -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <div className="bg-emerald-100 p-2.5 rounded-xl mr-4 text-emerald-600">
              <Banknote size={28} />
            </div>
            Disbursements & Payouts
          </h1>
          <p className="text-slate-500 mt-3 font-medium">
            Monitor cash gifts and pensions distributed to senior citizens.
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
              {totalRecords} transactions
            </span>
          </p>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <form onSubmit={handleSearch} className="relative w-full md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Ref ID or Name..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm font-medium shadow-sm"
            />
          </form>

          <div className="relative group w-full md:w-auto">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-auto pl-11 pr-10 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white text-slate-700 text-sm font-medium cursor-pointer transition-all shadow-sm appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending Payouts</option>
              <option value="RELEASED">Released</option>
            </select>
          </div>

          <button 
            onClick={openPayrollConfirm}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap text-sm font-bold w-full md:w-auto disabled:opacity-50"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <History size={18} />
            )}
            Generate Payroll
          </button>

          <button 
            onClick={exportExcelReport}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap text-sm font-bold w-full md:w-auto"
          >
            <Download size={18} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Removed local Confirmation Modal - Using Global UIContext */}

      {/* Disbursements Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-8 py-5">Ref ID</th>
                <th className="px-8 py-5">Beneficiary</th>
                <th className="px-8 py-5">Barangay</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Quarter / Year</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-slate-500">
                    <div className="flex flex-col justify-center items-center gap-4">
                      <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                      <span className="font-semibold">Fetching transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : disbursements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-slate-500 font-medium">
                    No disbursement records found.
                  </td>
                </tr>
              ) : (
                disbursements.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-6 text-xs font-mono font-bold text-slate-400 bg-slate-50/40 group-hover:bg-transparent transition-colors">
                      {item.reference_number || `#${String(item.id).padStart(8, '0')}`}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[15px]">{item.senior_name || "Unknown Senior"}</span>
                        <span className="text-slate-400 font-mono text-xs font-semibold mt-0.5">{item.senior_osca_id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-slate-600">
                      {item.senior_barangay || "—"}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="font-black text-slate-800 text-lg">
                          ₱{parseFloat(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                        
                        {item.disbursement_type === 'SOCIAL_PENSION' ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-blue-100 text-blue-700">
                            Social Pension (RA 11916)
                          </span>
                        ) : (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                            item.milestone_age === 0 
                              ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                              : parseFloat(item.amount) >= 100000
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {item.milestone_age === 0 
                              ? 'Invalid Milestone (Flagged)' 
                              : item.milestone_age >= 100 
                                ? 'Centenarian (100+)' 
                                : `${item.milestone_age} Y/O Milestone`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-semibold text-slate-700">
                      {item.quarter} · {item.year}
                    </td>
                    <td className="px-8 py-6">
                      {renderStatusBadge(item.status)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setSelectedDisbursement(item); setIsDetailModalOpen(true); }}
                          className="px-4 py-2 bg-slate-50 text-slate-500 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
                        >
                          View Details
                        </button>
                        {item.status === 'PENDING' && (
                          <button
                            onClick={() => handleMarkReleased(item.id)}
                            className="px-4 py-2 bg-white border-2 border-emerald-500 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <CheckCircle size={14} />
                            Mark Released
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      {/* --- DISBURSEMENT DETAIL MODAL --- */}
      {isDetailModalOpen && selectedDisbursement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900">Disbursement Details</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Ref: {selectedDisbursement.reference_number}</p>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Summary Card */}
              <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Current Selected</p>
                    <h3 className="text-lg font-black">{selectedDisbursement.senior_name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedDisbursement.quarter} {selectedDisbursement.year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400">₱{parseFloat(selectedDisbursement.amount).toLocaleString()}</p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedDisbursement.disbursement_type === 'SOCIAL_PENSION' ? 'Pension' : 'Milestone'}</span>
                  </div>
                </div>
              </div>

              {/* History Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <History size={18} className="text-indigo-600" />
                  <h4 className="text-sm font-black uppercase tracking-widest">Transaction History</h4>
                </div>
                
                <div className="space-y-3">
                  {isHistoryLoading ? (
                    <div className="py-12 text-center">
                      <div className="w-8 h-8 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">Loading records...</p>
                    </div>
                  ) : disbursementHistory.length === 0 ? (
                    <p className="py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No history found</p>
                  ) : (
                    disbursementHistory.map((hist, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                        <div className="flex gap-4 items-center">
                          <div className={`p-2 rounded-xl ${hist.status === 'RELEASED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {hist.status === 'RELEASED' ? <CheckCircle size={16} /> : <Clock size={16} />}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">{hist.disbursement_type === 'SOCIAL_PENSION' ? 'Quarterly Pension' : `${hist.milestone_age} Y/O Gift`}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{hist.quarter} {hist.year} · {hist.reference_number}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">₱{parseFloat(hist.amount).toLocaleString()}</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${hist.status === 'RELEASED' ? 'text-emerald-500' : 'text-amber-500'}`}>{hist.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Close
                </button>
                {selectedDisbursement.status === 'PENDING' && (
                  <button
                    onClick={() => { handleMarkReleased(selectedDisbursement.id); setIsDetailModalOpen(false); }}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 transition-all"
                  >
                    Mark Released
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm font-medium text-slate-500">
              Page <span className="text-slate-800 font-bold">{currentPage}</span> of <span className="text-slate-800 font-bold">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-slate-600 text-sm flex items-center shadow-sm"
              >
                <ChevronLeft size={16} className="mr-1" /> Prev
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-slate-600 text-sm flex items-center shadow-sm"
              >
                Next <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
