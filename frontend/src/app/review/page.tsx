"use client";

import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, AlertTriangle, FileText, ChevronRight, Eye, Calendar, User, CheckSquare, RefreshCcw, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { authFetch } from "@/lib/api";
import { useUI } from "@/context/UIContext";

export default function ReviewQueuePage() {
  const { user } = useAuth();
  const { showModal } = useUI();
  const { addNotification } = useNotifications();

  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Review Modal State
  const [selectedSenior, setSelectedSenior] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'psa' | 'osca' | 'photo'>('psa');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Checklist state
  const [checklist, setChecklist] = useState({
    name_match: false,
    dob_match: false,
    sex_match: false,
    document_authentic: false,
  });

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/review-queue/`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (err) {
      console.error("Failed to fetch review queue:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleOpenReview = (senior: any) => {
    setSelectedSenior(senior);
    setActiveTab('psa');
    setRemarks('');
    setChecklist({
      name_match: false,
      dob_match: false,
      sex_match: false,
      document_authentic: false,
    });
  };

  const handleCloseReview = () => {
    setSelectedSenior(null);
  };

  const toggleChecklist = (field: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const isChecklistComplete = Object.values(checklist).every(v => v === true);

  const submitReview = async (action: 'APPROVE' | 'REJECT' | 'RETURN') => {
    if ((action === 'REJECT' || action === 'RETURN') && !remarks.trim()) {
      showModal("error", "Remarks Required", `Please provide remarks when deciding to ${action.toLowerCase()} a registration.`);
      return;
    }

    if (action === 'APPROVE' && !isChecklistComplete) {
      showModal("error", "Incomplete Checklist", "Please complete all verification checklist items before approving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${selectedSenior.id}/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remarks,
          checklist_results: checklist
        })
      });

      if (res.ok) {
        const result = await res.json();
        showModal("success", "Review Submitted", result.message);
        
        // Refresh queue
        fetchQueue();
        handleCloseReview();

        // Notification
        addNotification({
          type: action === 'APPROVE' ? 'DOCUMENT' : 'SECURITY',
          title: `Registration ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
          description: `The registration for ${selectedSenior.first_name} ${selectedSenior.last_name} was ${action.toLowerCase()}.`,
          link: '/seniors',
          targetId: selectedSenior.id
        });
      } else {
        const err = await res.json();
        showModal("error", "Review Failed", err.error || "Failed to submit review.");
      }
    } catch (err) {
      console.error(err);
      showModal("error", "Connection Error", "Failed to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQueue = queue.filter(s => 
    `${s.first_name} ${s.last_name} ${s.osca_id}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto min-h-screen pt-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <CheckSquare className="text-indigo-600" size={40} />
            Document Review Queue
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Verify pending registrations against uploaded documents.</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or OSCA ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <button onClick={fetchQueue} className="flex items-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm transition-all border border-slate-200">
          <RefreshCcw size={18} /> Refresh Queue
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle className="mx-auto text-emerald-300 mb-4" size={64} />
          <h3 className="text-2xl font-black text-slate-700">All Caught Up!</h3>
          <p className="text-slate-500 mt-2 font-medium">There are no pending registrations in the review queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQueue.map(senior => (
            <div key={senior.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-lg">
                  {senior.first_name[0]}{senior.last_name[0]}
                </div>
                <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Pending Review
                </div>
              </div>
              
              <h3 className="text-lg font-black text-slate-800 truncate">
                {senior.first_name} {senior.last_name}
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2">
                <FileText size={14} /> {senior.osca_id}
              </p>
              
              <div className="mt-6 flex-grow">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Auto-Check Results</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-600 flex items-center gap-2"><FileText size={14} className="text-slate-400"/> PSA Cert</span>
                    {senior.auto_check_results?.psa_cert_file?.status === 'PASS' ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle size={14}/> Pass</span> : <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={14}/> Flagged</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-600 flex items-center gap-2"><User size={14} className="text-slate-400"/> OSCA ID</span>
                    {senior.auto_check_results?.primary_id_file?.status === 'PASS' ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle size={14}/> Pass</span> : <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={14}/> Flagged</span>}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2 rounded-xl">
                    <span className="text-slate-600 flex items-center gap-2"><ImageIcon size={14} className="text-slate-400"/> 2x2 Photo</span>
                    {senior.auto_check_results?.picture_2x2_file?.status === 'PASS' ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle size={14}/> Pass</span> : <span className="text-rose-500 flex items-center gap-1"><XCircle size={14}/> Fail</span>}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleOpenReview(senior)}
                className="mt-6 w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                Open Review <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedSenior && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-lg">
                    {selectedSenior.first_name[0]}{selectedSenior.last_name[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">{selectedSenior.first_name} {selectedSenior.last_name}</h2>
                    <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
                      <FileText size={14} /> OSCA ID: {selectedSenior.osca_id}
                    </p>
                  </div>
                </div>
              </div>
              <button onClick={handleCloseReview} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col lg:flex-row flex-grow overflow-hidden">
              
              {/* Left Column: Form Data & Checklist */}
              <div className="w-full lg:w-1/3 bg-white p-8 border-r border-slate-100 overflow-y-auto flex flex-col">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><User size={14}/> Registration Data</h3>
                
                <div className="space-y-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name</div>
                    <div className="font-bold text-slate-800">{selectedSenior.first_name} {selectedSenior.middle_name} {selectedSenior.last_name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date of Birth</div>
                      <div className="font-bold text-slate-800 flex items-center gap-2"><Calendar size={14} className="text-slate-400"/> {selectedSenior.date_of_birth}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sex</div>
                      <div className="font-bold text-slate-800">{selectedSenior.sex}</div>
                    </div>
                  </div>
                </div>

                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><CheckSquare size={14}/> Reviewer Checklist</h3>
                
                <div className="space-y-3 mb-8">
                  {[
                    { key: 'name_match', label: 'Name exactly matches uploaded documents' },
                    { key: 'dob_match', label: 'Date of Birth matches documents' },
                    { key: 'sex_match', label: 'Sex matches PSA Birth Certificate' },
                    { key: 'document_authentic', label: 'Documents appear authentic and valid' },
                  ].map(item => (
                    <label key={item.key} className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${checklist[item.key as keyof typeof checklist] ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 ${checklist[item.key as keyof typeof checklist] ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent'}`}>
                        <CheckCircle size={14} />
                      </div>
                      <span className={`text-sm font-bold ${checklist[item.key as keyof typeof checklist] ? 'text-emerald-900' : 'text-slate-600'}`}>{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mb-8 flex-grow">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Remarks</h3>
                  <textarea 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add notes for approval or reasons for rejection..."
                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

              </div>

              {/* Right Column: Document Viewer */}
              <div className="w-full lg:w-2/3 bg-slate-50 flex flex-col p-6">
                
                {/* Tabs */}
                <div className="flex gap-2 mb-4 p-1 bg-slate-200/50 rounded-2xl w-fit">
                  <button 
                    onClick={() => setActiveTab('psa')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'psa' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                  >
                    PSA Birth Cert
                  </button>
                  <button 
                    onClick={() => setActiveTab('osca')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'osca' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                  >
                    OSCA ID
                  </button>
                  <button 
                    onClick={() => setActiveTab('photo')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'photo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                  >
                    2x2 Photo
                  </button>
                </div>

                {/* Auto Check Result Banner */}
                <div className="mb-4">
                   {(() => {
                     const results = selectedSenior.auto_check_results;
                     const currentField = activeTab === 'psa' ? 'psa_cert_file' : activeTab === 'osca' ? 'primary_id_file' : 'picture_2x2_file';
                     const status = results?.[currentField]?.status;
                     
                     if (status === 'PASS') return <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2"><CheckCircle size={16}/> Auto-Check Passed</div>;
                     if (status === 'FAIL') return <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2"><XCircle size={16}/> Auto-Check Failed</div>;
                     if (status === 'NEEDS_REVIEW') return <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-sm font-bold flex items-center gap-2"><AlertTriangle size={16}/> Auto-Check Flagged: Manual verification required.</div>;
                     return null;
                   })()}
                </div>

                {/* Viewer */}
                <div className="flex-grow bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center">
                   {(() => {
                     const url = activeTab === 'psa' ? selectedSenior.psa_cert_file : activeTab === 'osca' ? selectedSenior.primary_id_file : selectedSenior.picture_2x2_file;
                     
                     if (!url) {
                       return <div className="text-slate-400 font-bold flex flex-col items-center gap-3"><Eye size={48} className="opacity-20"/> No Document Uploaded</div>;
                     }

                     const isImage = url.toLowerCase().match(/.(jpeg|jpg|gif|png)$/) != null;

                     if (isImage || activeTab === 'photo') {
                       return <img src={url} alt="Document" className="max-w-full max-h-full object-contain p-4" />;
                     } else {
                       return <embed src={url} type="application/pdf" className="w-full h-full" />;
                     }
                   })()}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
              <button 
                onClick={() => submitReview('RETURN')}
                disabled={isSubmitting}
                className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-black text-sm transition-all disabled:opacity-50"
              >
                Return for Correction
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => submitReview('REJECT')}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-black text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <XCircle size={18} /> Reject Registration
                </button>
                <button 
                  onClick={() => submitReview('APPROVE')}
                  disabled={!isChecklistComplete || isSubmitting}
                  className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${isChecklistComplete ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  <CheckCircle size={18} /> {isSubmitting ? 'Approving...' : 'Approve & Register'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
