"use client";

import React, { useState, useEffect } from 'react';
import { 
  Search, CheckCircle, XCircle, AlertTriangle, FileText, ChevronRight, 
  Eye, Calendar, User, CheckSquare, RefreshCcw, Image as ImageIcon, X,
  ShieldCheck, RotateCcw, AlertCircle, Sparkles, UserCheck, Phone, Users
} from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { authFetch } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import PdfViewer from "@/components/PdfViewer";

export default function ReviewQueuePage() {
  const { user, isAdmin } = useAuth();
  const { showModal } = useUI();
  const { addNotification } = useNotifications();

  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Review Modal State
  const [selectedSenior, setSelectedSenior] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'psa' | 'osca' | 'rep'>('psa');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Return for Correction Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedReturnReason, setSelectedReturnReason] = useState('');
  const [customReturnReason, setCustomReturnReason] = useState('');

  const COMMON_REJECTION_REASONS = [
    "PSA Birth Certificate is invalid or illegible",
    "OSCA ID Card is fraudulent or altered",
    "Biometric face comparison indicates a different individual (fraud risk)",
    "Document uploaded belongs to another person in registry",
    "Applicant does not meet the minimum age requirement (under 78)",
    "Missing vital civil registry signatures or official seal",
  ];

  const COMMON_RETURN_REASONS = [
    "Uploaded PSA Birth Certificate is blurry or low resolution",
    "OSCA ID photo or serial number is truncated or poorly scanned",
    "2x2 Photo does not follow required plain white background",
    "Spelling discrepancy in name/birthdate between form and document",
    "Authorized representative authorization letter or ID requires resubmission",
  ];

  // Four-Eyes COA Audit Checklist
  const [checklist, setChecklist] = useState({
    name_match: false,
    dob_match: false,
    photo_match: false,
    document_authentic: false,
  });

  const getCleanFileUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('/')) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
      return `${apiBase}${url}`;
    }
    if (url.includes('centenary0.onrender.com')) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
      return url.replace(/https?:\/\/centenary0\.onrender\.com/, apiBase);
    }
    return url;
  };

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

    // Pre-fill checklist items based on automated pre-screening analysis
    const autoChecks = senior.auto_check_results || {};
    const ocrMatch = autoChecks.ocr_psa?.name_found ?? false;
    const dobMatch = autoChecks.ocr_psa?.dob_found ?? false;
    const faceMatch = autoChecks.face_match?.status === 'PASS';
    const hashUnique = autoChecks.hash_check?.status !== 'FLAGGED';

    setChecklist({
      name_match: Boolean(ocrMatch),
      dob_match: Boolean(dobMatch),
      photo_match: Boolean(faceMatch),
      document_authentic: Boolean(hashUnique),
    });

    // Auto-extract and cache isolated biometric face crops via OpenCV if not already saved
    if ((!autoChecks.photo_face_crop || !autoChecks.osca_face_crop) && (senior.picture_2x2_file || senior.primary_id_file)) {
      authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${senior.id}/extract-face-crops/`, {
        method: 'POST',
      }).then(async (res) => {
        if (res.ok) {
          const updatedSenior = await res.json();
          setSelectedSenior((current: any) => current && current.id === updatedSenior.id ? updatedSenior : current);
          setQueue((prevQueue: any[]) => prevQueue.map(item => item.id === updatedSenior.id ? updatedSenior : item));
        }
      }).catch(err => console.warn("Auto-extract face crops notice:", err));
    }
  };

  const handleCloseReview = () => {
    setSelectedSenior(null);
  };

  const toggleChecklist = (field: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const isChecklistComplete = Object.values(checklist).every(v => v === true);

  const submitReview = async (action: 'APPROVE' | 'REJECT' | 'RETURN', customRemarks?: string) => {
    const finalRemarks = customRemarks || remarks;
    if ((action === 'REJECT' || action === 'RETURN') && !finalRemarks.trim()) {
      showModal("error", "Reason Required", `Please provide a reason to ${action === 'REJECT' ? 'reject' : 'return'} this registration.`);
      return;
    }

    if (action === 'APPROVE' && !isChecklistComplete) {
      showModal("warning", "Checklist Incomplete", "Please certify all items on the Four-Eyes Verification Checklist before approving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${selectedSenior.id}/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remarks: finalRemarks,
          checklist_results: action === 'APPROVE' ? checklist : {}
        })
      });

      if (res.ok) {
        const result = await res.json();
        showModal("success", "Review Submitted", result.message);
        
        // Close modals
        setIsRejectModalOpen(false);
        setIsReturnModalOpen(false);
        handleCloseReview();
        fetchQueue();

        // Trigger Notification
        if (action === 'RETURN') {
          addNotification({
            type: 'DOCUMENT',
            title: '⚠️ Returned for Correction',
            description: `Admin returned registration for ${selectedSenior.first_name} ${selectedSenior.last_name}: "${finalRemarks}"`,
            link: `/seniors?regStatus=RETURNED&highlight=${selectedSenior.id}`,
            targetId: selectedSenior.id
          });
        } else {
          addNotification({
            type: action === 'APPROVE' ? 'DOCUMENT' : 'SECURITY',
            title: action === 'APPROVE' ? 'Registration Approved' : 'Registration Rejected',
            description: `The application for ${selectedSenior.first_name} ${selectedSenior.last_name} was ${action.toLowerCase()}d.`,
            link: `/seniors?highlight=${selectedSenior.id}`,
            targetId: selectedSenior.id
          });
        }
      } else {
        const err = await res.json();
        showModal("error", "Review Failed", err.error || "Failed to submit review decision.");
      }
    } catch (err) {
      console.error(err);
      showModal("error", "Connection Error", "Failed to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQueue = queue.filter(s => 
    `${s.first_name} ${s.last_name} ${s.osca_id} ${s.barangay}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (user && !isAdmin) {
    return (
      <div className="p-8 pb-20 max-w-7xl mx-auto min-h-screen pt-24 flex flex-col items-center justify-center">
        <AlertTriangle className="text-rose-500 mb-4 animate-bounce" size={64} />
        <h1 className="text-3xl font-black text-slate-800">Access Denied</h1>
        <p className="text-slate-500 mt-2 font-medium text-center max-w-md">
          Only administrators are authorized to access the Document Review Queue.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto min-h-screen pt-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <CheckSquare className="text-indigo-600" size={40} />
            Document Review Queue
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Assisted automated pre-screening & four-eyes administrative verification under R.A. 11982.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, OSCA ID, or barangay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <button 
          onClick={fetchQueue} 
          className="flex items-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm transition-all border border-slate-200"
        >
          <RefreshCcw size={18} /> Refresh Queue ({filteredQueue.length})
        </button>
      </div>

      {/* Queue Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle className="mx-auto text-emerald-300 mb-4" size={64} />
          <h3 className="text-2xl font-black text-slate-700">All Caught Up!</h3>
          <p className="text-slate-500 mt-2 font-medium">There are no pending registrations awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQueue.map(senior => {
            const autoChecks = senior.auto_check_results || {};
            const faceScore = autoChecks.face_match?.similarity_pct;
            const hasDuplicate = Boolean(autoChecks.duplicate_detected?.length);
            const isReturned = senior.registration_status === 'RETURNED';

            return (
              <div 
                key={senior.id} 
                className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-lg overflow-hidden border border-indigo-100">
                      {senior.picture_2x2_file ? (
                        <img 
                          src={getCleanFileUrl(senior.picture_2x2_file)} 
                          alt="Senior" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        `${senior.first_name[0]}${senior.last_name[0]}`
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                        isReturned ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        <AlertTriangle size={12} /> {senior.registration_status.replace('_', ' ')}
                      </div>
                      {hasDuplicate && (
                        <div className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-black uppercase tracking-wider">
                          Duplicate Alert
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-black text-slate-800 truncate">
                    {senior.first_name} {senior.middle_name ? `${senior.middle_name[0]}. ` : ''}{senior.last_name}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <FileText size={13} /> {senior.osca_id}
                  </p>

                  {/* Pre-Screening Badges */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {faceScore !== undefined ? (
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        faceScore >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : (faceScore >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100')
                      }`}>
                        🎯 Face: {faceScore}%
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100">
                        Face: Manual
                      </span>
                    )}

                    {autoChecks.ocr_psa?.name_found ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                        ✓ PSA OCR
                      </span>
                    ) : null}

                    {autoChecks.hash_check?.status === 'PASS' ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-100">
                        🛡️ Unique Hash
                      </span>
                    ) : null}
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400">Barangay</span>
                      <span className="text-slate-700 uppercase">{senior.barangay}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400">Date of Birth</span>
                      <span className="text-slate-700">{senior.date_of_birth}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleOpenReview(senior)}
                  className="mt-6 w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  Inspect & Verify <ChevronRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Return for Correction Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[170] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <RotateCcw className="text-amber-500" size={28} />
                Return for Correction
              </h3>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Select the defect to instruct staff to re-upload or correct the applicant's record.
              </p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {COMMON_RETURN_REASONS.map((reason) => (
                <label 
                  key={reason} 
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedReturnReason === reason ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="returnReason"
                    value={reason}
                    checked={selectedReturnReason === reason}
                    onChange={() => {
                      setSelectedReturnReason(reason);
                      setCustomReturnReason('');
                    }}
                    className="mt-1 accent-amber-500"
                  />
                  <span className={`text-sm font-bold ${selectedReturnReason === reason ? 'text-amber-950' : 'text-slate-600'}`}>{reason}</span>
                </label>
              ))}

              <label 
                className={`flex flex-col gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedReturnReason === 'Others' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="returnReason"
                    value="Others"
                    checked={selectedReturnReason === 'Others'}
                    onChange={() => setSelectedReturnReason('Others')}
                    className="mt-1 accent-amber-500"
                  />
                  <span className={`text-sm font-bold ${selectedReturnReason === 'Others' ? 'text-amber-950' : 'text-slate-600'}`}>
                    Custom Instructions (Type below)
                  </span>
                </div>
                {selectedReturnReason === 'Others' && (
                  <textarea
                    value={customReturnReason}
                    onChange={(e) => setCustomReturnReason(e.target.value)}
                    placeholder="Enter specific correction instructions for the encoder..."
                    className="w-full h-24 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                  />
                )}
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setSelectedReturnReason('');
                  setCustomReturnReason('');
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const reason = selectedReturnReason === 'Others' ? customReturnReason : selectedReturnReason;
                  if (!reason.trim()) {
                    showModal("error", "Reason Required", "Please choose an instruction or provide custom remarks.");
                    return;
                  }
                  await submitReview('RETURN', reason);
                }}
                disabled={isSubmitting}
                className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[170] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <XCircle className="text-rose-500" size={28} />
                Disqualify & Reject
              </h3>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Select the legal or compliance reason for rejecting this registry request.
              </p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {COMMON_REJECTION_REASONS.map((reason) => (
                <label 
                  key={reason} 
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedReason === reason ? 'border-rose-500 bg-rose-50' : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejectionReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => {
                      setSelectedReason(reason);
                      setCustomReason('');
                    }}
                    className="mt-1 accent-rose-500"
                  />
                  <span className={`text-sm font-bold ${selectedReason === reason ? 'text-rose-900' : 'text-slate-600'}`}>{reason}</span>
                </label>
              ))}

              <label 
                className={`flex flex-col gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedReason === 'Others' ? 'border-rose-500 bg-rose-50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="rejectionReason"
                    value="Others"
                    checked={selectedReason === 'Others'}
                    onChange={() => setSelectedReason('Others')}
                    className="mt-1 accent-rose-500"
                  />
                  <span className={`text-sm font-bold ${selectedReason === 'Others' ? 'text-rose-900' : 'text-slate-600'}`}>
                    Others (Specify reason)
                  </span>
                </div>
                {selectedReason === 'Others' && (
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter custom rejection reason here..."
                    className="w-full h-24 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"
                  />
                )}
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setSelectedReason('');
                  setCustomReason('');
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const reason = selectedReason === 'Others' ? customReason : selectedReason;
                  if (!reason.trim()) {
                    showModal("error", "Reason Required", "Please choose a reason or provide custom remarks.");
                    return;
                  }
                  await submitReview('REJECT', reason);
                }}
                disabled={isSubmitting}
                className="px-8 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-rose-500/20"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN DUAL SPLIT-VIEW REVIEW MODAL */}
      {selectedSenior && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[36px] w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
            
            {/* Modal Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-200">
                  {selectedSenior.first_name[0]}{selectedSenior.last_name[0]}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">
                    {selectedSenior.first_name} {selectedSenior.middle_name} {selectedSenior.last_name}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 flex items-center gap-2 mt-0.5">
                    <FileText size={14} className="text-indigo-500" /> OSCA ID: {selectedSenior.osca_id}
                    <span className="text-slate-300">•</span>
                    <span className="uppercase text-slate-600">{selectedSenior.barangay}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleCloseReview} 
                  className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: DUAL SPLIT-VIEW */}
            <div className="flex flex-col lg:flex-row flex-grow overflow-hidden">
              
              {/* LEFT COLUMN: Dossier, Photo, Auto-Scorecard, Checklist */}
              <div className="w-full lg:w-5/12 bg-white p-6 lg:p-7 border-r border-slate-100 overflow-y-auto flex flex-col gap-6">
                
                {/* 1. Side-by-Side Biometric Face Comparison Card (OSCA ID vs 2x2 Photo) */}
                <div className="bg-gradient-to-br from-indigo-900/5 via-slate-50 to-indigo-50/30 p-5 rounded-3xl border border-indigo-100/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-950">
                        Biometric Face Inspection & Cross-Match
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      (selectedSenior.auto_check_results?.face_match?.similarity_pct || 0) >= 70
                        ? 'bg-emerald-100 text-emerald-800'
                        : ((selectedSenior.auto_check_results?.face_match?.similarity_pct || 0) >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800')
                    }`}>
                      {selectedSenior.auto_check_results?.face_match?.similarity_pct
                        ? `${selectedSenior.auto_check_results.face_match.similarity_pct}% Match`
                        : 'Manual Inspection'}
                    </span>
                  </div>

                  {/* Side-by-Side Face Frames */}
                  <div className="grid grid-cols-11 items-center gap-2">
                    {/* Left: OSCA ID Face Crop */}
                    <div className="col-span-5 flex flex-col items-center gap-1.5 p-2.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border-2 border-indigo-200 flex items-center justify-center">
                        {selectedSenior.auto_check_results?.osca_face_crop ? (
                          <img 
                            src={selectedSenior.auto_check_results.osca_face_crop} 
                            alt="OSCA ID Face" 
                            className="w-full h-full object-cover" 
                          />
                        ) : selectedSenior.primary_id_file ? (
                          <img 
                            src={getCleanFileUrl(selectedSenior.primary_id_file)} 
                            alt="OSCA ID" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User size={28} className="text-slate-300" />
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[8px] font-black text-white text-center py-0.5 uppercase tracking-tighter">
                          OSCA ID
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Document Crop
                      </span>
                    </div>

                    {/* Center Connector Badge */}
                    <div className="col-span-1 flex flex-col items-center justify-center text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm ${
                        (selectedSenior.auto_check_results?.face_match?.similarity_pct || 0) >= 70
                          ? 'bg-emerald-500 text-white shadow-emerald-200'
                          : ((selectedSenior.auto_check_results?.face_match?.similarity_pct || 0) >= 50
                              ? 'bg-amber-500 text-white shadow-amber-200'
                              : 'bg-rose-500 text-white shadow-rose-200')
                      }`}>
                        ⇄
                      </div>
                    </div>

                    {/* Right: 2x2 Photo Face Crop */}
                    <div className="col-span-5 flex flex-col items-center gap-1.5 p-2.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border-2 border-indigo-200 flex items-center justify-center">
                        {selectedSenior.auto_check_results?.photo_face_crop ? (
                          <img 
                            src={selectedSenior.auto_check_results.photo_face_crop} 
                            alt="2x2 Face" 
                            className="w-full h-full object-cover" 
                          />
                        ) : selectedSenior.picture_2x2_file ? (
                          <img 
                            src={getCleanFileUrl(selectedSenior.picture_2x2_file)} 
                            alt="2x2 Photo" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User size={28} className="text-slate-300" />
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-indigo-600 text-[8px] font-black text-white text-center py-0.5 uppercase tracking-tighter">
                          2x2 PHOTO
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Applicant Anchor
                      </span>
                    </div>
                  </div>

                  {/* Biometric description */}
                  <div className="p-2.5 bg-white/80 rounded-xl border border-indigo-100 text-[11px] text-slate-600 font-medium flex items-center gap-2">
                    <CheckCircle size={14} className="text-indigo-600 shrink-0" />
                    <span>
                      {selectedSenior.auto_check_results?.face_match?.message || 
                        "OpenCV multi-stage cascade detector isolated facial biometrics for side-by-side administrative audit."}
                    </span>
                  </div>
                </div>

                {/* 2. Automated Pre-Screening Scorecard */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-indigo-600" /> Integrity & Civil Registry Verification
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">

                    {/* OCR Check */}
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">📄</span>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">PSA Document OCR Check</div>
                          <div className="text-[11px] font-medium text-slate-500">
                            {selectedSenior.auto_check_results?.ocr_psa?.message || "Extracted certificate text validated"}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        selectedSenior.auto_check_results?.ocr_psa?.status === 'PASS' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedSenior.auto_check_results?.ocr_psa?.status === 'PASS' ? 'Passed' : 'Review'}
                      </span>
                    </div>

                    {/* Hash Uniqueness */}
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">🛡️</span>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">SHA-256 Deduplication Check</div>
                          <div className="text-[11px] font-medium text-slate-500">
                            {selectedSenior.auto_check_results?.duplicate_detected?.length 
                              ? "Warning: Duplicate document found" 
                              : "Unique document files verified in registry"}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        selectedSenior.auto_check_results?.duplicate_detected?.length 
                          ? 'bg-rose-100 text-rose-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {selectedSenior.auto_check_results?.duplicate_detected?.length ? 'Collision' : 'Unique'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Four-Eyes COA Audit Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-indigo-600" /> COA Compliance Audit Checklist
                    </h3>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      All 4 required
                    </span>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer select-none p-1">
                      <input 
                        type="checkbox" 
                        checked={checklist.name_match} 
                        onChange={() => toggleChecklist('name_match')}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Senior Full Name matches form and civil registry
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer select-none p-1">
                      <input 
                        type="checkbox" 
                        checked={checklist.dob_match} 
                        onChange={() => toggleChecklist('dob_match')}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Birthdate confirms senior is 78+ eligible milestone
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer select-none p-1">
                      <input 
                        type="checkbox" 
                        checked={checklist.photo_match} 
                        onChange={() => toggleChecklist('photo_match')}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-slate-700">
                        2x2 Photo verified to match OSCA ID Card portrait
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer select-none p-1">
                      <input 
                        type="checkbox" 
                        checked={checklist.document_authentic} 
                        onChange={() => toggleChecklist('document_authentic')}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Documents authenticated without signs of alteration
                      </span>
                    </label>
                  </div>
                </div>

                {/* 4. Remarks Textarea */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Administrative Remarks
                  </h3>
                  <textarea 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add certification notes, audit remarks, or defect observations..."
                    className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

              </div>

              {/* RIGHT COLUMN: High-Resolution Document Viewer */}
              <div className="w-full lg:w-7/12 bg-slate-100 flex flex-col p-6 overflow-hidden">
                
                {/* Tabs */}
                <div className="flex gap-2 mb-4 p-1.5 bg-slate-200/70 rounded-2xl w-fit">
                  <button 
                    onClick={() => setActiveTab('psa')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                      activeTab === 'psa' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    PSA Birth Certificate
                  </button>
                  <button 
                    onClick={() => setActiveTab('osca')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                      activeTab === 'osca' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    OSCA ID Card
                  </button>
                  {selectedSenior.annex_a_data?.reps?.length > 0 && selectedSenior.annex_a_data?.reps[0]?.name && (
                    <button 
                      onClick={() => setActiveTab('rep')}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                        activeTab === 'rep' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Proxy / Representative
                    </button>
                  )}
                </div>

                {/* Viewer Container */}
                <div className="flex-grow bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative">
                  {activeTab === 'rep' ? (
                    <div className="p-8 max-w-lg w-full space-y-6 animate-in fade-in">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Users size={24} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-800">Authorized Representative / Proxy</h4>
                          <p className="text-xs font-medium text-slate-500">Filed on behalf of senior citizen</p>
                        </div>
                      </div>

                      <div className="space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Representative Full Name</div>
                          <div className="text-sm font-black text-slate-800 mt-0.5">
                            {selectedSenior.annex_a_data?.reps[0]?.name || "N/A"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Relationship to Senior</div>
                          <div className="text-sm font-bold text-slate-700 mt-0.5">
                            {selectedSenior.annex_a_data?.reps[0]?.relation || "N/A"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact Number</div>
                          <div className="text-sm font-bold text-slate-700 mt-0.5 flex items-center gap-1.5">
                            <Phone size={13} className="text-slate-400" />
                            {selectedSenior.annex_a_data?.reps[0]?.contact || "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (() => {
                    const rawUrl = activeTab === 'psa' ? selectedSenior.psa_cert_file : selectedSenior.primary_id_file;
                    const url = getCleanFileUrl(rawUrl);
                    
                    if (!url) {
                      return (
                        <div className="text-slate-400 font-bold flex flex-col items-center gap-3">
                          <Eye size={48} className="opacity-20" /> No Document File Attached
                        </div>
                      );
                    }

                    const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) != null;

                    if (isImage) {
                      return (
                        <div className="flex flex-col items-center justify-center w-full h-full p-6 gap-2">
                          <img 
                            src={url} 
                            alt="Document Preview" 
                            className="max-w-full max-h-[88%] object-contain rounded-xl shadow-sm" 
                          />
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-black mt-2 underline"
                          >
                            🔗 Open High-Res Image in New Tab
                          </a>
                        </div>
                      );
                    } else {
                      return (
                        <div className="w-full h-full p-4 overflow-hidden flex flex-col">
                          <PdfViewer url={url} />
                        </div>
                      );
                    }
                  })()}
                </div>

              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 px-8">
              <div className="text-xs font-medium text-slate-400">
                {isChecklistComplete ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle size={15} /> All verification checklist items certified.
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold flex items-center gap-1.5">
                    <AlertCircle size={15} /> Complete all 4 checklist items to enable approval.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={isSubmitting}
                  className="px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <XCircle size={16} /> Disqualify & Reject
                </button>

                <button 
                  onClick={() => setIsReturnModalOpen(true)}
                  disabled={isSubmitting}
                  className="px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw size={16} /> Return for Correction
                </button>

                <button 
                  onClick={() => submitReview('APPROVE')}
                  disabled={isSubmitting || !isChecklistComplete}
                  className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${
                    !isChecklistComplete 
                      ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                  }`}
                >
                  <CheckCircle size={16} /> {isSubmitting ? 'Approving...' : 'Approve & Register'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
