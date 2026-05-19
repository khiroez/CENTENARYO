# 🇵🇭 CENTENARYO
### Expanded Centenarian Act (R.A. 11982) Management System

**CENTENARYO** is a high-fidelity, intelligent administrative platform designed to manage the implementation of Republic Act No. 11982. The system streamlines the registration, auditing, and disbursement of milestone financial awards to Filipino senior citizens reaching the ages of 80, 85, 90, 95, and 100.

---

## ✨ Key Features

### 🏛️ Unified Senior Registry
*   **Comprehensive Demographic Profiling**: Form Annex A integration tracking biological **Sex** (Male/Female) and **Civil Status** (Single, Married, Widowed, Separated).
*   **Document Persistence**: High-reliability handling of PSA birth certificates, valid IDs, and 2x2 photos.
*   **Dynamic Search & Filter**: Real-time filtering by age milestones, biological sex, barangay, and registry application status.

### 📊 Live Analytics & Dashboard Graphs
*   **Registry Volume & Financial Forecast**: Real-time budget forecasting and pipeline allocation.
*   **Sex & Demographics Ratio**: Real-time biological sex breakdown bar charts updated dynamically from the database.
*   **Civil Status Breakdown**: Modern count cards detailing Married, Widowed, Single, and Separated beneficiaries.
*   **Registry & Mortality Profile**: Beautiful color-harmonized **Registry Cleanup & Death Stats** donut chart representation:
    *   🟢 **Active Citizens** (Emerald Green badge)
    *   🔴 **Deceased (Cleaned)** (Rose badge)
    *   🟡 **Suspended/Fraud** (Amber badge)
    *   ⚫ **Transferred Out** (Slate-Gray badge)

### 💰 Smart Payout & Disbursement Engine
*   **One-Click Payroll**: Automated generation of payout records based on age eligibility milestones.
*   **Disbursement Tracking**: Real-time monitoring of "Pending" vs "Released" payouts.
*   **Prescriptive Recommendations**: Intelligent suggestion modules that flag doors-to-door or standard payout pipelines.

### 🛡️ Secure Audit Logs & Session Trails
*   **Dual Session Tracking**: Real-time logging of both **Logins** and **Logouts** (capturing username, timestamp, and client IP address).
*   **Full-Text Search Filters**: High-performance paginated filters (50 logs per page) that query across Username, Target Database Model, and Changes Summary.
*   **Action Filters**: Quick action selector matching CREATE, UPDATE, DELETE, and LOGINS/LOGOUTS activity timelines.

### 🧠 ML Anomaly Detection (AI-Powered)
*   **Syndicate Fraud Protection**: Uses a Random Forest machine learning model to detect suspicious registration patterns.
*   **Security Modals**: High-stakes actions (suspensions/resolutions) are gated behind a global security UI for Admins.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
*   **Styling**: Vanilla CSS (Tailwind CSS fallback support)
*   **Icons**: Lucide React
*   **State Management**: React Context API (Auth, UI, Notifications)

### Backend
*   **Framework**: [Django](https://www.djangoproject.com/)
*   **API**: Django REST Framework (DRF)
*   **Security**: JWT Authentication, CORS/CSRF Protection
*   **Machine Learning**: Scikit-learn (RandomForestClassifier)

### Infrastructure
*   **Database**: PostgreSQL / SQLite (Local dev environment)
*   **Frontend Hosting**: [Vercel](https://vercel.com/)
*   **Backend Hosting**: [Render](https://render.com/)

---

## 🚀 Quick Start

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)

### Local Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/khiroez/CENTENARYO.git
    cd CENTENARYO
    ```

2.  **Backend Configuration**
    ```powershell
    cd backend
    python -m venv venv
    .\venv\Scripts\activate  # Source venv/bin/activate on Linux/macOS
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py seed_data  # Clean-seeds 100 seniors & milestone payouts
    python manage.py runserver
    ```

3.  **Frontend Configuration**
    ```powershell
    cd ../frontend
    npm install
    ```
    *   **Running the Next.js Server on Windows**:
        If your system execution policy blocks running PowerShell scripts, use the command-prompt bypass file:
        ```powershell
        npm.cmd run dev
        ```
        *Or standard macOS/Linux command:*
        ```bash
        npm run dev
        ```

4.  **Access the App**
    *   URL: `http://localhost:3000`
    *   Admin: `admin` / `admin123`
    *   Staff: `staff` / `staff123`

---

## 📜 Compliance & Security
This system is built with **Data Privacy Act (RA 10173)** principles in mind, ensuring sensitive PII (Personally Identifiable Information) is handled with the highest degree of integrity, security auditing, and fraud protection.

---
© 2026 CENTENARYO · National Commission of Senior Citizens (NCSC)
