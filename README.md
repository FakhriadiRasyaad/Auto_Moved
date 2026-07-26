# 📸 LTI Photobooth — AutoMoved System (v2.0)

[![Production Site](https://img.shields.io/badge/Production-axionix--two.vercel.app-ff4886?style=for-the-badge&logo=vercel)](https://axionix-two.vercel.app/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Storage-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Duitku Gateway](https://img.shields.io/badge/Payment-Duitku%20Gateway-0052CC?style=for-the-badge)](https://www.duitku.com/)
[![MediaPipe AI](https://img.shields.io/badge/AI-MediaPipe%20Gestures-FF6F00?style=for-the-badge&logo=google)](https://mediapipe.dev/)

**LTI Photobooth (AutoMoved System)** is a state-of-the-art, self-service web & desktop kiosk application built for modern photobooth businesses. It streamlines the complete guest journey — from user registration, dynamic package selection, instant QRIS & Duitku digital payments, interactive AI-powered photo sessions with gesture control, frame & sticker layout editor, to instant QR code download & photo monetization.

---

## ✨ Key Features & System v2 Highlights

### 📸 1. Self-Service Kiosk & Photo Session
- **Unlimited Photo Snap**: Guests can snap unlimited photos during their allocated countdown session.
- **2-Second Hold Preview**: Immediately displays captured photos on the viewport overlay for 2 seconds before returning to live feed.
- **Enlarged AI Assistant Viewport**: Interactive video player container providing clear visual pose guidance.
- **Hand Gesture Recognition**: Powered by Google MediaPipe to trigger photo countdowns without touching the screen.

### 🖼️ 2. Guest Selection & Frame Layout Editor
- **10-Photo Selection Limit**: Guests interactively select up to 10 best photos from their session gallery (`guest-gallery.html`).
- **Dynamic Slot Framing**: Selected 10 photos are automatically populated into frame slots and layout templates (`pilih-frame.html`).
- **Sticker & Layer Editor**: Drag-and-drop custom stickers with scaling, rotation, and z-index ordering.

### 💳 3. Payment Gateway & Monetization ("Unlock All Photos")
- **Duitku Payment Gateway Integration**: Automated payment flow supporting Bank Transfer, QRIS, ShopeePay, OVO, Dana, and Virtual Accounts via Supabase Deno Edge Functions.
- **Dynamic Manual QRIS**: Real-time CRC16-CCITT payload generator for instant manual QRIS payments.
- **Full Photo Unlock Monetization**: Default download page displays the 10 selected photos. Guests can instantly pay an additional fee (`biaya_full_foto`) via Duitku to unlock all session raw photos for download.

### 👑 4. Multi-Branch Admin & Superadmin Portal
- **Superadmin Dashboard**: Multi-branch performance metrics, global statistics, and admin account management.
- **Branch Admin Panel**: Manage packages (`paket.html`), configure payment gateways (`payment.html`), manage custom frames & stickers, and monitor daily kiosk sessions.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend UI** | HTML5, Vanilla CSS3 (Custom Tokens & Glassmorphism), JavaScript (ES6+ Modules) |
| **Backend / BaaS** | Supabase (PostgreSQL Database, Storage Buckets, Row Level Security) |
| **Serverless Functions** | Deno Edge Functions (`create-duitku-transaction`, `duitku-callback`) |
| **Payment Gateway** | Duitku POP API (createInvoice) & Manual QRIS Payload Engine |
| **Computer Vision / AI** | Google MediaPipe Hands (Gesture Detection), gifshot (Animated GIF Generation) |
| **Desktop Wrapper** | Python PyWebView & Node.js (Optional Kiosk Executable) |

---

## 📁 Project Architecture & Directory Structure

```
Auto_Moved-main/
├── index.html                          # Admin & Staff Login Page
├── PRD_LTI_Photobooth.md               # Product Requirements Document (PRD v2.0)
├── app.py                              # PyWebView Desktop Kiosk Wrapper
│
├── photobox-session/                   # 📸 Photobooth Session Flow (Kiosk)
│   ├── daftar-akun.html               # Guest Registration (Step 1)
│   ├── login-akun.html                # Existing Guest Login
│   ├── pilih-paket.html               # Package Selection (Step 2)
│   ├── best-seller-paket.html         # Best Seller Package Filter
│   ├── pembayaran.html                # Payment Gateway / QRIS Page (Step 3)
│   ├── intro-video.html               # Pose Guidance Intro
│   ├── sesi-foto.html                 # Live Photo Session (Gesture AI) (Step 4)
│   └── halaman-terakhir-foto.html     # Thank You & Completion Page
│
├── result/                             # 🖼️ Guest Result & Photo Download
│   ├── guest-login.html                # Guest QR Login
│   ├── guest-gallery.html              # Interactive 10-Photo Picker
│   ├── pilih-frame.html                # Frame Layout Editor
│   ├── cetak.html                      # Print & QR Code Generator
│   ├── download.html                   # Mobile Download & Unlock All Photos
│   └── terima-kasih.html               # Feedback & Rating Page
│
├── admin/                              # 🛠️ Branch Admin Panel
│   ├── dashboard.html                  # Live Kiosk Monitoring & Session Status
│   ├── paket.html                      # Package Management & biaya_full_foto
│   ├── payment.html                    # Gateway & QRIS Settings
│   ├── edit-frame.html                 # Custom Frame Uploader
│   ├── edit-stiker.html                # Custom Sticker Uploader
│   └── folder.html                     # Session Folder Explorer
│
├── superadmin/                         # 👑 Superadmin Management
│   ├── dashboard.html                  # Multi-Branch Analytics
│   ├── buat-admin.html                 # Admin Creation Form
│   └── statistik.html                  # System Statistics
│
└── supabase/                           # ☁️ Backend Serverless Architecture
    ├── functions/
    │   ├── create-duitku-transaction/  # Edge Function: Duitku Invoice Creation
    │   └── duitku-callback/            # Edge Function: Duitku Payment Webhook
    └── migrations/
        └── add_duitku_columns.sql      # Database Schema Migration
```

---

## ⚡ Quick Start & Setup Guide

### 1. Prerequisites
- A modern web browser (Chrome, Edge, or Firefox with WebCam permissions enabled).
- A [Supabase](https://supabase.com) project with Database & Storage buckets (`photos`) created.
- (Optional) [Duitku Merchant Account](https://www.duitku.com/) for automated digital payment processing.

### 2. Database Schema Setup
Run the following SQL DDL scripts in your **Supabase SQL Editor**:

```sql
-- 1. Add biaya_full_foto column to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS biaya_full_foto INTEGER DEFAULT 15000;

-- 2. Add Duitku order tracking columns to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS duitku_order_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS duitku_reference TEXT DEFAULT NULL;

-- 3. Create index for fast Duitku webhook lookups
CREATE INDEX IF NOT EXISTS idx_sessions_duitku_order_id 
ON sessions (duitku_order_id);
```

### 3. Deploying Supabase Edge Functions (Duitku Integration)
Using the Supabase CLI, deploy the payment Edge Functions:

```bash
# Login to Supabase CLI
supabase login

# Deploy Duitku Transaction Creation Edge Function
supabase functions deploy create-duitku-transaction

# Deploy Duitku Callback Webhook Edge Function
supabase functions deploy duitku-callback
```

### 4. Running Locally
Simply open the repository with Live Server or run a local HTTP server:

```bash
# Using Python
python -m http.server 5500

# Open in browser:
# http://127.0.0.1:5500/photobox-session/daftar-akun.html
```

---

## 📄 License & Credits

Developed with ❤️ by the **LTI Photobooth Team**.  
All rights reserved © 2026.
