"use client";

import React, { useState, useEffect } from 'react';
import { Banknote, Search, CheckCircle, Clock, AlertCircle, Filter, ChevronLeft, ChevronRight, Download, X, History, Printer } from 'lucide-react';
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
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle size={13} /> Cancelled
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


function amountToWords(amount: number): string {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  
  const num = Math.floor(amount);
  if (num === 0) return 'ZERO PESOS ONLY';

  const convertChunk = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' HUNDRED ' + (n % 100 !== 0 ? convertChunk(n % 100) : '');
  };

  let words = '';
  if (Math.floor(num / 1000000) > 0) {
    words += convertChunk(Math.floor(num / 1000000)) + 'MILLION ';
  }
  const thousands = Math.floor((num % 1000000) / 1000);
  if (thousands > 0) {
    words += convertChunk(thousands) + 'THOUSAND ';
  }
  const remainder = num % 1000;
  if (remainder > 0) {
    words += convertChunk(remainder);
  }

  return words.trim() + ' PESOS ONLY';
}

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
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
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
    
    const totalAmount = disbursements.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>COA Payroll Register</x:Name>
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
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .header-title { font-size: 14pt; font-weight: bold; text-align: center; }
          .header-sub { font-size: 10pt; text-align: center; color: #475569; }
          .meta-box { margin-top: 15px; margin-bottom: 10px; font-size: 9pt; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th { font-weight: bold; background-color: #1e293b; color: #ffffff; border: 1px solid #0f172a; padding: 10px 8px; font-size: 9pt; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; }
          .total-row td { font-weight: bold; background-color: #f1f5f9; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
          .sign-table { margin-top: 35px; width: 100%; border: none; }
          .sign-table td { border: none; padding: 12px; vertical-align: top; }
          .sign-line { border-bottom: 1px solid #000000; width: 85%; height: 40px; margin-bottom: 4px; }
          .sign-name { font-weight: bold; font-size: 9pt; text-transform: uppercase; }
          .sign-title { font-size: 8pt; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header-sub">REPUBLIC OF THE PHILIPPINES</div>
        <div class="header-sub">NATIONAL COMMISSION OF SENIOR CITIZENS (NCSC) • OFFICE OF THE SENIOR CITIZENS AFFAIRS</div>
        <div class="header-title">OFFICIAL BENEFICIARY DISBURSEMENT & PAYROLL REGISTER</div>
        <div class="header-sub">Under Republic Act No. 11982 (Expanded Centenarians Act) & R.A. No. 11916 (Indigent Social Pension)</div>
        
        <div class="meta-box">
          <p><strong>Filter Status:</strong> ${statusFilter.toUpperCase()} | <strong>Generated On:</strong> ${dateStr} | <strong>System:</strong> CENTENARYO Automated Verification System</p>
        </div>

        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;
    
    disbursements.forEach(d => {
      const typeLabel = d.disbursement_type === 'SOCIAL_PENSION' ? 'Social Pension (RA 11916)' : 'Milestone Gift (RA 11982)';
      const ageLabel = d.disbursement_type === 'SOCIAL_PENSION' ? 'N/A' : (d.milestone_age ? `${d.milestone_age} Y/O` : '—');
      const dateCreated = d.created_at ? new Date(d.created_at).toLocaleDateString() : '—';
      
      tableHtml += `
        <tr>
          <td style="mso-number-format:'\\@'; font-family: monospace; font-weight: bold;">${d.reference_number || ''}</td>
          <td style="mso-number-format:'\\@'; font-family: monospace;">${d.senior_osca_id || ''}</td>
          <td style="font-weight: bold;">${d.senior_name || ''}</td>
          <td>${d.senior_barangay || ''}</td>
          <td>${typeLabel}</td>
          <td style="text-align: center;">${ageLabel}</td>
          <td style="mso-number-format:'#\\,##0\\.00'; text-align: right; font-weight: bold;">${parseFloat(d.amount).toFixed(2)}</td>
          <td style="text-align: center;">${d.quarter || ''}</td>
          <td style="text-align: center;">${d.year || ''}</td>
          <td style="text-align: center;">${d.release_date || '—'}</td>
          <td style="text-align: center; font-weight: bold;">${d.status || ''}</td>
          <td style="text-align: center;">${dateCreated}</td>
        </tr>
      `;
    });
    
    // Summary Row
    tableHtml += `
            <tr class="total-row">
              <td colspan="6" style="text-align: right; font-weight: bold; font-size: 10pt;">GRAND TOTAL (${disbursements.length} BENEFICIARIES):</td>
              <td style="mso-number-format:'PHP #\\,##0\\.00'; text-align: right; font-weight: bold; font-size: 10pt; color: #047857;">PHP ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td colspan="5"></td>
            </tr>
          </tbody>
        </table>

        <!-- Mandatory 3-Tier COA Audit Certification Block -->
        <table class="sign-table">
          <tr>
            <td width="33%">
              <div class="sign-title">PREPARED BY (DISBURSING OFFICER):</div>
              <div class="sign-line"></div>
              <div class="sign-name">LGU DISBURSING SPECIALIST</div>
              <div class="sign-title">Encoder / Special Disbursing Officer (SDO)</div>
              <div class="sign-title">Date: ________________________</div>
            </td>
            <td width="33%">
              <div class="sign-title">CERTIFIED CORRECT (COA CIRCULAR 2012-001):</div>
              <div class="sign-line"></div>
              <div class="sign-name">CITY SOCIAL WELFARE OFFICER</div>
              <div class="sign-title">Head, City Social Welfare & Development (CSWDO)</div>
              <div class="sign-title">Date: ________________________</div>
            </td>
            <td width="33%">
              <div class="sign-title">APPROVED FOR PAYMENT:</div>
              <div class="sign-line"></div>
              <div class="sign-name">CITY MAYOR / MUNICIPAL TREASURER</div>
              <div class="sign-title">Local Chief Executive / Authorized Signatory</div>
              <div class="sign-title">Date: ________________________</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `COA_Payroll_Register_${statusFilter.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintVoucher = (voucher: any) => {
    if (!voucher) return;
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const typeTitle = voucher.disbursement_type === 'SOCIAL_PENSION'
      ? 'Under Republic Act No. 11916 (Indigent Social Pension Act)'
      : 'Under Republic Act No. 11982 (Expanded Centenarians Act of 2024)';

    const typeBadge = voucher.disbursement_type === 'SOCIAL_PENSION'
      ? 'Social Pension'
      : (voucher.milestone_age ? `${voucher.milestone_age} Y/O Milestone Gift` : 'Centenarian Gift');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Claim Voucher — ${voucher.senior_name}</title>
          <style>
            @page {
              size: portrait;
              margin: 8mm 12mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              padding: 10px;
              font-size: 10pt;
              line-height: 1.35;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .header .rep {
              font-size: 8.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              color: #475569;
            }
            .header .agency {
              font-size: 9.5pt;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
              margin-top: 1px;
            }
            .header .title {
              font-size: 13pt;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 4px 0 2px 0;
              color: #000;
            }
            .header .law {
              font-size: 8pt;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748b;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              border-radius: 6px;
              margin-bottom: 10px;
            }
            .meta-item .label {
              font-size: 7.5pt;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
            }
            .meta-item .val {
              font-size: 9.5pt;
              font-weight: 900;
              color: #0f172a;
              margin-top: 1px;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              margin-bottom: 10px;
              overflow: hidden;
            }
            .card-header {
              background: #f1f5f9;
              padding: 4px 10px;
              font-size: 7.5pt;
              font-weight: 800;
              text-transform: uppercase;
              color: #334155;
              border-bottom: 1px solid #cbd5e1;
            }
            .card-body {
              padding: 6px 10px;
              display: grid;
              grid-template-columns: 2fr 1.5fr 1.5fr;
              gap: 8px;
            }
            .grant-box {
              border: 2px solid #059669;
              background: #ecfdf5;
              border-radius: 8px;
              padding: 8px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .grant-box .amount {
              font-size: 20pt;
              font-weight: 900;
              color: #064e3b;
              line-height: 1;
            }
            .grant-box .words {
              text-align: right;
              max-width: 60%;
              font-size: 8.5pt;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
            }
            .cert-box {
              font-size: 8pt;
              line-height: 1.35;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 6px 10px;
              border-radius: 6px;
              margin-bottom: 10px;
              color: #334155;
            }
            .sig-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 10px;
            }
            .sig-card {
              border: 1px solid #64748b;
              border-radius: 8px;
              padding: 8px 10px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 145px;
            }
            .sig-card-header {
              font-size: 8pt;
              font-weight: 800;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 3px;
              display: flex;
              justify-content: space-between;
            }
            .thumb-area {
              display: flex;
              gap: 10px;
              align-items: center;
              margin: 6px 0;
            }
            .thumb-box {
              width: 80px;
              height: 90px;
              border: 2px dashed #64748b;
              border-radius: 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-size: 7pt;
              text-align: center;
              color: #64748b;
              padding: 2px;
              background: #fcfcfc;
              flex-shrink: 0;
            }
            .sig-line-box {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
            }
            .sig-line {
              border-bottom: 1.5px solid #0f172a;
              text-align: center;
              padding-bottom: 2px;
              font-weight: 800;
              font-size: 9.5pt;
              text-transform: uppercase;
            }
            .rep-field {
              font-size: 8pt;
              line-height: 1.8;
              margin: 2px 0;
            }
            .footer-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              border-top: 1px solid #cbd5e1;
              padding-top: 8px;
              font-size: 8pt;
            }
            .footer-line {
              border-bottom: 1px solid #0f172a;
              height: 24px;
              margin-bottom: 2px;
              font-weight: 800;
              display: flex;
              align-items: flex-end;
              font-size: 8.5pt;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="rep">Republic of the Philippines</div>
            <div class="agency">National Commission of Senior Citizens • Office of the Senior Citizens Affairs</div>
            <div class="title">BENEFICIARY CLAIM VOUCHER & LIQUIDATION RECEIPT</div>
            <div class="law">${typeTitle} • ANNEX B (COA CIRCULAR NO. 2012-001)</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><div class="label">Voucher / Ref No.</div><div class="val">${voucher.reference_number || '#' + String(voucher.id).padStart(8, '0')}</div></div>
            <div class="meta-item"><div class="label">Period / Quarter</div><div class="val">${voucher.quarter} — Year ${voucher.year}</div></div>
            <div class="meta-item"><div class="label">Disbursement Type</div><div class="val">${typeBadge}</div></div>
            <div class="meta-item"><div class="label">Payout Date</div><div class="val">${voucher.release_date || new Date().toISOString().split('T')[0]}</div></div>
          </div>

          <div class="card">
            <div class="card-header">Beneficiary Identification</div>
            <div class="card-body">
              <div><div class="label">Full Name of Senior Citizen</div><div class="val" style="font-size: 11pt;">${voucher.senior_name}</div></div>
              <div><div class="label">OSCA Identification Card No.</div><div class="val" style="color: #1e1b4b;">${voucher.senior_osca_id || '—'}</div></div>
              <div><div class="label">Barangay / LGU Jurisdiction</div><div class="val">${voucher.senior_barangay || 'Quezon City'}</div></div>
            </div>
          </div>

          <div class="grant-box">
            <div>
              <div class="label" style="color: #065f46;">Net Cash Grant Disbursed</div>
              <div class="amount">PHP ${parseFloat(voucher.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="words">
              <div class="label">Amount in Words</div>
              <div>${amountToWords(parseFloat(voucher.amount))}</div>
            </div>
          </div>

          <div class="cert-box">
            <strong>ACKNOWLEDGMENT & CERTIFICATION:</strong> I hereby acknowledge the receipt of the cash grant indicated above under the Senior Citizens Assistance Program. I certify under penalty of law that the recipient is alive, bona fide eligible, and that the total amount was received in full without any unauthorized deductions.
          </div>

          <div class="sig-grid">
            <div class="sig-card">
              <div class="sig-card-header">
                <span>1. BENEFICIARY SIGNATURE / THUMBMARK</span>
                <span style="color: #64748b;">Principal</span>
              </div>
              <div class="thumb-area">
                <div class="thumb-box">
                  <span style="font-weight: 800;">RIGHT THUMBMARK</span>
                  <span style="font-size: 6.5pt; margin-top: 2px;">(If unable to sign)</span>
                </div>
                <div class="sig-line-box">
                  <div class="sig-line">${voucher.senior_name}</div>
                  <div style="font-size: 7.5pt; text-align: center; color: #64748b; margin-top: 2px;">Signature of Senior Citizen</div>
                </div>
              </div>
              <div style="font-size: 8pt; color: #475569;">Date Received: ________________________</div>
            </div>

            <div class="sig-card">
              <div class="sig-card-header">
                <span>2. AUTHORIZED REPRESENTATIVE</span>
                <span style="color: #64748b;">If Bedridden / Infirm</span>
              </div>
              <div class="rep-field">
                <div><span class="label">Representative Name:</span> ____________________________________</div>
                <div><span class="label">Relationship / Valid ID:</span> ____________________________________</div>
              </div>
              <div>
                <div class="sig-line" style="color: #64748b; font-weight: normal; font-size: 8pt;">Signature of Authorized Representative</div>
                <div style="font-size: 7.5pt; text-align: center; color: #64748b; margin-top: 2px;">Representative Signature & Date</div>
              </div>
            </div>
          </div>

          <div class="footer-grid">
            <div>
              <div class="label">PAID AND DISBURSED BY:</div>
              <div class="footer-line">SPECIAL DISBURSING OFFICER (SDO)</div>
              <div style="font-size: 7.5pt; color: #64748b;">LGU Disbursing Officer / OSCA Paymaster</div>
            </div>
            <div>
              <div class="label">WITNESSED & VERIFIED BY:</div>
              <div class="footer-line">BARANGAY OFFICIAL / FOCAL PERSON</div>
              <div style="font-size: 7.5pt; color: #64748b;">Barangay Kagawad / OSCA Chapter President</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
                <th className="px-4 py-4">Ref ID</th>
                <th className="px-4 py-4">Beneficiary</th>
                <th className="px-4 py-4">Barangay</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Quarter / Year</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Actions</th>
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
                    <td className="px-4 py-4 text-xs font-mono font-bold text-slate-400 bg-slate-50/40 group-hover:bg-transparent transition-colors">
                      {item.reference_number || `#${String(item.id).padStart(8, '0')}`}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[15px]">{item.senior_name || "Unknown Senior"}</span>
                        <span className="text-slate-400 font-mono text-xs font-semibold mt-0.5">{item.senior_osca_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-600">
                      {item.senior_barangay || "—"}
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                      {item.quarter} · {item.year}
                    </td>
                    <td className="px-4 py-4">
                      {renderStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex gap-2 justify-end items-center">
                        <button
                          onClick={() => { setSelectedVoucher(item); setIsVoucherModalOpen(true); }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center gap-1.5 shadow-sm"
                          title="Print Official Annex B Claim Voucher"
                        >
                          <Printer size={13} />
                          <span>Voucher</span>
                        </button>
                        <button
                          onClick={() => { setSelectedDisbursement(item); setIsDetailModalOpen(true); }}
                          className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
                        >
                          Details
                        </button>
                        {item.status === 'PENDING' && (
                          <button
                            onClick={() => handleMarkReleased(item.id)}
                            className="px-3 py-1.5 bg-white border-2 border-emerald-500 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <CheckCircle size={14} />
                            Release
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
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

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedVoucher(selectedDisbursement); setIsVoucherModalOpen(true); }}
                  className="w-full py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Printer size={16} /> Print Claim Voucher (Annex B)
                </button>

                <div className="flex gap-4">
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
        </div>
      )}

      {/* --- OFFICIAL PRINTABLE CLAIM VOUCHER MODAL (ANNEX B) --- */}
      {isVoucherModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-4xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden border border-slate-300">
            
            {/* Modal Actions Bar (Permanently pinned at top) */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">Official Beneficiary Claim Voucher (Annex B)</h3>
                  <p className="text-xs text-slate-400 font-medium">COA Circular 2012-001 & Joint Memorandum Circular Compliance</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePrintVoucher(selectedVoucher)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
                >
                  <Printer size={16} /> Print Voucher
                </button>
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                  title="Close Modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Document Container */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-8 bg-slate-200/60">
              <div id="printable-voucher" className="w-full max-w-3xl mx-auto bg-white text-slate-900 font-sans p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                
                {/* Official Document Header */}
                <div className="text-center border-b-2 border-slate-900 pb-5 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Republic of the Philippines</p>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-800">Office of the Senior Citizens Affairs (OSCA) • National Commission of Senior Citizens</p>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-950 pt-1">
                    BENEFICIARY CLAIM VOUCHER & LIQUIDATION RECEIPT
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {selectedVoucher.disbursement_type === 'SOCIAL_PENSION'
                      ? 'Under Republic Act No. 11916 (Indigent Social Pension Act)'
                      : 'Under Republic Act No. 11982 (Expanded Centenarians Act of 2024)'}
                    {' '}• ANNEX B (COA CIRCULAR NO. 2012-001)
                  </p>
                </div>

                {/* Voucher Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Voucher / Ref No.</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{selectedVoucher.reference_number || `#${String(selectedVoucher.id).padStart(8, '0')}`}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Period / Quarter</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.quarter} — Year {selectedVoucher.year}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Disbursement Type</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.disbursement_type === 'SOCIAL_PENSION' ? 'Social Pension' : 'Centenarian Gift'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Payout Date</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.release_date || new Date().toISOString().split('T')[0]}</span>
                  </div>
                </div>

                {/* Beneficiary Profile Card */}
                <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-100 px-4 py-2 font-black text-slate-700 uppercase tracking-wider border-b border-slate-300 text-[10px]">
                    Beneficiary Identification
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Full Name of Senior Citizen</span>
                      <span className="font-black text-sm text-slate-900">{selectedVoucher.senior_name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">OSCA Identification Card No.</span>
                      <span className="font-mono font-black text-sm text-indigo-950">{selectedVoucher.senior_osca_id || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Barangay / LGU Jurisdiction</span>
                      <span className="font-bold text-slate-800 uppercase">{selectedVoucher.senior_barangay || 'Quezon City'}</span>
                    </div>
                  </div>
                </div>

                {/* Net Cash Grant Highlight Box */}
                <div className="border-2 border-emerald-600 rounded-2xl p-5 bg-emerald-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block">
                      Net Cash Grant Disbursed
                    </span>
                    <div className="text-3xl font-black text-emerald-950 tracking-tight mt-0.5">
                      ₱{parseFloat(selectedVoucher.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right sm:max-w-md">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Amount in Words</span>
                    <span className="font-black text-slate-800 text-xs uppercase leading-snug">
                      {amountToWords(parseFloat(selectedVoucher.amount))}
                    </span>
                  </div>
                </div>

                {/* Legal Acknowledgment Clause */}
                <div className="text-[11px] leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p>
                    <strong>ACKNOWLEDGMENT & CERTIFICATION:</strong> I hereby acknowledge the receipt of the cash grant indicated above under the Senior Citizens Assistance Program. I certify under penalty of law that the recipient is alive, bona fide eligible, and that the total amount was received in full without any deductions.
                  </p>
                </div>

                {/* Signature & Right Thumbmark Execution Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  
                  {/* Primary Beneficiary Box */}
                  <div className="border border-slate-400 rounded-2xl p-4 flex flex-col justify-between h-56">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1.5 flex justify-between">
                      <span>1. Beneficiary Signature / Thumbmark</span>
                      <span className="text-slate-400 font-medium">Principal</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 my-2">
                      {/* Right Thumbmark Box */}
                      <div className="w-24 h-28 border-2 border-dashed border-slate-400 rounded-xl flex flex-col items-center justify-center p-1 text-center bg-slate-50/80 shrink-0">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400 leading-tight">
                          Right Thumbmark
                        </span>
                        <span className="text-[7px] text-slate-400 mt-1 leading-none">
                          (If unable to sign)
                        </span>
                      </div>

                      {/* Signature Line */}
                      <div className="flex-1 flex flex-col justify-end h-full">
                        <div className="border-b-2 border-slate-900 pb-1 text-center">
                          <span className="font-black text-xs text-slate-900 uppercase">
                            {selectedVoucher.senior_name}
                          </span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 text-center uppercase tracking-wider mt-1 block">
                          Signature of Senior Citizen
                        </span>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-500 font-medium pt-1">
                      Date Received: ________________________
                    </div>
                  </div>

                  {/* Authorized Representative Box */}
                  <div className="border border-slate-400 rounded-2xl p-4 flex flex-col justify-between h-56">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1.5 flex justify-between">
                      <span>2. Authorized Representative</span>
                      <span className="text-slate-400 font-medium">If Bedridden / Infirm</span>
                    </div>

                    <div className="space-y-2.5 my-auto text-[10px]">
                      <div className="border-b border-slate-300 pb-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Representative Name:</span>
                        <span className="font-medium text-slate-700">__________________________________________</span>
                      </div>
                      <div className="border-b border-slate-300 pb-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Relationship to Senior / ID No:</span>
                        <span className="font-medium text-slate-700">__________________________________________</span>
                      </div>
                    </div>

                    <div>
                      <div className="border-b-2 border-slate-900 pb-1 text-center">
                        <span className="text-slate-400 text-[10px]">Signature of Authorized Representative</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 text-center uppercase tracking-wider mt-1 block">
                        Rep Signature & Contact No.
                      </span>
                    </div>
                  </div>
                </div>

                {/* COA Verification & Liquidating Signatures */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">PAID AND DISBURSED BY:</span>
                    <div className="border-b border-slate-900 h-10 mt-2 flex items-end">
                      <span className="font-bold text-slate-800 text-[11px] uppercase">Special Disbursing Officer (SDO)</span>
                    </div>
                    <span className="text-[8px] text-slate-400 mt-1 block">LGU Disbursing Officer / OSCA Representative</span>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">WITNESSED & VERIFIED BY:</span>
                    <div className="border-b border-slate-900 h-10 mt-2 flex items-end">
                      <span className="font-bold text-slate-800 text-[11px] uppercase">Barangay Official / OSCA Chapter President</span>
                    </div>
                    <span className="text-[8px] text-slate-400 mt-1 block">Barangay Kagawad / Senior Citizen Focal Person</span>
                  </div>
                </div>

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
