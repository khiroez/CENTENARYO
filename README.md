# CENTENARYO
### Expanded Centenarian Act (R.A. 11982) Management System

> **CENTENARYO** is a full-stack, AI-powered administrative platform for the **Office of the Senior Citizens Affairs (OSCA)** built to manage Republic Act No. 11982 (Expanded Centenarians Act of 2024) and R.A. 10868 (Centenarians Act of 2016). It streamlines senior citizen registration, document verification, disbursement of milestone cash gifts, anti-fraud anomaly detection, and COA-compliant audit trail exports.

---

## Feature Overview

### Senior Citizen Registry
- **Form Annex A Integration** - full demographic profiling (sex, civil status, barangay, birth date, OSCA ID)
- **Document Upload and Storage** - PSA Birth Certificate, OSCA ID Card, 2x2 photo
- **Biometric Face Verification** - server-side OpenCV + client-side face-api.js matching photo to OSCA ID
- **Duplicate Document Detection** - SHA-256 file hashing detects duplicate PSA/ID/photo submissions
- **Dynamic Search and Filter** - by name, OSCA ID, age milestones, sex, barangay, registration status
- **Registration Workflow** - PENDING_REVIEW to UNDER_REVIEW to APPROVED / REJECTED / RETURNED

### Admin Review Queue
- Checklist-based document verification pipeline
- **Return for Correction** workflow with in-app staff notifications
- Full review history logs per senior citizen

### Disbursement and Payroll Engine
- **One-Click Payroll Generator** - auto-creates payout records for eligible seniors per quarter
- Milestone Cash Gifts: PHP 10,000 (ages 80, 85, 90, 95) and PHP 100,000 (age 100) per RA 11982 and RA 10868
- Social Pension: PHP 3,000/quarter for indigent seniors per RA 11916
- **Official Payout Claim Voucher** - printable Annex B with amount-in-words, reference number, LGU headers
- **Disbursement Guard** - blocks releases to DECEASED or SUSPENDED seniors

### Analytics Dashboard (Admin)
- Registry volume, released payouts, pending payouts, pending reviews, active anomaly flags
- Sex breakdown chart, civil status breakdown, barangay hotspot ranking
- Registry mortality profile donut chart (Active / Deceased / Suspended / Transferred)
- Age milestone distribution bar chart (80s / 85s / 90s / 95s / 100s)

### R.A. 11982 Budget Forecast Calculator
- Horizon toggles: 3 months / 6 months / 12 months
- Projected appropriation by quarter, milestone bracket, and barangay
- LGU Local Counterpart Simulator with interactive top-up slider
- Executive Budget Brief modal (printable)

### AI Intelligence Briefing
- **Budget Deficit Early Warning** - upcoming milestone beneficiaries and recommended funding
- **Door-to-Door Logistics** - medical utilization rate analysis and routing recommendation
- **Ghost Pensioner Detection** - flags barangays with unnatural 90+ survival rates and zero deaths
- **Syndicate Detection** - flags persons acting as authorized rep for 3 or more different seniors

### Audit Logs and COA Compliance
- Tamper-evident audit trail for all actions: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, REVIEW, RESUBMIT, REPORT_DECEASED
- Date range filtering: Today / Last 7 Days / Last 30 Days / Custom
- **Official COA Excel Export** - with SHA-256 integrity fingerprint, COA Circular 2012-001 citation, dual signature block
- **Raw CSV Export** for external analytics

### Notifications
- Real-time in-app notifications for review decisions and correction returns
- Capped at 100 items to prevent memory growth; persisted in localStorage

### Security
- JWT Authentication with **silent auto-refresh** on token expiry (no surprise logouts)
- Role-Based Access Control: ADMIN vs STAFF
- Data Privacy Act (RA 10173) compliance

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router, Turbopack) |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **Face Detection** | face-api.js (client-side) + OpenCV / cv2 (server-side) |
| **State Management** | React Context API (Auth, UI, Notifications) |
| **Backend** | Django 6 + Django REST Framework |
| **Authentication** | JWT via djangorestframework-simplejwt |
| **Database** | SQLite (development), PostgreSQL (production via DATABASE_URL) |
| **Computer Vision** | OpenCV (cv2) + NumPy |

