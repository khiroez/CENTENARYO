"use client";

import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Edit, Trash2, X, FileText, CheckSquare, PlusCircle, MinusCircle, AlertCircle, RefreshCcw, UserX, Upload, FileCheck, Image as ImageIcon, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/api';

export default function SeniorRegistryPage() {
  const [seniors, setSeniors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sexFilter, setSexFilter] = useState("all");
  const [brgyFilter, setBrgyFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedSeniorForStatus, setSelectedSeniorForStatus] = useState<any>(null);
  
  const initialFormState = {
    rrn: '', osca_id_year: '', osca_id_serial: '',
    last_name: '', given_name: '', middle_name: '',
    date_of_birth: '', age: '',
    res_house: '', res_street: '', res_brgy: '', res_city: '', res_prov: '', res_zip: '',
    perm_house: '', perm_street: '', perm_brgy: '', perm_city: '', perm_prov: '', perm_zip: '',
    same_as_res: false,
    sex: '', civil_status: '',
    citizenship: 'Filipino', dual_citizenship_details: '',
    spouse_name: '', spouse_citizenship: '',
    children: [''], 
    reps: [{ name: '', relation: '' }],
    contact_number: '', email: '',
    primary_ben_name: '', primary_ben_rel: '',
    cont_ben_name: '', cont_ben_rel: '',
    utilization: [] as string[],
    utilization_others: '',
    consent_privacy: false,
    consent_truth: false,
    status: 'ACTIVE',
    psa_cert_file: null as File | null,
    primary_id_file: null as File | null,
    picture_2x2_file: null as File | null,
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchSeniors();
  }, [currentPage, ageFilter, statusFilter, sexFilter]);

  const fetchSeniors = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: currentPage.toString(),
        filter: ageFilter,
        status: statusFilter,
        sex: sexFilter,
        barangay: brgyFilter,
        search: searchTerm
      });
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSeniors(data.results || []);
        setTotalRecords(data.count || 0);
      }
    } catch (error) { console.error("Error fetching seniors:", error); } finally { setIsLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSeniors();
  };

  // --- AGE CALCULATION HELPER ---
  const calculateAge = (dob: string) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
    return age.toString();
  };

  const handleDobChange = (dob: string) => {
    setFormData({ ...formData, date_of_birth: dob, age: calculateAge(dob) });
  };

  const handleNameInput = (value: string) => value.replace(/[^a-zA-Z\s\-]/g, "").toUpperCase();
  const handleNumberInput = (value: string) => value.replace(/\D/g, "");

  const getStatusStyle = (status: string) => {
    switch(status) {
        case 'ACTIVE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        case 'DECEASED': return 'bg-slate-100 text-slate-500 border-slate-200';
        case 'TRANSFERRED': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
        case 'SUSPENDED': return 'bg-rose-50 text-rose-600 border-rose-200';
        default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const handleEditClick = (senior: any) => {
    setIsEditMode(true);
    setEditingId(senior.id);
    const oscaParts = senior.osca_id ? senior.osca_id.split('-') : ['', '', ''];
    const annexData = senior.annex_a_data || {};
    setFormData({
      ...initialFormState,
      ...annexData,
      given_name: senior.first_name,
      last_name: senior.last_name,
      middle_name: senior.middle_name || '',
      date_of_birth: senior.date_of_birth,
      age: calculateAge(senior.date_of_birth),
      osca_id_year: oscaParts[1] || '',
      osca_id_serial: oscaParts[2] || '',
      res_brgy: senior.barangay,
      status: senior.status || 'ACTIVE',
      consent_privacy: true,
      consent_truth: true
    });
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedSeniorForStatus) return;
    setIsSubmitting(true);
    try {
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${selectedSeniorForStatus.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus, is_active: newStatus === 'ACTIVE' })
        });
        if (res.ok) { setIsStatusModalOpen(false); fetchSeniors(); }
    } catch (error) { console.error("Error updating status:", error); } finally { setIsSubmitting(false); }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.osca_id_year || !formData.osca_id_serial) { alert("Pakikumpleto ang OSCA ID."); return; }
    if (!formData.consent_privacy || !formData.consent_truth) { alert("Kailangan mong lagyan ng check ang Data Privacy at Truthfulness statements."); return; }

    setIsSubmitting(true);
    try {
      const fullOscaId = `OSCA-${formData.osca_id_year}-${formData.osca_id_serial}`;
      const fd = new FormData();
      fd.append('first_name', formData.given_name);
      fd.append('last_name', formData.last_name);
      fd.append('middle_name', formData.middle_name);
      fd.append('date_of_birth', formData.date_of_birth);
      fd.append('osca_id', fullOscaId);
      fd.append('barangay', formData.res_brgy);
      fd.append('status', formData.status);
      fd.append('is_active', (formData.status === 'ACTIVE').toString());
      fd.append('annex_a_data', JSON.stringify(formData));

      if (formData.psa_cert_file) fd.append('psa_cert_file', formData.psa_cert_file);
      if (formData.primary_id_file) fd.append('primary_id_file', formData.primary_id_file);
      if (formData.picture_2x2_file) fd.append('picture_2x2_file', formData.picture_2x2_file);

      const url = isEditMode ? `${process.env.NEXT_PUBLIC_API_URL}/seniors/${editingId}/` : `${process.env.NEXT_PUBLIC_API_URL}/seniors/`;
      const res = await authFetch(url, { method: isEditMode ? 'PATCH' : 'POST', body: fd });
      if (res.ok) { setIsModalOpen(false); setFormData(initialFormState); fetchSeniors(); }
    } catch (error) { console.error("Error submitting form:", error); } finally { setIsSubmitting(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) { setFormData({...formData, [field]: e.target.files[0]}); }
  };

  const handleUtilizationChange = (value: string) => {
    const isChecked = formData.utilization.includes(value);
    setFormData({ ...formData, utilization: isChecked ? formData.utilization.filter(item => item !== value) : [...formData.utilization, value] });
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end bg-white p-8 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <div className="bg-indigo-100 p-2.5 rounded-xl mr-4 text-indigo-600 shadow-sm"><Users size={28} /></div>
            Senior Registry
          </h1>
          <p className="text-slate-500 mt-3 font-medium">Manage and monitor NCSC beneficiaries.</p>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <form onSubmit={handleSearch} className="relative w-full md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search Name or ID..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm" />
          </form>
          <button onClick={() => { setFormData(initialFormState); setIsEditMode(false); setIsModalOpen(true); }} className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap text-sm font-bold w-full md:w-auto">
            <Plus size={18} />
            <span>Bagong Rekord</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 mr-2"><Filter size={18}/><span className="text-xs font-black uppercase tracking-widest">Filters</span></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all cursor-pointer"><option value="all">ALL STATUS</option><option value="ACTIVE">ACTIVE</option><option value="DECEASED">DECEASED</option><option value="TRANSFERRED">TRANSFERRED</option><option value="SUSPENDED">SUSPENDED</option></select>
        <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all cursor-pointer"><option value="all">ALL AGES</option><option value="eligible">ELIGIBLE (80+)</option><option value="upcoming">UPCOMING (78-79)</option></select>
        <select value={sexFilter} onChange={(e) => setSexFilter(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all cursor-pointer"><option value="all">ALL SEX</option><option value="Male">MALE</option><option value="Female">FEMALE</option></select>
        <div className="relative group flex-1 min-w-[200px]"><input type="text" value={brgyFilter} onChange={(e) => setBrgyFilter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchSeniors()} placeholder="Barangay..." className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all" /><button onClick={fetchSeniors} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600"><RefreshCcw size={14} /></button></div>
        <button onClick={() => { setStatusFilter("all"); setAgeFilter("all"); setSexFilter("all"); setBrgyFilter(""); setSearchTerm(""); }} className="px-4 py-2 text-slate-400 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest transition-colors">Reset</button>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-8 py-5">OSCA ID</th>
                <th className="px-8 py-5">Pangalan</th>
                <th className="px-8 py-5">Kapanganakan & Edad</th>
                <th className="px-8 py-5">Barangay</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Aksyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (<tr><td colSpan={6} className="p-20 text-center"><div className="flex flex-col items-center gap-4"><div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div><span className="font-semibold text-slate-500">Kinukuha ang mga datos...</span></div></td></tr>) : seniors.length === 0 ? (<tr><td colSpan={6} className="p-20 text-center font-bold text-slate-400">Walang natagpuang record.</td></tr>) : (seniors.map((senior) => (
                  <tr key={senior.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-5 font-mono font-bold text-slate-400 tracking-tighter">{senior.osca_id || "N/A"}</td>
                    <td className="px-8 py-5 font-bold text-slate-800 uppercase">{senior.last_name}, {senior.first_name}</td>
                    <td className="px-8 py-5"><div className="flex flex-col gap-1"><span className="font-medium">{new Date(senior.date_of_birth).toLocaleDateString()}</span>{(() => { const dob = new Date(senior.date_of_birth); const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--; return <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-slate-100 text-slate-500 w-fit">{age} YRS OLD</span>; })()}</div></td>
                    <td className="px-8 py-5 font-medium">{senior.barangay || "LGU"}</td>
                    <td className="px-8 py-5"><span className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${getStatusStyle(senior.status)}`}>{senior.status || 'ACTIVE'}</span></td>
                    <td className="px-8 py-5 flex justify-end gap-2"><button onClick={() => { setSelectedSeniorForStatus(senior); setIsStatusModalOpen(true); }} className="p-2 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><UserX size={18} /></button><button onClick={() => handleEditClick(senior)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit size={18} /></button><button onClick={() => { if(window.confirm("Bura?")) authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${senior.id}/`, {method:'DELETE'}).then(()=>fetchSeniors()) }} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"><Trash2 size={18} /></button></td>
                  </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* --- PAGINATION (INTEGRATED DESIGN) --- */}
        {!isLoading && totalRecords > 50 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm font-medium text-slate-500">
              Pahina <span className="text-slate-900 font-bold">{currentPage}</span> mula sa <span className="text-slate-900 font-bold">{Math.ceil(totalRecords / 50)}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-slate-600 text-sm flex items-center shadow-sm"
              >
                <ChevronLeft size={16} className="mr-1" /> Prev
              </button>
              <button
                onClick={() => { setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalRecords / 50))); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === Math.ceil(totalRecords / 50)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-slate-600 text-sm flex items-center shadow-sm"
              >
                Next <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- FORM MODAL (WITH AGE RESTORED) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center px-10 py-8 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><FileText size={28} /></div>
                <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">{isEditMode ? 'Update Profile' : 'Application Form (Annex A)'}</h2><p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">National Commission of Senior Citizens</p></div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="px-10 py-8 overflow-y-auto flex-1 custom-scrollbar space-y-12">
              <form id="annex-a-form" onSubmit={handleFormSubmit} className="space-y-12">
                
                {/* SECTION A: PERSONAL & CONTACT */}
                <section>
                  <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">A</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Personal & Contact Information</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">OSCA ID Number <span className="text-rose-500">*</span></label><div className="flex items-center gap-2"><span className="px-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-slate-400 font-black text-sm">OSCA-</span><input required type="text" maxLength={4} value={formData.osca_id_year} onChange={(e) => setFormData({...formData, osca_id_year: handleNumberInput(e.target.value)})} className="w-24 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-center" placeholder="YYYY" /><span className="text-slate-300 font-bold">-</span><input required type="text" maxLength={8} value={formData.osca_id_serial} onChange={(e) => setFormData({...formData, osca_id_serial: handleNumberInput(e.target.value)})} className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="SERIAL NO." /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mobile / Landline</label><input type="text" value={formData.contact_number} onChange={(e) => setFormData({...formData, contact_number: handleNumberInput(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" /></div><div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium" /></div></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"><div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Last Name *</label><input required type="text" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: handleNameInput(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" /></div><div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Given Name *</label><input required type="text" value={formData.given_name} onChange={(e) => setFormData({...formData, given_name: handleNameInput(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" /></div><div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Middle Name</label><input type="text" value={formData.middle_name} onChange={(e) => setFormData({...formData, middle_name: handleNameInput(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" /></div></div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="col-span-2 space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Birthdate *</label>
                        <div className="relative group">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600" size={18} />
                            <input required type="date" value={formData.date_of_birth} onChange={(e) => handleDobChange(e.target.value)} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:bg-white transition-all outline-none" />
                        </div>
                    </div>
                    {/* AGE FIELD RESTORED (READONLY AUTO-CALCULATED) */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Age (Auto)</label>
                        <div className="relative">
                            <input readOnly type="text" value={formData.age} className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl font-black text-indigo-600 text-center" placeholder="--" />
                            {formData.age && parseInt(formData.age) >= 80 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
                        </div>
                    </div>
                    <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sex</label><select value={formData.sex} onChange={(e) => setFormData({...formData, sex: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold"><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                  </div>

                  <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Residential Address</h4><div className="grid grid-cols-2 md:grid-cols-6 gap-4"><input type="text" placeholder="House #" value={formData.res_house} onChange={(e) => setFormData({...formData, res_house: e.target.value})} className="col-span-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" /><input type="text" placeholder="Street" value={formData.res_street} onChange={(e) => setFormData({...formData, res_street: e.target.value})} className="col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" /><input type="text" placeholder="Barangay" value={formData.res_brgy} onChange={(e) => setFormData({...formData, res_brgy: e.target.value})} className="col-span-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" /><input type="text" placeholder="City" value={formData.res_city} onChange={(e) => setFormData({...formData, res_city: e.target.value})} className="col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" /><input type="text" placeholder="Province" value={formData.res_prov} onChange={(e) => setFormData({...formData, res_prov: e.target.value})} className="col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" /><input type="text" placeholder="Zip" value={formData.res_zip} onChange={(e) => setFormData({...formData, res_zip: handleNumberInput(e.target.value)})} className="col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" /></div></div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">B</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Family & Beneficiaries</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8"><div className="space-y-4"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Spouse Details</h4><input type="text" value={formData.spouse_name} onChange={(e) => setFormData({...formData, spouse_name: handleNameInput(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" placeholder="Spouse Full Name" /><input type="text" value={formData.spouse_citizenship} onChange={(e) => setFormData({...formData, spouse_citizenship: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" placeholder="Spouse Citizenship" /></div><div className="space-y-4"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Primary Beneficiary</h4><div className="flex gap-2"><input type="text" placeholder="Full Name" value={formData.primary_ben_name} onChange={(e) => setFormData({...formData, primary_ben_name: handleNameInput(e.target.value)})} className="w-2/3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase" /><input type="text" placeholder="Relation" value={formData.primary_ben_rel} onChange={(e) => setFormData({...formData, primary_ben_rel: handleNameInput(e.target.value)})} className="w-1/3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase" /></div></div></div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">C</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Benefit Utilization</h3></div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-8 bg-slate-50 rounded-[32px] border border-slate-100">{['FOOD', 'MEDICINE', 'HEALTH SERVICES', 'HOUSEHOLD NEEDS', 'OTHERS'].map((item) => (<label key={item} className="flex items-center gap-3 cursor-pointer group"><input type="checkbox" checked={formData.utilization.includes(item)} onChange={() => handleUtilizationChange(item)} className="w-6 h-6 rounded-lg text-indigo-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600 transition-colors">{item}</span></label>))}</div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">D</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Documentary Requirements</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-indigo-400 group relative transition-all border-spacing-2"><input type="file" onChange={(e) => handleFileChange(e, 'psa_cert_file')} className="absolute inset-0 opacity-0 cursor-pointer z-10" /><div className="flex flex-col items-center text-center gap-3"><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">{formData.psa_cert_file ? <FileCheck size={24} className="text-emerald-500" /> : <Upload size={24} />}</div><div><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">PSA Birth Cert</h4><p className="text-[9px] font-bold text-slate-400 mt-1">{formData.psa_cert_file ? formData.psa_cert_file.name : 'Upload PDF/JPG'}</p></div></div></div>
                        <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-indigo-400 group relative transition-all border-spacing-2"><input type="file" onChange={(e) => handleFileChange(e, 'primary_id_file')} className="absolute inset-0 opacity-0 cursor-pointer z-10" /><div className="flex flex-col items-center text-center gap-3"><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">{formData.primary_id_file ? <FileCheck size={24} className="text-emerald-500" /> : <Upload size={24} />}</div><div><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Valid Primary ID</h4><p className="text-[9px] font-bold text-slate-400 mt-1">{formData.primary_id_file ? formData.primary_id_file.name : 'Upload PDF/JPG'}</p></div></div></div>
                        <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-indigo-400 group relative transition-all border-spacing-2"><input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'picture_2x2_file')} className="absolute inset-0 opacity-0 cursor-pointer z-10" /><div className="flex flex-col items-center text-center gap-3"><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">{formData.picture_2x2_file ? <ImageIcon size={24} className="text-emerald-500" /> : <Upload size={24} />}</div><div><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">2x2 Photo</h4><p className="text-[9px] font-bold text-slate-400 mt-1">{formData.picture_2x2_file ? formData.picture_2x2_file.name : 'Upload Image'}</p></div></div></div>
                    </div>
                </section>

                <section className="bg-rose-50 border border-rose-100 p-10 rounded-[40px] space-y-8">
                    <div className="flex items-center gap-4 text-rose-600"><AlertCircle size={32} /><div><h3 className="text-lg font-black uppercase tracking-tighter">Legal Certification & Consent</h3><p className="text-xs font-bold text-rose-400 uppercase tracking-widest">Final Verification</p></div></div>
                    <div className="space-y-4">
                        <label className="flex items-start gap-5 cursor-pointer p-6 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-rose-100"><input type="checkbox" required checked={formData.consent_truth} onChange={(e) => setFormData({...formData, consent_truth: e.target.checked})} className="mt-1 w-7 h-7 rounded-xl text-rose-600 border-rose-200" /><span className="text-sm text-slate-700 font-bold leading-relaxed">I certify under oath that all information is true and correct.</span></label>
                        <label className="flex items-start gap-5 cursor-pointer p-6 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-rose-100"><input type="checkbox" required checked={formData.consent_privacy} onChange={(e) => setFormData({...formData, consent_privacy: e.target.checked})} className="mt-1 w-7 h-7 rounded-xl text-rose-600 border-rose-200" /><span className="text-sm text-slate-700 font-bold leading-relaxed">I authorize NCSC to process my data per R.A. No. 11982.</span></label>
                    </div>
                </section>
              </form>
            </div>
            
            <div className="flex justify-end gap-4 px-10 py-8 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px]">Close</button>
              <button type="submit" form="annex-a-form" disabled={isSubmitting} className="px-10 py-4 text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-200 transition-all flex items-center gap-3">
                {isSubmitting ? 'Uploading...' : (isEditMode ? 'Save Changes' : 'Complete Entry')}
                <CheckSquare size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- STATUS UPDATE MODAL (MISSING COMPONENT RESTORED) --- */}
      {isStatusModalOpen && selectedSeniorForStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in zoom-in duration-200">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="p-10 text-center space-y-6">
                    <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><UserX size={40} /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Update Record Status</h2>
                        <p className="text-sm font-bold text-slate-400 mt-2">Senior: <span className="text-slate-900">{selectedSeniorForStatus.last_name}, {selectedSeniorForStatus.first_name}</span></p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 pt-4">
                        <button onClick={() => handleStatusUpdate('ACTIVE')} className="flex items-center justify-between px-6 py-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl border border-emerald-100 transition-all group">
                            <span className="text-xs font-black uppercase tracking-widest">Active / Eligible</span>
                            <CheckSquare size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <button onClick={() => handleStatusUpdate('DECEASED')} className="flex items-center justify-between px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition-all group">
                            <span className="text-xs font-black uppercase tracking-widest">Deceased (Pumanaw)</span>
                            <X size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <button onClick={() => handleStatusUpdate('TRANSFERRED')} className="flex items-center justify-between px-6 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl border border-indigo-100 transition-all group">
                            <span className="text-xs font-black uppercase tracking-widest">Transferred LGU</span>
                            <RefreshCcw size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <button onClick={() => handleStatusUpdate('SUSPENDED')} className="flex items-center justify-between px-6 py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl border border-rose-100 transition-all group">
                            <span className="text-xs font-black uppercase tracking-widest">Suspended / Fraud</span>
                            <AlertCircle size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                    <button onClick={() => setIsStatusModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Abante / Cancel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
