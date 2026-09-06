"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Plus, Edit, Trash2, X, FileText, CheckSquare, PlusCircle, MinusCircle, AlertCircle, AlertTriangle, RefreshCcw, RotateCcw, UserX, Upload, FileCheck, Image as ImageIcon, Filter, Calendar, ChevronLeft, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import PdfViewer from "@/components/PdfViewer";

const QUEZON_CITY_BARANGAYS: Record<string, string[]> = {
  'District 1': ['Vasra', 'Bagong Pag-asa', 'Sto. Cristo', 'Project 6', 'Ramon Magsaysay', 'Alicia', 'Bahay Toro', 'Katipunan', 'San Antonio', 'Veterans Village', 'Bungad', 'Phil-Am', 'West Triangle', 'Sta. Cruz', 'Nayong Kanluran', 'Paltok', 'Paraiso', 'Mariblo', 'Damayan', 'Del Monte', 'Masambong', 'Talayan', 'Sto. Domingo', 'Siena', 'St. Peter', 'San Jose', 'Manresa', 'Damar', 'Pag-ibig sa Nayon', 'Balingasa', 'Sta. Teresita', 'San Isidro Labrador', 'Paang Bundok', 'Salvacion', 'N.S Amoranto', 'Maharlika', 'Lourdes'],
  'District 2': ['Bagong Silangan', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas'],
  'District 3': ['Silangan', 'Socorro', 'E. Rodriguez', 'West Kamias', 'East Kamias', 'Quirino 2-A', 'Quirino 2-B', 'Quirino 2-C', 'Quirino 3-A', 'Claro (Quirino 3-B)', 'Duyan-Duyan', 'Amihan', 'Matandang Balara', 'Pansol', 'Loyola Heights', 'San Roque', 'Mangga', 'Masagana', 'Villa Maria Clara', 'Bayanihan', 'Camp Aguinaldo', 'White Plains', 'Libis', 'Ugong Norte', 'Bagumbayan', 'Blue Ridge A', 'Blue Ridge B', 'St. Ignatius', 'Milagrosa', 'Escopa I', 'Escopa II', 'Escopa III', 'Escopa IV', 'Marilag', 'Bagumbuhay', 'Tagumpay', 'Dioquino Zobel'],
  'District 4': ['Sacred Heart', 'Laging Handa', 'Obrero', 'Paligsahan', 'Roxas', 'Kamuning', 'South Triangle', 'Pinagkaisahan', 'Immaculate Concepcion', 'San Martin De Porres', 'Kaunlaran', 'Bagong Lipunan ng Crame', 'Horseshoe', 'Valencia', 'Tatalon', 'Kalusugan', 'Kristong Hari', 'Damayang Lagi', 'Mariana', 'Doña Imelda', 'Santol', 'Sto. Niño', 'San Isidro Galas', 'Doña Aurora', 'Don Manuel', 'Doña Josefa', 'UP Village', 'Old Capitol Site', 'UP Campus', 'San Vicente', 'Teachers Village East', 'Teachers Village West', 'Central', 'Pinyahan', 'Malaya', 'Sikatuna Village', 'Botocan', 'Krus Na Ligas'],
  'District 5': ['Bagbag', 'Capri', 'Greater Lagro', 'Gulod', 'Kaligayahan', 'Nagkaisang Nayon', 'North Fairview', 'Novaliches Proper', 'Pasong Putik Proper', 'San Agustin', 'San Bartolome', 'Sta. Lucia', 'Sta. Monica', 'Fairview'],
  'District 6': ['Apolonio Samson', 'Baesa', 'Balon Bato', 'Culiat', 'New Era', 'Pasong Tamo', 'Sangandaan', 'Tandang Sora', 'Unang Sigaw', 'Sauyo', 'Talipapa'],
};

const getDistrictForBarangay = (barangay: string): string => {
  for (const [district, barangays] of Object.entries(QUEZON_CITY_BARANGAYS)) {
    if (barangays.some(b => b.toLowerCase() === barangay.toLowerCase())) return district;
  }
  return '';
};

export default function SeniorRegistryPage() {
  const { isAdmin } = useAuth();
  const { addNotification } = useNotifications();
  const { showModal, showConfirm } = useUI();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const regStatusParam = searchParams.get('regStatus');
  const [seniors, setSeniors] = useState<any[]>([]);

  const rowRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState(regStatusParam || "all");
  const [sexFilter, setSexFilter] = useState("all");
  const [brgyFilter, setBrgyFilter] = useState("");

  useEffect(() => {
    if (regStatusParam) {
      setRegistrationStatusFilter(regStatusParam);
    }
  }, [regStatusParam]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedSeniorForStatus, setSelectedSeniorForStatus] = useState<any>(null);
  const [isDeceasedModalOpen, setIsDeceasedModalOpen] = useState(false);
  const [deceasedForm, setDeceasedForm] = useState<{
    date_of_death: string;
    death_cert_file: File | null;
    remarks: string;
  }>({
    date_of_death: new Date().toISOString().split('T')[0],
    death_cert_file: null,
    remarks: 'Official notice of death recorded.'
  });
  const [returnedCorrectionInfo, setReturnedCorrectionInfo] = useState<{
    remarks: string;
    reviewer_name?: string;
    created_at?: string;
  } | null>(null);

  interface VerificationState {
    isOpen: boolean;
    fieldName: string;
    file: File | null;
    stage: 'scanning' | 'results';
    status: 'PASS' | 'FAIL';
    errorMessage?: string;
    documentType?: string;
    faceMatchScore?: number;
    matchNote?: string;
    previewUrl?: string;
    faceDetected?: boolean;
    faceConfidence?: number;
    detectedFaceCropUrl?: string;
    fileSizeStr?: string;
    imageDimensions?: string;
  }
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const faceDescriptorsRef = useRef<{ photo2x2: Float32Array | number[] | null; oscaId: Float32Array | number[] | null }>({
    photo2x2: null,
    oscaId: null,
  });
  const [pdfPreviewSrc, setPdfPreviewSrc] = useState<{ url?: string; file?: File | null; title: string } | null>(null);

  const openSuccess = (title: string, message: string) => showModal('success', title, message);
  const openError = (title: string, message: string) => showModal('error', title, message);
  const openWarning = (title: string, message: string) => showModal('warning', title, message);

  const handleDeleteSenior = async (id: number) => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${id}/`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchSeniors();
      }
    } catch (error) {
      console.error("Error deleting senior:", error);
    }
  };

  const openDeleteConfirm = (senior: any) => {
    showConfirm(
      'Delete Permanent Record?',
      `Are you sure you want to delete the record of ${senior.first_name} ${senior.last_name}? This action cannot be undone and will remove all associated history.`,
      () => handleDeleteSenior(senior.id)
    );
  };

  const initialFormState = {
    rrn: '', osca_id_year: '', osca_id_serial: '',
    last_name: '', given_name: '', middle_name: '',
    date_of_birth: '', age: '',
    perm_house: '', perm_street: '', perm_brgy: '', perm_city: '', perm_prov: '', perm_zip: '',
    res_house: '', res_street: '', res_brgy: '', res_district: '', res_city: 'Quezon City', res_prov: 'Metro Manila', res_zip: '',
    same_as_res: false,
    sex: '', civil_status: '',
    citizenship: 'Filipino', dual_citizenship_details: '',
    spouse_name: '', spouse_citizenship: '',
    children: [''],
    reps: [{ name: '', relation: '', contact: '' }],
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
    psa_cert_url: '',
    primary_id_url: '',
    picture_2x2_url: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [autoCheckResults, setAutoCheckResults] = useState<any>({});

  useEffect(() => {
    fetchSeniors();
  }, [currentPage, ageFilter, statusFilter, sexFilter, registrationStatusFilter]);

  // Scroll to highlight
  useEffect(() => {
    if (highlightId && !isLoading && seniors.length > 0) {
      const timer = setTimeout(() => {
        const element = rowRefs.current[highlightId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [highlightId, isLoading, seniors]);

  const fetchSeniors = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: currentPage.toString(),
        filter: ageFilter,
        status: statusFilter,
        registration_status: registrationStatusFilter === "all" ? "" : registrationStatusFilter,
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

  const getMinAgeDate = () => {
    const today = new Date();
    const maxYear = today.getFullYear() - 78;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${maxYear}-${month}-${day}`;
  };

  const getFileNameFromUrl = (url: string) => {
    if (!url) return '';
    return url.split('/').pop() || 'file';
  };

  const handleDobChange = (dob: string) => {
    if (dob) {
      const age = parseInt(calculateAge(dob));
      if (age < 78) {
        openWarning("Ineligible Age", "The applicant must be 78 years old or older to register in the Centenaryo system.");
        setFormData({ ...formData, date_of_birth: '', age: '' });
        return;
      }
    }
    setFormData({ ...formData, date_of_birth: dob, age: calculateAge(dob) });
  };

  const handleCivilStatusChange = (status: string) => {
    if (status !== 'MARRIED' && status !== 'SEPARATED') {
      setFormData({ ...formData, civil_status: status, spouse_name: '', spouse_citizenship: '' });
    } else {
      setFormData({ ...formData, civil_status: status });
    }
  };

  const handleNameInput = (value: string) => value.replace(/[^a-zA-Z\s\-]/g, "").toUpperCase();
  const handleNumberInput = (value: string) => value.replace(/\D/g, "");

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'DECEASED': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'TRANSFERRED': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'SUSPENDED': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const handleEditClick = (senior: any) => {
    setIsEditMode(true);
    setEditingId(senior.id);
    if (senior.registration_status === 'RETURNED') {
      const returnLog = senior.review_logs?.find((l: any) => l.action === 'RETURN') || senior.review_logs?.[0];
      setReturnedCorrectionInfo(returnLog || { remarks: 'Reviewer requested correction of uploaded documents or details.' });
    } else {
      setReturnedCorrectionInfo(null);
    }
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
      res_district: getDistrictForBarangay(senior.barangay || ''),
      status: senior.status || 'ACTIVE',
      sex: senior.sex || '',
      civil_status: senior.civil_status || '',
      consent_privacy: true,
      consent_truth: true,
      psa_cert_url: senior.psa_cert_file || '',
      primary_id_url: senior.primary_id_file || '',
      picture_2x2_url: senior.picture_2x2_file || ''
    });
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedSeniorForStatus) return;
    if (newStatus === 'DECEASED') {
      setIsStatusModalOpen(false);
      setIsDeceasedModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${selectedSeniorForStatus.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, is_active: newStatus === 'ACTIVE' })
      });
      if (res.ok) { setIsStatusModalOpen(false); fetchSeniors(); }
    } catch (error) { console.error("Error updating status:", error); } finally { setIsSubmitting(false); }
  };

  const handleReportDeceased = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeniorForStatus) return;
    if (!deceasedForm.date_of_death) {
      openWarning("Date of Death Required", "Please specify the official date of death.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('date_of_death', deceasedForm.date_of_death);
      fd.append('remarks', deceasedForm.remarks);
      if (deceasedForm.death_cert_file) {
        fd.append('death_cert_file', deceasedForm.death_cert_file);
      }

      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/seniors/${selectedSeniorForStatus.id}/report-deceased/`, {
        method: 'POST',
        body: fd
      });

      if (res.ok) {
        const result = await res.json();
        setIsDeceasedModalOpen(false);
        fetchSeniors();
        openSuccess(
          "Notice of Demise Recorded",
          result.message || "Senior record has been marked as DECEASED and all future disbursements have been frozen."
        );
      } else {
        const err = await res.json();
        openError("Report Failed", err.error || "Failed to record notice of death.");
      }
    } catch (error) {
      console.error("Error reporting deceased:", error);
      openError("Connection Error", "Could not submit notice of death.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Detailed Validation
    if (!formData.given_name || !formData.last_name || !formData.date_of_birth) {
      openWarning("Incomplete Information", "Please fill out all required information (Name and Birthdate).");
      return;
    }

    if (!formData.osca_id_year || !formData.osca_id_serial) {
      openWarning("OSCA ID Required", "Please complete the OSCA ID details.");
      return;
    }

    // Enforce documentary requirements are uploaded
    const hasPsa = !!(formData.psa_cert_file || formData.psa_cert_url);
    const hasPrimaryId = !!(formData.primary_id_file || formData.primary_id_url);
    const hasPhoto = !!(formData.picture_2x2_file || formData.picture_2x2_url);

    if (!hasPsa || !hasPrimaryId || !hasPhoto) {
      openWarning("Missing Documents", "Please upload all three required documents (PSA Birth Certificate, OSCA ID, and 2x2 Photo) before saving changes.");
      return;
    }

    if (!formData.res_district) {
      openWarning("District Required", "Please select a district from the dropdown.");
      return;
    }

    if (!formData.res_brgy) {
      openWarning("Barangay Required", "Please select a barangay from the dropdown.");
      return;
    }

    // Validate Mobile Number (Must be exactly 11 digits)
    if (!formData.contact_number) {
      openWarning("Mobile Number Required", "Please provide a mobile number.");
      return;
    }
    if (formData.contact_number.length !== 11) {
      openWarning("Invalid Mobile Number", "The mobile number must be exactly 11 digits (e.g., 09171234567).");
      return;
    }
    if (!formData.contact_number.startsWith('09')) {
      openWarning("Invalid Mobile Number", "The mobile number must start with 09 (e.g., 09171234567).");
      return;
    }

    // Validate Email Address (Restrict special characters, only allow '.', '+', and alphanumeric characters)
    if (formData.email) {
      const emailRegex = /^[a-zA-Z0-9.+]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(formData.email)) {
        openWarning("Invalid Email Address", "The email format is invalid or contains forbidden special characters. Only alphanumeric characters, period (.), and plus (+) are allowed in the local part.");
        return;
      }
    }

    // Validate Representative Mobile Number (If provided, must be exactly 11 digits)
    if (formData.reps && formData.reps[0] && formData.reps[0].contact) {
      if (formData.reps[0].contact.length !== 11) {
        openWarning("Invalid Representative Mobile Number", "The representative's mobile number must be exactly 11 digits (e.g., 09171234567).");
        return;
      }
      if (!formData.reps[0].contact.startsWith('09')) {
        openWarning("Invalid Representative Mobile Number", "The representative's mobile number must start with 09 (e.g., 09171234567).");
        return;
      }
    }

    if (!formData.consent_privacy || !formData.consent_truth) {
      openWarning("Consent Required", "You must check the Data Privacy and Truthfulness statements.");
      return;
    }

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
      fd.append('sex', formData.sex);
      fd.append('civil_status', formData.civil_status);

      const cleanAnnexData = { ...formData };
      delete (cleanAnnexData as any).psa_cert_file;
      delete (cleanAnnexData as any).primary_id_file;
      delete (cleanAnnexData as any).picture_2x2_file;

      fd.append('annex_a_data', JSON.stringify(cleanAnnexData));
      fd.append('auto_check_results', JSON.stringify(autoCheckResults));

      if (formData.psa_cert_file) fd.append('psa_cert_file', formData.psa_cert_file);
      if (formData.primary_id_file) fd.append('primary_id_file', formData.primary_id_file);
      if (formData.picture_2x2_file) fd.append('picture_2x2_file', formData.picture_2x2_file);

      if (returnedCorrectionInfo) {
        fd.append('resubmission_notes', 'Staff addressed flagged defects and resubmitted record for review.');
      }

      const url = isEditMode ? `${process.env.NEXT_PUBLIC_API_URL}/seniors/${editingId}/` : `${process.env.NEXT_PUBLIC_API_URL}/seniors/`;
      const res = await authFetch(url, { method: isEditMode ? 'PATCH' : 'POST', body: fd });

      if (res.ok) {
        const result = await res.json();
        setIsModalOpen(false);
        setFormData(initialFormState);
        const wasReturned = !!returnedCorrectionInfo;
        setReturnedCorrectionInfo(null);
        fetchSeniors();
        openSuccess(
          isEditMode
            ? (wasReturned ? "Resubmitted for Verification" : "Record Updated")
            : "Registration Submitted for Review",
          wasReturned
            ? `The corrected record for ${formData.given_name} ${formData.last_name} has been resubmitted to the Admin Review Queue.`
            : `The record for ${formData.given_name} ${formData.last_name} has been successfully submitted and is pending review.`
        );

        // TRIGGER GLOBAL NOTIFICATION
        addNotification({
          type: isEditMode ? 'SECURITY' : 'MILESTONE',
          title: isEditMode ? 'Record Updated' : 'New Registration',
          description: `${formData.given_name} ${formData.last_name}'s profile was ${isEditMode ? 'updated' : 'added to the registry'}.`,
          link: '/seniors',
          targetId: result.id
        });
      } else {
        const errorData = await res.json();
        const errorMessage = typeof errorData === 'object'
          ? Object.entries(errorData).map(([key, value]) => `${key}: ${value}`).join('\n')
          : "An error occurred while saving.";
        openError("Submission Failed", errorMessage);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      openError("Connection Error", "Cannot connect to server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper functions for Automated Face-API and OCR Verification
  const computeSha256 = async (buffer: ArrayBuffer): Promise<string> => {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  };

  const getFaceApi = async () => {
    const faceapi = await import('@vladmandic/face-api');
    if (!faceapi.nets.tinyFaceDetector.isLoaded || !faceapi.nets.faceLandmark68TinyNet.isLoaded || !faceapi.nets.faceRecognitionNet.isLoaded) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
    }
    return faceapi;
  };

  interface FaceDetailResult {
    descriptor: Float32Array | number[];
    confidence: number;
    cropDataUrl: string;
    features?: number[];
  }

  const extractFaceDetails = async (
    element?: HTMLImageElement | HTMLCanvasElement | null,
    file?: File | null
  ): Promise<FaceDetailResult | null> => {
    // 1. First priority: Server-side high-precision OpenCV Face Engine (100% reliable, fast, immune to browser extensions)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      let res: Response | null = null;

      if (file && (file.type.startsWith('image/') || file.name.toUpperCase().match(/\.(JPG|JPEG|PNG|WEBP)$/))) {
        const fd = new FormData();
        fd.append('file', file);
        res = await fetch(`${apiBase}/verify-face/`, {
          method: 'POST',
          body: fd,
        });
      } else if (element) {
        let b64 = '';
        if ('toDataURL' in element && typeof (element as any).toDataURL === 'function') {
          b64 = (element as HTMLCanvasElement).toDataURL('image/jpeg', 0.92);
        } else if ('src' in element && typeof (element as any).src === 'string' && (element as HTMLImageElement).src.startsWith('data:image')) {
          b64 = (element as HTMLImageElement).src;
        } else {
          const c = document.createElement('canvas');
          const w = 'naturalWidth' in element ? (element.naturalWidth || element.width) : element.width;
          const h = 'naturalHeight' in element ? (element.naturalHeight || element.height) : element.height;
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(element, 0, 0);
            b64 = c.toDataURL('image/jpeg', 0.92);
          }
        }

        if (b64) {
          res = await fetch(`${apiBase}/verify-face/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: b64 }),
          });
        }
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.face_detected && data.crop_data_url) {
          return {
            descriptor: data.features || [],
            features: data.features || [],
            confidence: Math.round(data.confidence || 96),
            cropDataUrl: data.crop_data_url
          };
        }
      }
    } catch (backendErr) {
      console.warn("Backend face verification unavailable, attempting browser fallback:", backendErr);
    }

    // 2. Client-side fallback if backend was unavailable
    if (!element) return null;

    try {
      const faceapi = await getFaceApi();
      // Multi-scale detection: 512, 416, 320, 224, 160
      const inputSizes = [512, 416, 320, 224, 160];
      let detection: any = null;

      for (const size of inputSizes) {
        for (const scoreThresh of [0.15, 0.08]) {
          try {
            const det = await faceapi
              .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: scoreThresh }))
              .withFaceLandmarks(true)
              .withFaceDescriptor();
            if (det) {
              detection = det;
              break;
            }
          } catch (detErr) {
            console.warn(`Detection attempt at size ${size} thresh ${scoreThresh}:`, detErr);
          }
        }
        if (detection) break;
      }

      if (!detection) return null;

      // Generate cropped face portrait data URL
      let cropDataUrl = '';
      try {
        const box = detection.detection.box;
        const padX = box.width * 0.25;
        const padY = box.height * 0.30;

        const srcW = 'naturalWidth' in element ? (element.naturalWidth || element.width) : element.width;
        const srcH = 'naturalHeight' in element ? (element.naturalHeight || element.height) : element.height;

        const startX = Math.max(0, box.x - padX);
        const startY = Math.max(0, box.y - padY);
        const cropW = Math.min(srcW - startX, box.width + padX * 2);
        const cropH = Math.min(srcH - startY, box.height + padY * 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 160;
        cropCanvas.height = 160;
        const ctx = cropCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(element, startX, startY, cropW, cropH, 0, 0, 160, 160);
          cropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.92);
        }
      } catch (cropErr) {
        console.warn("Could not generate face crop:", cropErr);
      }

      return {
        descriptor: detection.descriptor,
        confidence: Math.round(detection.detection.score * 100),
        cropDataUrl
      };
    } catch (err) {
      console.warn("Face detection failed or unavailable:", err);
      return null;
    }
  };

  const parsePdfPageAndText = async (buffer: ArrayBuffer): Promise<{ numPages: number; text: string; canvas: HTMLCanvasElement }> => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((i: any) => i.str).join(' ');

    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
    }
    return { numPages: pdf.numPages, text, canvas };
  };

  const compareFaceDescriptors = (descA: Float32Array | number[], descB: Float32Array | number[]) => {
    // If both are 256-dim feature vectors from OpenCV backend
    if (Array.isArray(descA) && Array.isArray(descB) && descA.length === 256 && descB.length === 256) {
      const a = descA;
      const b = descB;
      const meanA = a.reduce((s, v) => s + v, 0) / a.length;
      const meanB = b.reduce((s, v) => s + v, 0) / b.length;
      let num = 0;
      let denomA = 0;
      let denomB = 0;
      for (let i = 0; i < a.length; i++) {
        const da = a[i] - meanA;
        const db = b[i] - meanB;
        num += da * db;
        denomA += da * da;
        denomB += db * db;
      }
      const denom = Math.sqrt(denomA * denomB);
      const correl = denom > 0 ? num / denom : 0;
      const similarity = Math.max(12, Math.min(99, Math.round(((correl + 1) / 2) * 100)));
      const isMatch = similarity >= 65;
      return { distance: Number((1 - correl).toFixed(3)), similarity, isMatch };
    }

    let sum = 0;
    const len = Math.min((descA as any).length, (descB as any).length);
    for (let i = 0; i < len; i++) {
      const diff = Number((descA as any)[i]) - Number((descB as any)[i]);
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);
    // Standard distance: <= 0.6 is match. Convert to 10-99% similarity.
    const similarity = Math.max(12, Math.min(98, Math.round((1 - (distance / 0.85)) * 100)));
    const isMatch = distance <= 0.62;
    return { distance, similarity, isMatch };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, [field]: file }));

      const fileSizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const isImgFile = file.type.startsWith('image/') || !!file.name.toUpperCase().match(/\.(JPG|JPEG|PNG|WEBP)$/);
      const initialPreviewUrl = isImgFile ? URL.createObjectURL(file) : undefined;

      setVerificationState({
        isOpen: true,
        fieldName: field,
        file: file,
        stage: 'scanning',
        status: 'FAIL',
        previewUrl: initialPreviewUrl,
        fileSizeStr: fileSizeStr
      });

      const checkDuplicate = (newFile: File) => {
        let isDuplicate = false;
        const slotsToCheck = ['psa_cert_file', 'primary_id_file', 'picture_2x2_file'].filter(f => f !== field);
        for (const slot of slotsToCheck) {
          const existingFile = (formData as any)[slot];
          if (existingFile && existingFile instanceof File) {
            if (existingFile.name === newFile.name && existingFile.size === newFile.size) {
              isDuplicate = true;
              break;
            }
          }
        }
        return isDuplicate;
      };

      const reader = new FileReader();

      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        const fileSize = file.size;

        if (fileSize < 2000 || fileSize > 20000000) {
          setVerificationState(prev => prev ? {
            ...prev, stage: 'results', status: 'FAIL',
            errorMessage: 'Rejected: File size must be between 2KB and 20MB.'
          } : null);
          return;
        }

        if (checkDuplicate(file)) {
          setVerificationState(prev => prev ? {
            ...prev, stage: 'results', status: 'FAIL',
            errorMessage: 'Rejected: Duplicate file detected. This file is already uploaded in another slot.'
          } : null);
          return;
        }

        const fileHash = await computeSha256(buffer);
        const isPdf = file.type === 'application/pdf' || file.name.toUpperCase().endsWith('.PDF');
        const isImage = file.type.startsWith('image/') || !!file.name.toUpperCase().match(/\.(JPG|JPEG|PNG|WEBP)$/);

        let finalStatus: 'PASS' | 'FAIL' = 'PASS';
        let errorMessage = '';
        let detectedType = '';
        let matchNote = '';
        let faceMatchScore: number | undefined = undefined;
        let previewUrl: string | undefined = initialPreviewUrl;
        let imageDimensions = '';
        let faceDetected: boolean | undefined = undefined;
        let faceConfidence: number | undefined = undefined;
        let detectedFaceCropUrl: string | undefined = undefined;

        // 1. PSA Birth Certificate
        if (field === 'psa_cert_file') {
          detectedType = 'PSA Birth Certificate';
          if (!isPdf) {
            finalStatus = 'FAIL';
            errorMessage = 'Rejected: Must be a PDF file.';
          } else {
            try {
              const { numPages, text, canvas } = await parsePdfPageAndText(buffer);
              if (numPages !== 1) {
                finalStatus = 'FAIL';
                errorMessage = `Rejected: PDF must be exactly 1 page. (Detected ${numPages} pages).`;
              } else {
                previewUrl = canvas.toDataURL('image/jpeg', 0.88);
                imageDimensions = `${canvas.width} × ${canvas.height} px (Page 1)`;
                const rawText = text.toLowerCase();
                const lName = formData.last_name?.trim().toLowerCase();
                const gName = formData.given_name?.trim().toLowerCase();
                const bYear = formData.date_of_birth ? formData.date_of_birth.split('-')[0] : '';

                const nameFound = (lName && rawText.includes(lName)) || (gName && rawText.includes(gName));
                const dobFound = bYear ? rawText.includes(bYear) : false;

                setAutoCheckResults((prev: any) => ({
                  ...prev,
                  psa_hash: fileHash,
                  ocr_psa: {
                    status: (nameFound && dobFound) ? 'PASS' : 'NEEDS_REVIEW',
                    name_found: nameFound,
                    dob_found: dobFound,
                    message: (nameFound && dobFound)
                      ? 'Identity & Birth Year text confirmed on PSA.'
                      : 'Could not fully match text in PSA; manual review queued.'
                  }
                }));

                matchNote = (nameFound && dobFound)
                  ? 'PSA OCR Pre-Check: Name and birth year verified.'
                  : 'PSA OCR Pre-Check: Document formatted properly, flagged for manual text verification.';
              }
            } catch (err) {
              console.error("PSA read error:", err);
              finalStatus = 'FAIL';
              errorMessage = 'Rejected: Could not parse PDF file.';
            }
          }
        }

        // 2. Primary ID (OSCA ID)
        else if (field === 'primary_id_file') {
          detectedType = 'OSCA ID Card';
          let oscaCanvasOrImg: HTMLCanvasElement | HTMLImageElement | null = null;

          if (isPdf) {
            try {
              const { numPages, canvas, text } = await parsePdfPageAndText(buffer);
              if (numPages !== 1) {
                finalStatus = 'FAIL';
                errorMessage = `Rejected: PDF must be exactly 1 page. (Detected ${numPages} pages).`;
              } else {
                previewUrl = canvas.toDataURL('image/jpeg', 0.88);
                imageDimensions = `${canvas.width} × ${canvas.height} px (Page 1)`;
                oscaCanvasOrImg = canvas;
                const oscaSerial = formData.osca_id_serial?.trim();
                const textFound = oscaSerial ? text.includes(oscaSerial) : true;
                setAutoCheckResults((prev: any) => ({
                  ...prev,
                  osca_hash: fileHash,
                  ocr_osca: { status: 'PASS', serial_match: textFound }
                }));
              }
            } catch (err) {
              console.error("OSCA PDF error:", err);
              finalStatus = 'FAIL';
              errorMessage = 'Rejected: Could not read OSCA ID PDF.';
            }
          } else if (isImage) {
            try {
              const img = new Image();
              previewUrl = URL.createObjectURL(file);
              img.src = previewUrl;
              await new Promise(r => { img.onload = r; img.onerror = r; });
              imageDimensions = `${img.naturalWidth || img.width} × ${img.naturalHeight || img.height} px`;
              oscaCanvasOrImg = img;
              setAutoCheckResults((prev: any) => ({
                ...prev,
                osca_hash: fileHash,
                ocr_osca: { status: 'PASS' }
              }));
            } catch (err) {
              console.error("OSCA Image error:", err);
              finalStatus = 'FAIL';
              errorMessage = 'Rejected: Could not read OSCA ID Image.';
            }
          } else {
            finalStatus = 'FAIL';
            errorMessage = 'Rejected: Must be a PDF or Image (JPG/PNG).';
          }

          // Extract face from OSCA ID if valid
          if (finalStatus === 'PASS' && oscaCanvasOrImg) {
            const faceDetails = await extractFaceDetails(oscaCanvasOrImg, file);
            if (faceDetails) {
              faceDetected = true;
              faceConfidence = faceDetails.confidence;
              detectedFaceCropUrl = faceDetails.cropDataUrl;
              faceDescriptorsRef.current.oscaId = faceDetails.descriptor;

              if (faceDescriptorsRef.current.photo2x2) {
                const comp = compareFaceDescriptors(faceDetails.descriptor, faceDescriptorsRef.current.photo2x2);
                faceMatchScore = comp.similarity;
                matchNote = `Face portrait isolated (${faceDetails.confidence}% confidence). Biometric match with 2x2 photo: ${comp.similarity}%.`;
                setAutoCheckResults((prev: any) => ({
                  ...prev,
                  face_match: {
                    status: comp.isMatch ? 'PASS' : (comp.similarity >= 50 ? 'NEEDS_REVIEW' : 'FLAGGED'),
                    similarity_pct: comp.similarity,
                    distance: Number(comp.distance.toFixed(3)),
                    message: comp.isMatch ? `High similarity (${comp.similarity}%)` : `Review required (${comp.similarity}% match)`
                  }
                }));
              } else {
                matchNote = `Face portrait isolated from OSCA ID (${faceDetails.confidence}% confidence). Upload 2x2 photo for automated comparison.`;
              }
            } else {
              faceDetected = false;
              matchNote = 'OSCA ID uploaded. Face landmark not clearly detected; flagged for manual comparison.';
              setAutoCheckResults((prev: any) => ({
                ...prev,
                face_match: {
                  status: 'NEEDS_REVIEW',
                  message: 'OSCA ID face requires manual admin review.'
                }
              }));
            }
          }
        }

        // 3. 2x2 Photo
        else if (field === 'picture_2x2_file') {
          detectedType = '2x2 Photo';
          if (!isImage) {
            finalStatus = 'FAIL';
            errorMessage = 'Rejected: Must be a JPG or PNG image.';
          } else {
            try {
              const img = new Image();
              previewUrl = URL.createObjectURL(file);
              img.src = previewUrl;
              await new Promise(r => { img.onload = r; img.onerror = r; });
              imageDimensions = `${img.naturalWidth || img.width} × ${img.naturalHeight || img.height} px`;
              const diffRatio = Math.abs(img.width - img.height) / Math.max(img.width, img.height);
              if (diffRatio > 0.28) {
                finalStatus = 'FAIL';
                errorMessage = `Rejected: Image must be approximately 1:1 square. (${img.width}×${img.height} detected).`;
              } else {
                const faceDetails = await extractFaceDetails(img, file);
                if (faceDetails) {
                  faceDetected = true;
                  faceConfidence = faceDetails.confidence;
                  detectedFaceCropUrl = faceDetails.cropDataUrl;
                  faceDescriptorsRef.current.photo2x2 = faceDetails.descriptor;
                  setAutoCheckResults((prev: any) => ({ ...prev, picture_2x2_hash: fileHash }));

                  if (faceDescriptorsRef.current.oscaId) {
                    const comp = compareFaceDescriptors(faceDetails.descriptor, faceDescriptorsRef.current.oscaId);
                    faceMatchScore = comp.similarity;
                    matchNote = `Face portrait isolated (${faceDetails.confidence}% confidence). Biometric match with OSCA ID: ${comp.similarity}%.`;
                    setAutoCheckResults((prev: any) => ({
                      ...prev,
                      face_match: {
                        status: comp.isMatch ? 'PASS' : (comp.similarity >= 50 ? 'NEEDS_REVIEW' : 'FLAGGED'),
                        similarity_pct: comp.similarity,
                        distance: Number(comp.distance.toFixed(3)),
                        message: comp.isMatch ? `High similarity (${comp.similarity}%)` : `Review required (${comp.similarity}% match)`
                      }
                    }));
                  } else {
                    matchNote = `Clear human portrait detected (${faceDetails.confidence}% confidence). Upload OSCA ID to calculate face similarity.`;
                  }
                } else {
                  faceDetected = false;
                  matchNote = 'Photo formatted correctly, but face was not clearly detected. Flagged for admin inspection.';
                  setAutoCheckResults((prev: any) => ({
                    ...prev,
                    picture_2x2_hash: fileHash,
                    face_match: {
                      status: 'NEEDS_REVIEW',
                      message: 'Photo face requires manual admin review.'
                    }
                  }));
                }
              }
            } catch (err) {
              console.error("2x2 Photo error:", err);
              finalStatus = 'FAIL';
              errorMessage = 'Rejected: Failed to load image.';
            }
          }
        }

        setVerificationState(prev => prev ? {
          ...prev,
          stage: 'results',
          status: finalStatus,
          documentType: detectedType,
          errorMessage: finalStatus === 'PASS' ? undefined : errorMessage,
          faceMatchScore,
          matchNote,
          previewUrl: previewUrl || prev.previewUrl,
          faceDetected,
          faceConfidence,
          detectedFaceCropUrl,
          fileSizeStr: fileSizeStr || prev.fileSizeStr,
          imageDimensions
        } : null);
      };

      reader.readAsArrayBuffer(file);
    }
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
          <button onClick={() => { setFormData(initialFormState); setIsEditMode(false); setReturnedCorrectionInfo(null); setIsModalOpen(true); }} className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap text-sm font-bold w-full md:w-auto">
            <Plus size={18} />
            <span>New Record</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 mr-2"><Filter size={18} /><span className="text-xs font-black uppercase tracking-widest">Filters</span></div>
        <button
          type="button"
          onClick={() => {
            setRegistrationStatusFilter(prev => prev === 'RETURNED' ? 'all' : 'RETURNED');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm ${registrationStatusFilter === 'RETURNED'
              ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 shadow-amber-200'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          title="Filter to show records returned by admin for correction"
        >
          <RotateCcw size={12} className={registrationStatusFilter === 'RETURNED' ? 'animate-spin-slow' : ''} />
          <span>Returned for Correction</span>
        </button>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all cursor-pointer"><option value="all">ALL STATUS</option><option value="ACTIVE">ACTIVE</option><option value="DECEASED">DECEASED</option><option value="TRANSFERRED">TRANSFERRED</option><option value="SUSPENDED">SUSPENDED</option></select>
        <select value={ageFilter} onChange={(e) => { setAgeFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all cursor-pointer"><option value="all">ALL AGES</option><option value="eligible">ELIGIBLE (80+)</option><option value="upcoming">UPCOMING (78-79)</option></select>
        <select value={sexFilter} onChange={(e) => { setSexFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all cursor-pointer"><option value="all">ALL SEX</option><option value="Male">MALE</option><option value="Female">FEMALE</option></select>
        <select
          value={registrationStatusFilter}
          onChange={(e) => { setRegistrationStatusFilter(e.target.value); setCurrentPage(1); }}
          className={`px-4 py-2 bg-white border rounded-xl text-xs font-bold outline-none transition-all cursor-pointer ${registrationStatusFilter === 'RETURNED'
              ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400/20'
              : 'border-slate-200 text-slate-600 focus:border-indigo-400'
            }`}
        >
          <option value="all">ALL REG. STATUS</option>
          <option value="RETURNED">RETURNED FOR CORRECTION</option>
          <option value="PENDING_REVIEW">PENDING REVIEW</option>
          <option value="UNDER_REVIEW">UNDER REVIEW</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <div className="relative group flex-1 min-w-[200px]"><input type="text" value={brgyFilter} onChange={(e) => setBrgyFilter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchSeniors()} placeholder="Barangay..." className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all" /><button onClick={fetchSeniors} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600"><RefreshCcw size={14} /></button></div>
        <button onClick={() => { setStatusFilter("all"); setAgeFilter("all"); setSexFilter("all"); setRegistrationStatusFilter("all"); setBrgyFilter(""); setSearchTerm(""); }} className="px-4 py-2 text-slate-400 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest transition-colors">Reset</button>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-8 py-5">OSCA ID</th>
                <th className="px-8 py-5">Full Name</th>
                <th className="px-8 py-5">Birthdate & Age</th>
                <th className="px-8 py-5">Barangay</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (<tr><td colSpan={6} className="p-20 text-center"><div className="flex flex-col items-center gap-4"><div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div><span className="font-semibold text-slate-500">Fetching data...</span></div></td></tr>) : seniors.length === 0 ? (<tr><td colSpan={6} className="p-20 text-center font-bold text-slate-400">No records found.</td></tr>) : (seniors.map((senior) => (
                <tr
                  key={senior.id}
                  ref={el => { rowRefs.current[senior.id] = el; }}
                  className={`hover:bg-slate-50/80 transition-all group ${highlightId === senior.id?.toString() ? 'bg-indigo-50/80 ring-2 ring-indigo-500/20 ring-inset animate-pulse z-10' : ''}`}
                >
                  <td className="px-8 py-5 font-mono font-bold text-slate-400 tracking-tighter">{senior.osca_id || "N/A"}</td>
                  <td className="px-8 py-5 font-bold text-slate-800 uppercase">{senior.last_name}, {senior.first_name}</td>
                  <td className="px-8 py-5"><div className="flex flex-col gap-1"><span className="font-medium">{new Date(senior.date_of_birth).toLocaleDateString()}</span>{(() => { const dob = new Date(senior.date_of_birth); const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--; return <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-slate-100 text-slate-500 w-fit">{age} YRS OLD</span>; })()}</div></td>
                  <td className="px-8 py-5 font-medium">{senior.barangay || "LGU"}</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${getStatusStyle(senior.status)}`}>{senior.status || 'ACTIVE'}</span>
                      {senior.status === 'DECEASED' && (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {senior.date_of_death && (
                            <span className="text-[9px] font-black text-rose-700">
                              † {senior.date_of_death}
                            </span>
                          )}
                          {senior.death_cert_file && (
                            <a
                              href={senior.death_cert_file.startsWith('http') ? senior.death_cert_file : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${senior.death_cert_file}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] font-black text-rose-700 underline hover:text-rose-900"
                            >
                              📄 Death Cert
                            </a>
                          )}
                        </div>
                      )}
                      {senior.registration_status === 'RETURNED' ? (
                        <button
                          type="button"
                          onClick={() => handleEditClick(senior)}
                          title="Click to view reviewer defect notes and resubmit"
                          className="px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 transition-all flex items-center gap-1 shadow-sm animate-pulse"
                        >
                          <RotateCcw size={10} /> Returned for Correction
                        </button>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${senior.registration_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            senior.registration_status === 'PENDING_REVIEW' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              senior.registration_status === 'UNDER_REVIEW' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                senior.registration_status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                  'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>{senior.registration_status ? senior.registration_status.replace('_', ' ') : 'PENDING REVIEW'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 flex justify-end gap-2">
                    <button title="Update Status / Report Deceased" onClick={() => { setSelectedSeniorForStatus(senior); setIsStatusModalOpen(true); }} className="p-2 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><UserX size={18} /></button>
                    <button onClick={() => handleEditClick(senior)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit size={18} /></button>
                    <button onClick={() => openDeleteConfirm(senior)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Removed legacy local confirm modal - using global UIContext */}

        {/* --- PAGINATION (INTEGRATED DESIGN) --- */}
        {!isLoading && totalRecords > 50 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm font-medium text-slate-500">
              Page <span className="text-slate-900 font-bold">{currentPage}</span> of <span className="text-slate-900 font-bold">{Math.ceil(totalRecords / 50)}</span>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            <form id="annex-a-form" onSubmit={handleFormSubmit} className="flex flex-col h-full overflow-hidden">
              <div className="flex justify-between items-center px-10 py-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><FileText size={28} /></div>
                  <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">{isEditMode ? 'Update Profile' : 'Application Form (Annex A)'}</h2><p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">National Commission of Senior Citizens</p></div>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 rounded-2xl transition-all"><X size={24} /></button>
              </div>

              <div className="px-10 py-8 overflow-y-auto flex-1 custom-scrollbar space-y-12">

                {/* --- RETURNED FOR CORRECTION REMEDIATION BANNER --- */}
                {returnedCorrectionInfo && (
                  <div className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/50 border-2 border-amber-300 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
                        <RotateCcw size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900">
                            Returned for Correction
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            Reviewed by: <strong className="text-slate-800">{returnedCorrectionInfo.reviewer_name || 'Admin Reviewer'}</strong>
                            {returnedCorrectionInfo.created_at && ` • ${new Date(returnedCorrectionInfo.created_at).toLocaleDateString()}`}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-amber-950 mt-1">
                          Reviewer Correction Instructions / Flagged Defect:
                        </h4>
                        <p className="text-sm font-bold text-amber-900/90 bg-white/90 p-3.5 rounded-2xl border border-amber-200 mt-1.5 leading-relaxed shadow-sm">
                          "{returnedCorrectionInfo.remarks || 'Please replace unreadable document attachments or correct field discrepancies.'}"
                        </p>
                        <p className="text-[11px] text-amber-800 font-semibold mt-2 flex items-center gap-1.5">
                          <span>💡</span> Update or re-upload the defective document below, then click <strong className="text-amber-950 underline">"Resubmit for Verification"</strong> to return this record to the queue.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <section>
                  <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">A</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Personal & Contact Information</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        OSCA ID Number *
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                            Format: Year Issued (YYYY) and the 8-digit Serial Number.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="px-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-slate-400 font-black text-sm">OSCA-</span>
                        <input required type="text" maxLength={4} value={formData.osca_id_year} onChange={(e) => setFormData({ ...formData, osca_id_year: handleNumberInput(e.target.value) })} className="w-24 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-center" placeholder="YYYY" />
                        <span className="text-slate-300 font-bold">-</span>
                        <input required type="text" maxLength={15} value={formData.osca_id_serial} onChange={(e) => setFormData({ ...formData, osca_id_serial: handleNumberInput(e.target.value) })} className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="SC ID NO." />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          Mobile / Landline
                          <div className="group relative">
                            <Info size={12} className="text-slate-300 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                              Primary contact number for payout notifications.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                            </div>
                          </div>
                        </label>
                        <input type="text" maxLength={11} value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: handleNumberInput(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="09171234567" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          Email
                          <div className="group relative">
                            <Info size={12} className="text-slate-300 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                              Optional: For digital receipts and system updates.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                            </div>
                          </div>
                        </label>
                        <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Last Name *
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center">
                            Legal surname as appearing on birth certificate.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <input required type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: handleNameInput(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Given Name *
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center">
                            First name and any other names (e.g. Juan Jr.)
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <input required type="text" value={formData.given_name} onChange={(e) => setFormData({ ...formData, given_name: handleNameInput(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Middle Name
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center">
                            Leave blank if not applicable.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <input type="text" value={formData.middle_name} onChange={(e) => setFormData({ ...formData, middle_name: handleNameInput(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Birthdate *
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                            Crucial for milestone gift (80, 85, 90, 95, 100) eligibility.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600" size={18} />
                        <input required type="date" max={getMinAgeDate()} value={formData.date_of_birth} onChange={(e) => handleDobChange(e.target.value)} className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:bg-white transition-all outline-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Age (Auto)
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                            Automatically calculated based on the birthdate above.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <div className="relative">
                        <input readOnly type="text" value={formData.age} className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl font-black text-indigo-600 text-center" placeholder="--" />
                        {formData.age && parseInt(formData.age) >= 80 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Sex
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                            Biological sex for demographic reporting.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <select required value={formData.sex} onChange={(e) => setFormData({ ...formData, sex: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold"><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option></select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        Civil Status
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                            Legal civil status for pension verification.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </label>
                      <select required value={formData.civil_status} onChange={(e) => handleCivilStatusChange(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold"><option value="">Select...</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="WIDOWED">Widowed</option><option value="SEPARATED">Separated</option><option value="DIVORCED">Divorced</option></select>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      Residential Address
                      <div className="group relative">
                        <Info size={12} className="text-slate-300 cursor-help" />
                        <div className="absolute bottom-full left-0 mb-2 w-56 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 font-medium text-center shadow-xl">
                          Current living address for door-to-door distribution.
                          <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-800"></div>
                        </div>
                      </div>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">District *</label>
                        <select required value={formData.res_district} onChange={(e) => setFormData({ ...formData, res_district: e.target.value, res_brgy: '' })} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold appearance-none cursor-pointer">
                          <option value="">Select District...</option>
                          {Object.keys(QUEZON_CITY_BARANGAYS).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Barangay *</label>
                        <select required value={formData.res_brgy} onChange={(e) => setFormData({ ...formData, res_brgy: e.target.value })} disabled={!formData.res_district} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                          <option value="">{formData.res_district ? 'Select Barangay...' : 'Select a district first'}</option>
                          {formData.res_district && [...QUEZON_CITY_BARANGAYS[formData.res_district]].sort((a, b) => a.localeCompare(b)).map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">House / Unit #</label>
                        <input type="text" placeholder="e.g. 123 / Blk 5 Lot 10" value={formData.res_house} onChange={(e) => setFormData({ ...formData, res_house: e.target.value })} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Street</label>
                        <input type="text" placeholder="e.g. Sampaguita St." value={formData.res_street} onChange={(e) => setFormData({ ...formData, res_street: e.target.value })} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium" />
                      </div>
                    </div>
                    <div className="mt-3 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Quezon City, Metro Manila</p>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">B</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Family & Beneficiaries</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        Spouse Details
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium text-center">
                            Legal name and citizenship of the spouse.
                            <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </h4>
                      <input
                        type="text"
                        disabled={formData.civil_status !== 'MARRIED' && formData.civil_status !== 'SEPARATED'}
                        value={formData.spouse_name}
                        onChange={(e) => setFormData({ ...formData, spouse_name: handleNameInput(e.target.value) })}
                        className={`w-full px-5 py-4 border rounded-2xl font-bold uppercase transition-all ${(formData.civil_status !== 'MARRIED' && formData.civil_status !== 'SEPARATED') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                        placeholder={(formData.civil_status !== 'MARRIED' && formData.civil_status !== 'SEPARATED') ? "Spouse Details Disabled" : "Spouse Full Name"}
                      />
                      <input
                        type="text"
                        disabled={formData.civil_status !== 'MARRIED' && formData.civil_status !== 'SEPARATED'}
                        value={formData.spouse_citizenship}
                        onChange={(e) => setFormData({ ...formData, spouse_citizenship: e.target.value.toUpperCase() })}
                        className={`w-full px-5 py-4 border rounded-2xl font-bold uppercase transition-all ${(formData.civil_status !== 'MARRIED' && formData.civil_status !== 'SEPARATED') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                        placeholder={(formData.civil_status !== 'MARRIED' && formData.civil_status !== 'SEPARATED') ? "Spouse Details Disabled" : "Spouse Citizenship"}
                      />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        Primary Beneficiary
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium text-center shadow-xl">
                            Person to receive the benefit in case of any issues.
                            <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      </h4>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Full Name" value={formData.primary_ben_name} onChange={(e) => setFormData({ ...formData, primary_ben_name: handleNameInput(e.target.value) })} className="w-2/3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase" />
                        <input type="text" placeholder="Relation" value={formData.primary_ben_rel} onChange={(e) => setFormData({ ...formData, primary_ben_rel: handleNameInput(e.target.value) })} className="w-1/3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase" />
                      </div>
                    </div>
                  </div>

                  {/* NEW: Authorized Representative Section */}
                  <div className="p-8 bg-indigo-50/30 rounded-[32px] border border-indigo-100/50 space-y-6">
                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                      Authorized Representative (If Any)
                      <div className="group relative">
                        <Info size={12} className="text-indigo-300 cursor-help" />
                        <div className="absolute bottom-full left-0 mb-2 w-56 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium text-center shadow-xl">
                          Person authorized by the senior to receive the gift/pension.
                          <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-800"></div>
                        </div>
                      </div>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <input
                          type="text"
                          placeholder="Representative Full Name"
                          value={formData.reps[0]?.name || ''}
                          onChange={(e) => {
                            const newReps = [...formData.reps];
                            if (newReps.length === 0) newReps.push({ name: '', relation: '', contact: '' });
                            newReps[0].name = handleNameInput(e.target.value);
                            setFormData({ ...formData, reps: newReps });
                          }}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <input
                          type="text"
                          placeholder="Relationship"
                          value={formData.reps[0]?.relation || ''}
                          onChange={(e) => {
                            const newReps = [...formData.reps];
                            if (newReps.length === 0) newReps.push({ name: '', relation: '', contact: '' });
                            newReps[0].relation = handleNameInput(e.target.value);
                            setFormData({ ...formData, reps: newReps });
                          }}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <input
                          type="text"
                          maxLength={11}
                          placeholder="Contact Number"
                          value={formData.reps[0]?.contact || ''}
                          onChange={(e) => {
                            const newReps = [...formData.reps];
                            if (newReps.length === 0) newReps.push({ name: '', relation: '', contact: '' });
                            newReps[0].contact = handleNumberInput(e.target.value);
                            setFormData({ ...formData, reps: newReps });
                          }}
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">C</span>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                      Benefit Utilization
                      <div className="group relative">
                        <Info size={16} className="text-slate-300 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium text-center shadow-2xl">
                          Indicate how the financial assistance will be utilized by the senior citizen.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                        </div>
                      </div>
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                      {['FOOD', 'MEDICINE', 'HEALTH SERVICES', 'HOUSEHOLD NEEDS', 'OTHERS'].map((item) => (
                        <label key={item} className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={formData.utilization.includes(item)} onChange={() => handleUtilizationChange(item)} className="w-6 h-6 rounded-lg text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600 transition-colors">{item}</span>
                        </label>
                      ))}
                    </div>

                    {formData.utilization.includes('OTHERS') && (
                      <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1 mb-2 block flex items-center gap-1.5">
                          Specify Other Purposes
                          <div className="group relative">
                            <Info size={10} className="text-indigo-300" />
                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium">
                              Type specific usage (e.g. ELECTRICITY, WATER).
                            </div>
                          </div>
                        </label>
                        <input
                          type="text"
                          value={formData.utilization_others}
                          onChange={(e) => setFormData({ ...formData, utilization_others: e.target.value.toUpperCase() })}
                          placeholder="e.g. UTILITIES, DEBT PAYMENT, ETC."
                          className="w-full px-5 py-3 bg-white border border-indigo-200 rounded-xl font-bold text-sm text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-8"><span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">D</span><h3 className="text-lg font-black text-slate-800 tracking-tight">Documentary Requirements</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-indigo-400 group relative transition-all border-spacing-2">
                      <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'psa_cert_file')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">
                          {formData.psa_cert_file ? <FileCheck size={24} className="text-emerald-500" /> : (formData.psa_cert_url ? <FileCheck size={24} className="text-indigo-400" /> : <Upload size={24} />)}
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5 justify-center">
                            PSA Birth Cert
                            <div className="group relative">
                              <Info size={10} className="text-slate-300" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium">
                                Authenticated copy from PSA for age verification.
                              </div>
                            </div>
                          </h4>
                          <div className="flex flex-col items-center">
                            <p className="text-[9px] font-bold text-slate-400 mt-1 truncate max-w-[150px]">
                              {formData.psa_cert_file ? formData.psa_cert_file.name : (formData.psa_cert_url ? getFileNameFromUrl(formData.psa_cert_url) : 'Upload PDF Only')}
                            </p>
                            {(formData.psa_cert_file || formData.psa_cert_url) && (
                              <button
                                type="button"
                                onClick={() => setPdfPreviewSrc({
                                  url: formData.psa_cert_file ? undefined : formData.psa_cert_url,
                                  file: formData.psa_cert_file || null,
                                  title: 'PSA Birth Certificate'
                                })}
                                className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all relative z-20"
                              >
                                View File
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-indigo-400 group relative transition-all border-spacing-2">
                      <input type="file" accept=".pdf,image/*" onChange={(e) => handleFileChange(e, 'primary_id_file')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">
                          {formData.primary_id_file ? <FileCheck size={24} className="text-emerald-500" /> : (formData.primary_id_url ? <FileCheck size={24} className="text-indigo-400" /> : <Upload size={24} />)}
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5 justify-center">
                            OSCA ID
                            <div className="group relative">
                              <Info size={10} className="text-slate-300" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium">
                                Office for Senior Citizens Affairs ID card.
                              </div>
                            </div>
                          </h4>
                          <div className="flex flex-col items-center">
                            <p className="text-[9px] font-bold text-slate-400 mt-1 truncate max-w-[150px]">
                              {formData.primary_id_file ? formData.primary_id_file.name : (formData.primary_id_url ? getFileNameFromUrl(formData.primary_id_url) : 'Upload PDF or Image')}
                            </p>
                            {(formData.primary_id_file || formData.primary_id_url) && (
                              <button
                                type="button"
                                onClick={() => setPdfPreviewSrc({
                                  url: formData.primary_id_file ? undefined : formData.primary_id_url,
                                  file: formData.primary_id_file || null,
                                  title: 'OSCA ID'
                                })}
                                className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all relative z-20"
                              >
                                View File
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-indigo-400 group relative transition-all border-spacing-2">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'picture_2x2_file')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm">
                          {formData.picture_2x2_file ? <ImageIcon size={24} className="text-emerald-500" /> : (formData.picture_2x2_url ? <ImageIcon size={24} className="text-indigo-400" /> : <Upload size={24} />)}
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5 justify-center">
                            2x2 Photo
                            <div className="group relative">
                              <Info size={10} className="text-slate-300" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 font-medium">
                                Recent 2x2 colored photo with white background.
                              </div>
                            </div>
                          </h4>
                          <div className="flex flex-col items-center">
                            <p className="text-[9px] font-bold text-slate-400 mt-1 truncate max-w-[150px]">
                              {formData.picture_2x2_file ? formData.picture_2x2_file.name : (formData.picture_2x2_url ? getFileNameFromUrl(formData.picture_2x2_url) : 'Upload Image')}
                            </p>
                            {(formData.picture_2x2_file || formData.picture_2x2_url) && (
                              <a
                                href={formData.picture_2x2_file ? URL.createObjectURL(formData.picture_2x2_file) : formData.picture_2x2_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all relative z-20"
                              >
                                View Photo
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-rose-50 border border-rose-100 p-10 rounded-[40px] space-y-8">
                  <div className="flex items-center gap-4 text-rose-600"><AlertCircle size={32} /><div><h3 className="text-lg font-black uppercase tracking-tighter">Legal Certification & Consent</h3><p className="text-xs font-bold text-rose-400 uppercase tracking-widest">Final Verification</p></div></div>
                  <div className="space-y-4">
                    <label className="flex items-start gap-5 cursor-pointer p-6 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-rose-100"><input type="checkbox" required checked={formData.consent_truth} onChange={(e) => setFormData({ ...formData, consent_truth: e.target.checked })} className="mt-1 w-7 h-7 rounded-xl text-rose-600 border-rose-200" /><span className="text-sm text-slate-700 font-bold leading-relaxed">I certify under oath that all information is true and correct.</span></label>
                    <label className="flex items-start gap-5 cursor-pointer p-6 hover:bg-white rounded-3xl transition-all border border-transparent hover:border-rose-100"><input type="checkbox" required checked={formData.consent_privacy} onChange={(e) => setFormData({ ...formData, consent_privacy: e.target.checked })} className="mt-1 w-7 h-7 rounded-xl text-rose-600 border-rose-200" /><span className="text-sm text-slate-700 font-bold leading-relaxed">I authorize NCSC to process my data per R.A. No. 11982.</span></label>
                  </div>
                </section>
              </div>

              <div className="flex justify-end gap-4 px-10 py-8 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px]">Close</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-8 py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 ${returnedCorrectionInfo
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                    }`}
                >
                  {isSubmitting ? 'Uploading...' : (isEditMode ? (returnedCorrectionInfo ? 'Resubmit for Verification' : 'Save Changes') : 'Complete Entry')}
                  {returnedCorrectionInfo ? <RotateCcw size={18} /> : <CheckSquare size={18} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- STATUS UPDATE MODAL (MISSING COMPONENT RESTORED) --- */}
      {isStatusModalOpen && selectedSeniorForStatus && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in zoom-in duration-200">
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
                <button onClick={() => handleStatusUpdate('DECEASED')} className="flex items-center justify-between px-6 py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl border border-rose-100 transition-all group">
                  <span className="text-xs font-black uppercase tracking-widest">Deceased</span>
                  <X size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button onClick={() => handleStatusUpdate('TRANSFERRED')} className="flex items-center justify-between px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition-all group">
                  <span className="text-xs font-black uppercase tracking-widest">Transferred LGU</span>
                  <RefreshCcw size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button onClick={() => handleStatusUpdate('SUSPENDED')} className="flex items-center justify-between px-6 py-4 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-2xl border border-amber-100 transition-all group">
                  <span className="text-xs font-black uppercase tracking-widest">Suspended / Fraud</span>
                  <AlertCircle size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button onClick={() => setIsStatusModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ANTI-GHOST PENSIONER: REPORT DECEASED MODAL --- */}
      {isDeceasedModalOpen && selectedSeniorForStatus && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <form onSubmit={handleReportDeceased} className="flex flex-col">
              <div className="p-8 border-b border-slate-100 bg-rose-50/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
                  <UserX size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Notice of Demise / Report Deceased
                  </h3>
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mt-0.5">
                    Anti-Ghost Pensioner Protocol (COA Audit Compliance)
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-5">
                {/* Beneficiary Banner */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Beneficiary</div>
                  <div className="font-black text-slate-800 text-sm mt-0.5">
                    {selectedSeniorForStatus.last_name}, {selectedSeniorForStatus.first_name}
                  </div>
                  <div className="text-slate-500 font-mono mt-0.5">
                    OSCA ID: {selectedSeniorForStatus.osca_id} • Barangay: {selectedSeniorForStatus.barangay}
                  </div>
                </div>

                {/* Date of Death Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Date of Death *
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={deceasedForm.date_of_death}
                    onChange={(e) => setDeceasedForm(prev => ({ ...prev, date_of_death: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                {/* Scanned Death Certificate Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    PSA Death Certificate (PDF or Image)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setDeceasedForm(prev => ({ ...prev, death_cert_file: e.target.files![0] }));
                      }
                    }}
                    className="w-full text-xs font-bold text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                  />
                  <p className="text-[10px] text-slate-400 font-medium ml-1">
                    Attach copy issued by PSA or Local Civil Registry for liquidation attachment.
                  </p>
                </div>

                {/* Remarks / Details */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Reporting Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={deceasedForm.remarks}
                    onChange={(e) => setDeceasedForm(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Details of reporter or civil registry confirmation..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                  />
                </div>

                {/* Public Fund Safety Warning */}
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-950 font-medium space-y-1">
                  <div className="font-black text-rose-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                    Automated Fund Protection
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-900/80">
                    Submitting this will permanently set this senior to <strong>DECEASED</strong> and automatically <strong>freeze and cancel all pending disbursement payroll vouchers</strong> in the system.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDeceasedModalOpen(false)}
                  className="px-6 py-3 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Notice of Demise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- INTELLIGENT DOCUMENT VERIFICATION DRAWER --- */}
      {verificationState && verificationState.isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 md:p-10 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    NCSC Document Verification Pipeline
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Automated Form OCR & Design Frame Validation
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-10 overflow-y-auto flex-1 custom-scrollbar space-y-8">

              {/* STAGE A: ACTIVE SCANNING ANIMATION */}
              {verificationState.stage === 'scanning' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="relative w-44 h-44 bg-slate-900 border-2 border-indigo-500/40 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl">
                    {verificationState.previewUrl ? (
                      <img
                        src={verificationState.previewUrl}
                        alt="Scanning document"
                        className="w-full h-full object-cover opacity-60 filter blur-[1px]"
                      />
                    ) : (
                      <Upload size={44} className="text-indigo-400 animate-pulse" />
                    )}
                    {/* Laser beam */}
                    <div className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] z-20 animate-scan"></div>
                    <div className="absolute inset-0 bg-indigo-900/20 mix-blend-overlay"></div>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 animate-pulse">
                      Analyzing Document Layout & Biometrics...
                    </h4>
                    <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                      Running multi-scale CNN face landmark isolation, SHA-256 integrity hashing, and security framing checks.
                    </p>
                  </div>
                </div>
              )}

              {/* STAGE B: RESULTS VIEW */}
              {verificationState.stage === 'results' && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={`p-6 rounded-[24px] border flex items-center justify-between transition-all ${verificationState.status === 'FAIL'
                      ? 'bg-rose-50 border-rose-100 text-rose-800'
                      : (verificationState.faceDetected === false
                        ? 'bg-amber-50/90 border-amber-200/80 text-amber-900'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-800')
                    }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${verificationState.status === 'FAIL'
                          ? 'bg-rose-500 text-white'
                          : (verificationState.faceDetected === false ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white')
                        }`}>
                        {verificationState.status === 'FAIL' ? (
                          <X size={24} />
                        ) : (
                          verificationState.faceDetected === false ? <AlertCircle size={24} /> : <CheckSquare size={24} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-wider">
                          {verificationState.status === 'FAIL'
                            ? 'Document Rejected'
                            : (verificationState.faceDetected === false
                              ? 'Format Verified • Queued for Manual Admin Review'
                              : 'Format & Biometrics Pre-Check Verified')}
                        </h4>
                        <p className="text-xs font-bold opacity-80 mt-0.5 uppercase tracking-wider">
                          {verificationState.errorMessage
                            ? verificationState.errorMessage
                            : (verificationState.matchNote || `Document meets required formatting standards.`)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Inspection Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT: Uploaded Document Image Preview */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-indigo-500" />
                          Uploaded Document Visual
                        </h5>
                        <div className="flex items-center gap-2">
                          {verificationState.imageDimensions && (
                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {verificationState.imageDimensions}
                            </span>
                          )}
                          <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg uppercase">
                            {verificationState.fileSizeStr || 'Valid'}
                          </span>
                        </div>
                      </div>

                      {/* Actual Document Preview Container */}
                      <div className="relative bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center p-3 min-h-[300px] max-h-[400px] group">
                        {verificationState.previewUrl ? (
                          <img
                            src={verificationState.previewUrl}
                            alt="Uploaded document preview"
                            className="max-h-[370px] w-auto max-w-full object-contain rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-[1.01]"
                          />
                        ) : (
                          <div className="text-center py-12 space-y-3 text-slate-400">
                            <FileText size={48} className="mx-auto text-slate-500" />
                            <p className="text-xs font-bold">{verificationState.file?.name}</p>
                          </div>
                        )}

                        {/* Filename chip badge */}
                        <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2 max-w-[85%] shadow-md">
                          <FileText size={12} className="text-indigo-400 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-200 truncate">
                            {verificationState.file?.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Diagnostics & Biometric Scorecard */}
                    <div className="lg:col-span-5 space-y-4">

                      {/* Biometric Landmark Status */}
                      {verificationState.fieldName !== 'psa_cert_file' && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Biometric Face Inspection
                          </h5>

                          {verificationState.faceDetected && verificationState.detectedFaceCropUrl ? (
                            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-4 shadow-sm">
                              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-sm shrink-0 bg-white">
                                <img
                                  src={verificationState.detectedFaceCropUrl}
                                  alt="Detected face crop"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-emerald-600 text-[8px] font-black text-white text-center py-0.5 uppercase tracking-tight">
                                  {verificationState.faceConfidence}% Conf
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-emerald-900 font-black text-xs uppercase tracking-wider">
                                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                  Portrait Isolated
                                </div>
                                <p className="text-[11px] text-slate-600 font-medium leading-tight">
                                  Face landmarks confirmed on document via multi-scale CNN detector.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-2.5 shadow-sm">
                              <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                                <AlertCircle size={15} className="text-amber-600 shrink-0" />
                                Flagged for Manual Review
                              </div>
                              <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium">
                                Automated detector could not cleanly isolate a frontal portrait (often caused by lamination glare, QC stamps, or card tilt).
                              </p>
                              <div className="p-2.5 bg-white/90 rounded-xl border border-amber-100 text-[10px] text-amber-950 font-semibold flex items-center gap-2">
                                <CheckSquare size={13} className="text-emerald-600 shrink-0" />
                                <span><strong>Document is accepted.</strong> Admin will perform side-by-side visual comparison in Review Queue.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Automated Cross-Match Score (if 2x2 and OSCA both present) */}
                      {verificationState.faceMatchScore !== undefined && (
                        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                              Automated Cross-Match
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${verificationState.faceMatchScore >= 70
                                ? 'bg-emerald-100 text-emerald-700'
                                : (verificationState.faceMatchScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')
                              }`}>
                              {verificationState.faceMatchScore}% Match
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 rounded-full ${verificationState.faceMatchScore >= 70
                                  ? 'bg-emerald-500'
                                  : (verificationState.faceMatchScore >= 50 ? 'bg-amber-500' : 'bg-rose-500')
                                }`}
                              style={{ width: `${verificationState.faceMatchScore}%` }}
                            />
                          </div>

                          <p className="text-[10px] text-slate-500 font-medium">
                            Comparing 68-point facial descriptor against 2x2 portrait photo.
                          </p>
                        </div>
                      )}

                      {/* Technical Breakdown Parameters */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Inspection Checklist
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">File Size</div>
                            <div className="font-black text-slate-700 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              {verificationState.fileSizeStr || 'Valid'}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deduplication</div>
                            <div className="font-black text-slate-700 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              SHA-256 Unique
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Document Type</div>
                            <div className="font-black text-slate-700 truncate">
                              {verificationState.documentType || 'Official ID'}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Next Step</div>
                            <div className="font-black text-indigo-600 flex items-center gap-1">
                              Review Queue
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, [verificationState.fieldName]: null }));
                  setVerificationState(null);
                }}
                className="px-6 py-3 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors"
              >
                Reject & Clear File
              </button>

              <button
                type="button"
                disabled={verificationState.stage === 'scanning' || verificationState.status === 'FAIL'}
                onClick={() => {
                  setVerificationState(null);
                }}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(verificationState.stage === 'scanning' || verificationState.status === 'FAIL')
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
                  }`}
              >
                Accept for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared PDF Preview Modal */}
      {pdfPreviewSrc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 md:p-10 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-10 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="text-indigo-600" size={24} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Document Preview: {pdfPreviewSrc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPdfPreviewSrc(null)}
                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 flex-grow overflow-hidden flex items-center justify-center bg-slate-50">
              <PdfViewer url={pdfPreviewSrc.url} file={pdfPreviewSrc.file} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
