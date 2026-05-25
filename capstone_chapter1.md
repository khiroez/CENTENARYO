# Chapter 1 – Introduction

## 1.1. Problem Statement
The local government units (LGUs) in the Philippines often rely on manual or semi‑automated spreadsheets for managing senior citizen records, payroll, and social‑pension disbursements.  The existing **CENTENARYO** system was developed as a prototype but required a full Python development environment, Node.js, and several third‑party packages to be installed on every workstation.  This created the following problems:
- **High setup overhead** – each new PC needed Python, virtual‑environment activation, and a Node.js build step.
- **Inconsistent runtime** – mismatched package versions caused frequent crashes (e.g., missing `dotenv`, `rest_framework` imports).
- **Limited portability** – the system could not be transferred as a single folder and expected internet connectivity for package installation.

## 1.2. Objectives
The capstone project aims to transform CENTENARYO into a **stand‑alone, portable Windows desktop application** that can be moved via a USB drive or a simple zip download and run on any Windows 10/11 computer without additional installations.

Specific objectives:
1. **Package the Django backend and static Next.js frontend** into a single executable using **PyInstaller**.
2. **Eliminate runtime dependencies** (no Python, no Node.js, no internet needed).
3. Preserve the full functional scope of the original system – senior‑citizen register, payroll generation, milestone‑gift handling, and social‑pension calculation.
4. Provide a **clean, modern UI** that works in a native‑app‑style browser window.
5. Document the architecture, development workflow, and technology stack for future maintenance and academic reporting.

## 1.3. Scope
- **In‑scope:** Backend API, database schema (SQLite), static UI, authentication, export‑ready packaging, documentation.
- **Out‑of‑scope:** Cloud deployment, multi‑tenant SaaS version, Android/iOS native apps.

## 1.4. Methodology Overview
The project follows a **Iterative Development** model combined with **Software Engineering best practices** (code reviews, static analysis, automated testing).  Development was performed on a Windows workstation, and each iteration produced a testable portable build.

---
*Prepared for the capstone submission of the **Information Technology** program, University of the Philippines – Open University.*
