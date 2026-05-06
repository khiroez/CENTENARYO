# 🇵🇭 CENTENARYO
### Expanded Centenarian Act (R.A. 11982) Management System

**CENTENARYO** is a high-fidelity, intelligent administrative platform designed to manage the implementation of Republic Act No. 11982. The system streamlines the registration, auditing, and disbursement of milestone financial awards to Filipino senior citizens reaching the ages of 80, 85, 90, 95, and 100.

---

## ✨ Key Features

### 🏛️ Unified Senior Registry
*   **Comprehensive Profiling**: Detailed record-keeping including demographics, socio-economic status, and authorized representatives.
*   **Document Persistence**: High-reliability handling of PSA birth certificates, valid IDs, and 2x2 photos.
*   **Dynamic Search & Filter**: Real-time filtering by age milestones, barangay, and application status.

### 💰 Smart Disbursement Engine
*   **One-Click Payroll**: Automated generation of payout records based on age eligibility milestones.
*   **Disbursement Tracking**: Real-time monitoring of "Pending" vs "Released" payouts.
*   **Digital Audit Trail**: Complete history of all financial transactions and status changes.

### 🧠 ML Anomaly Detection (AI-Powered)
*   **Syndicate Fraud Protection**: Uses a Random Forest machine learning model to detect suspicious registration patterns.
*   **Security Modals**: High-stakes actions (suspensions/resolutions) are gated behind a global security UI for Admins.

### 🛡️ Role-Based Access Control (RBAC)
*   **ADMIN Tier**: Full oversight, security auditing, and ML anomaly resolution.
*   **STAFF Tier**: Operational focus on registration, document verification, and payroll management.

### 🎨 Premium UI/UX
*   **Glassmorphism Design**: Modern, vibrant, and professional aesthetic using Tailwind CSS.
*   **Global Modal System**: Unified, animated feedback loop replacing browser-default alerts.
*   **Real-time Analytics**: Dashboard metrics synchronized directly with the database.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **State Management**: React Context API (Auth, UI, Notifications)

### Backend
*   **Framework**: [Django](https://www.djangoproject.com/)
*   **API**: Django REST Framework (DRF)
*   **Security**: JWT Authentication, CORS/CSRF Protection
*   **Machine Learning**: Scikit-learn (RandomForestClassifier)

### Infrastructure
*   **Database**: PostgreSQL ([Neon.tech](https://neon.tech/))
*   **Frontend Hosting**: [Vercel](https://vercel.com/)
*   **Backend Hosting**: [Render](https://render.com/)

---

## 🚀 Quick Start

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   PostgreSQL

### Local Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/khiroez/CENTENARYO.git
    cd CENTENARYO
    ```

2.  **Backend Configuration**
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # venv\Scripts\activate on Windows
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py seed_data  # Initial admin/staff accounts
    python manage.py runserver
    ```

3.  **Frontend Configuration**
    ```bash
    cd ../frontend
    npm install
    npm run dev
    ```

4.  **Access the App**
    *   URL: `http://localhost:3000`
    *   Admin: `admin` / `admin123`
    *   Staff: `staff` / `staff123`

---

## 📜 Compliance & Security
This system is built with **Data Privacy Act (RA 10173)** principles in mind, ensuring sensitive PII (Personally Identifiable Information) is handled with the highest degree of integrity and security auditing.

---
© 2026 CENTENARYO · National Commission of Senior Citizens (NCSC)
