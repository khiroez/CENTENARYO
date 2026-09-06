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

---

## Setup Guide

### Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| Node.js | v18+ |
| Python | 3.10+ |
| Git | Any recent version |

---

### Option A - Automatic Setup (Windows, Recommended)

A one-click setup wizard is included. After cloning, run it once:

`at
setup_new_pc.bat
`

This automatically:
1. Creates Python virtual environment and installs all pip packages
2. Runs all 14 database migrations
3. Seeds default admin/staff accounts and demo senior data
4. Installs all Node.js packages and builds the Next.js production bundle
5. Compiles the native Windows launcher (CENTENARYO.exe)

After setup, launch everything by double-clicking **CENTENARYO.exe**.

---

### Option B - Manual Setup

#### 1. Clone the Repository
`ash
git clone https://github.com/khiroez/CENTENARYO.git
cd CENTENARYO
`

#### 2. Backend Setup
`powershell
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate         # macOS / Linux

# Install all dependencies
pip install -r requirements.txt

# Run all database migrations
python manage.py migrate

# Seed default accounts and demo data
python manage.py seed_data

# Start the backend API server
python manage.py runserver 0.0.0.0:8000
`

#### 3. Frontend Setup
`powershell
cd ..\frontend

# Create environment config file: frontend\.env.local
# Contents: NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Install packages
npm install

# Start dev server
npm run dev
# On Windows if PowerShell blocks scripts:
npm.cmd run dev
`

#### 4. Access the App

| | |
|---|---|
| URL | http://localhost:3000 |
| Admin login | admin / admin123 |
| Staff login | staff / staff123 |

---

## Moving to Another Computer WITH Existing Data

Use this when you want to bring **real registered seniors, disbursements, audit logs, and uploaded documents** to a new PC instead of starting with demo seed data.

### Step 1 - Find the Data on the Old PC

The system uses **SQLite** - the entire database is a single file:

`
backend\db.sqlite3        <- All seniors, disbursements, audit logs, users
backend\media\            <- All uploaded photos, PSA certificates, IDs
`

Copy both to a USB drive, network share, or cloud storage.

### Step 2 - Clone and Set Up the New PC

`powershell
git clone https://github.com/khiroez/CENTENARYO.git
cd CENTENARYO\backend

python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run migrations to create the empty schema
python manage.py migrate

# WARNING: Do NOT run seed_data - that would overwrite your real data
`

### Step 3 - Restore the Data

Copy from the old PC to the new PC (replace the empty files):

| What | From (Old PC) | To (New PC) |
|------|---------------|-------------|
| Database | backend\db.sqlite3 | backend\db.sqlite3 |
| Uploaded files | backend\media\ (entire folder) | backend\media\ |

### Step 4 - Set Up the Frontend

`powershell
cd ..\frontend
npm install
`

Create rontend\.env.local:
`
NEXT_PUBLIC_API_URL=http://localhost:8000/api
`

### Step 5 - Start the System

`at
run_dev.bat
`

Or manually in two terminals:

**Terminal 1 - Backend:**
`powershell
cd backend
.\venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000
`

**Terminal 2 - Frontend:**
`powershell
cd frontend
npm run dev
`

### Step 6 - Verify

Open http://localhost:3000 and log in. All seniors, disbursements, and audit logs will be fully intact.

---

## Project Structure

`
CENTENARYO/
|-- backend/                    Django REST API
|   |-- config/                 Django settings, URLs, WSGI
|   |-- core/                   Main application
|   |   |-- migrations/         14 database schema migrations
|   |   |-- models.py           Senior, Disbursement, AuditLog, AnomalyFlag, ReviewLog
|   |   |-- views.py            All API endpoints and business logic
|   |   |-- serializers.py      DRF serializers
|   |   |-- face_engine.py      OpenCV biometric verification engine
|   |   +-- management/         Custom commands (seed_data)
|   |-- media/                  Uploaded files - NOT tracked by git
|   |-- db.sqlite3              Database - NOT tracked by git
|   +-- requirements.txt
|-- frontend/                   Next.js 15 App
|   |-- src/
|   |   |-- app/                Pages: dashboard, seniors, disbursements, review, auditlogs, anomalies
|   |   |-- components/         Header, AppShell, PdfViewer
|   |   |-- context/            AuthContext, NotificationContext, UIContext
|   |   +-- lib/api.ts          authFetch wrapper with JWT auto-refresh
|   |-- public/models/          face-api.js ML model weights (.bin / .weights)
|   +-- .env.local              Environment config - NOT tracked by git
|-- setup_new_pc.bat            One-click Windows setup wizard
|-- run_dev.bat                 Start both servers simultaneously
|-- CENTENARYO.exe              Native Windows GUI launcher
+-- README.md
`

---

## Environment Variables

### Frontend - frontend/.env.local
`env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
`

### Backend - optional .env for production
`env
DATABASE_URL=postgresql://user:password@host/dbname
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
`

---

## Statutory Compliance Reference

| Law | Provision |
|-----|-----------|
| R.A. 11982 | Expanded Centenarians Act - PHP 10,000 cash gift at ages 80, 85, 90, 95 |
| R.A. 10868 | Centenarians Act - PHP 100,000 cash gift at age 100 |
| R.A. 11916 | Expanded SSPA - PHP 1,000/month (PHP 3,000/quarter) social pension for indigent seniors |
| R.A. 10173 | Data Privacy Act - PII handling, immutable audit trails |
| COA Circular 2012-001 | Commission on Audit - SHA-256 tamper-evident audit log exports with dual signature block |

---

(c) 2026 CENTENARYO - National Commission of Senior Citizens (NCSC) - Office of the Senior Citizens Affairs (OSCA)
