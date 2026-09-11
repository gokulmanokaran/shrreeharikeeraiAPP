# 📊 Google Sheets & Admin Email Order Notification Setup Guide

This guide walks you through connecting every customer order from **Shree Hari Keerai** directly into your **Google Spreadsheet** and sending an instant **HTML email notification** with WhatsApp & Call quick actions to your business email.

---

## 🚀 2-Minute Setup Instructions

### Step 1: Create a Google Sheet
1. Go to [Google Sheets](https://sheets.new) and create a new spreadsheet.
2. Rename the spreadsheet to **"Shree Hari Keerai Orders"** (or any name you prefer).

---

### Step 2: Open Apps Script
1. In the Google Sheets top menu, click **Extensions** > **Apps Script**.
2. Delete any default code in the editor (`function myFunction() { ... }`).

---

### Step 3: Paste the Webhook Code
1. Open the file [`google-apps-script.js`](./google-apps-script.js) from this repository.
2. Copy the entire contents and paste it into the Google Apps Script editor.
3. At line 17, update your admin email address:
   ```javascript
   var ADMIN_EMAIL = "your-business-email@gmail.com";
   ```
4. Click the **Save** icon (💾) or press `Ctrl + S`.

---

### Step 4: Deploy as a Web App
1. In the top right of the Apps Script editor, click **Deploy** > **New deployment**.
2. Click the gear icon (⚙️) next to *Select type* and choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Shree Hari Storefront Webhook v1`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial: Allows your storefront to post orders)*
4. Click **Deploy**.
5. When prompted, click **Authorize access**, select your Google Account, click **Advanced**, and then click **Go to Untitled project (unsafe)** to grant spreadsheet and email sending permissions.
6. Copy the **Web App URL** (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Step 5: Add Web App URL to Environment
1. In your local `.env` file (or in Vercel Project Settings > Environment Variables):
   ```env
   VITE_ORDER_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
2. For Vercel production deployments, you can also add `GOOGLE_SHEETS_WEBHOOK_URL` in the Vercel Dashboard under **Project Settings > Environment Variables**.

---

## 📋 What Gets Recorded in Google Sheets

The script automatically creates and formats the **"Orders"** tab with the following columns:

| Column | Description |
|---|---|
| **Order ID** | Unique reference (e.g. `SHK829104`) |
| **Date & Time** | Formatted date & time (IST) |
| **Customer Name** | Full name |
| **Mobile** | 10-digit mobile number |
| **Email** | Customer email (or N/A if skipped) |
| **Delivery Address** | Full formatted address with door/street/area |
| **City** | City (e.g. Coimbatore) |
| **State** | State (e.g. Tamil Nadu) |
| **Pincode** | 6-digit postal code |
| **Latitude** | GPS latitude from map pin |
| **Longitude** | GPS longitude from map pin |
| **Google Maps Link** | Direct clickable link to navigate |
| **Products Summary** | List of products with units & quantities |
| **Total Quantity** | Total items ordered |
| **Subtotal (₹)** | Base amount before discounts/delivery |
| **Delivery Charge (₹)** | Delivery fee |
| **Discount (₹)** | Applied coupon/discount |
| **Total Amount (₹)** | Final amount paid |
| **Payment Status** | Payment status (`Paid / Confirmed`) |

---

## 📧 What Admin Receives in Email

Whenever an order is placed, an email is sent instantly containing:
- 🌿 **Store Header & Order ID**
- 👤 **Customer Name, Mobile, Email, and Full Address**
- 📍 **Clickable "Open in Google Maps" Button**
- 💬 **Clickable WhatsApp Quick Chat Link**
- 📞 **Clickable Call Customer Button**
- 📦 **Structured Itemized Table with Tamil names, quantities, and pricing**
- 💰 **Financial Breakdown (Subtotal, Discount, Delivery Fee, Total Paid)**
- 🚚 **Delivery Schedule Note: Today Order – Tomorrow Evening Delivery Guaranteed**
- 🏢 **GSTIN: 33BBHPP5925L1ZA & FSSAI: 22423557000359**

---

## ✉️ What Customer Receives in Email (Immediate Order Confirmation)

If the customer entered an email address during checkout, an automated **Order Confirmation & Receipt** email is immediately dispatched with:
- 🌿 **Brand Header & Order Confirmed Badge**
- 👤 **Customer Name & Order ID**
- 📅 **Order Date & Time**
- 💳 **Payment Status & Razorpay Payment Ref ID**
- 📍 **Complete Delivery Address**
- 📦 **Itemized Purchased Products Table (Name, Unit, Quantity, Unit Price, Total)**
- 💰 **Financial Summary (Subtotal, Discount, Delivery Charge, Total Amount Paid)**
- 🚚 **Guaranteed Delivery Schedule: Today Order – Tomorrow Evening Delivery Guaranteed**
- 🏢 **Official Business Credentials: GSTIN (33BBHPP5925L1ZA) & FSSAI (22423557000359)**
- 💬 **1-Tap WhatsApp & Call Support Buttons**

---

## 🛡️ Reliability & Deduplication Features

1. **Deduplication Protection**: If an order ID is received more than once, Google Apps Script checks Column A and skips duplicate rows to protect your sheet data.
2. **Offline Queue & Retry**: If the customer's network drops during submission, `orderService.ts` queues the order locally and flushes it upon the next app visit.
3. **Zero Frontend Secret Exposure**: No private Google Cloud keys or Gmail passwords are ever exposed in frontend client code.
