# NextGen Codes — Student Project Enquiry Website

A clean, responsive, single-page student project enquiry and guidance website for **NextGen Codes** (`BUILD. INNOVATE. GROW.`), engineered to collect project development enquiries from college students and automatically store every submission into an Excel `.xlsx` workbook.

---

## 🚀 Features

- **Single-Page Design**: Professional, trustworthy NextGen palette (Navy `#0f172a`, Electric Cyan `#06b6d4`, Subtle Orange `#f97316`).
- **Interactive Stacked Gallery**: "How Can We Help You?" section features a spring-based draggable card carousel for all 6 core services (Mini Projects, Final-Year Projects, AI/ML, Web Dev, Software Apps, Project Guidance).
- **Automated Excel (`.xlsx`) Storage**:
  - Automatically creates and appends enquiries to `NextGen_Codes_Student_Enquiries.xlsx` in the `Student Enquiries` worksheet.
  - Exactly 18 columns in the required sequence.
  - Default status: `New`.
  - Serialized write-locking prevents concurrent write races.
  - Formula injection sanitization (protects against `=`, `+`, `-`, `@` CSV/Excel attacks).
  - Preserves all historical records without overwriting.
- **Secure Server Storage**: The Excel file is saved on the server root (not in the `public/` directory), preventing unauthorized public access.
- **Optional Admin Export**: Password-protected endpoint `/api/admin/export-excel` with bearer/query key authentication.
- **WhatsApp Integration**: Connected to `+91 93450 63972` with pre-filled message URL encoding.

---

## 📂 Project Structure

```
nextgen-enquiry/
├── NextGen_Codes_Student_Enquiries.xlsx  # Generated on first submission (persisted server-side)
├── excelService.js                       # Excel workbook generation & atomic append logic
├── server.js                             # Express server, SQLite and Excel API endpoints
├── package.json                          # Dependencies: express, cors, exceljs
├── enquiries.db                          # Secondary SQLite persistence
├── public/
│   ├── index.html                        # Semantic single-page website
│   ├── style.css                         # Clean, responsive styles
│   ├── carousel.css                      # Stacked card gallery styles
│   └── script.js                         # Form validation, carousel & submission handling
└── README.md                             # Setup & deployment guide
```

---

## 💻 Local Setup & Running Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm start
```
The server will start on:
👉 **http://localhost:3000**

---

## 🧪 Testing a Form Submission

1. Open **http://localhost:3000** in your web browser.
2. Scroll to the **Project Enquiry Form** section.
3. Fill in the student details:
   - Full Name: `Test Student`
   - WhatsApp Number: `9876543210`
   - College Name: `College of Engineering`
   - Department: `Computer Science`
   - Academic Year: `4th Year`
   - Project Type: `Final-Year Project`
4. Click **SUBMIT PROJECT ENQUIRY**.
5. The form verifies inputs, appends the row to `NextGen_Codes_Student_Enquiries.xlsx`, and displays the confirmation panel with a WhatsApp contact button.

---

## 📊 Excel Workbook Structure

- **File Name**: `NextGen_Codes_Student_Enquiries.xlsx`
- **Worksheet Name**: `Student Enquiries`
- **18 Columns in Exact Order**:
  1. Enquiry ID
  2. Submission Date & Time
  3. Student Name
  4. WhatsApp Number
  5. Email Address
  6. College Name
  7. Department
  8. Academic Year
  9. Project Type
  10. Project Domain
  11. Project Idea / Requirements
  12. Preferred Technologies
  13. College Rules / Do's and Don'ts
  14. Budget Preference
  15. Specific Budget (INR)
  16. Required Assistance
  17. Additional Requirements
  18. Enquiry Status (`New`)

### How to Inspect the Excel Workbook
- You can directly open `NextGen_Codes_Student_Enquiries.xlsx` using **Microsoft Excel**, **LibreOffice Calc**, or any spreadsheet viewer.
- Or download it via the secure admin export route:
  ```
  http://localhost:3000/api/admin/export-excel?key=nextgen_admin_secure_key_2026
  ```

---

## ☁️ Persistent Hosting Requirements

When deploying to container or cloud hosting services (such as Render, Railway, Fly.io, or Heroku):

1. **Persistent Volume**:
   - Cloud containers have ephemeral filesystems by default. Attach a **Persistent Disk/Volume** (e.g. at `/data`) to ensure `.xlsx` records survive redeployments.
   - Set the environment variable:
     ```env
     EXCEL_PATH=/data/NextGen_Codes_Student_Enquiries.xlsx
     DB_PATH=/data/enquiries.db
     ADMIN_KEY=your_strong_admin_password
     ```
2. **Standard VPS / VM (Ubuntu/Debian + PM2)**:
   - Files stored on regular VPS disk are naturally persistent.
   - Run with PM2: `pm2 start server.js --name "nextgen-enquiry"`.
