const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { appendEnquiryToExcel, buildWorkbookFromEnquiries, EXCEL_FILE_PATH, SHEET_NAME } = require('./excelService');
const { initDatabase, insertEnquiry, getAllEnquiries, isCloudDatabase } = require('./dbService');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_API_KEY = process.env.ADMIN_KEY || 'nextgen_admin_secure_key_2026';

// Initialize database schema (PostgreSQL if DATABASE_URL is set, or local SQLite)
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}
ensureDb().catch(err => console.error('Database initialization error:', err));

// Middlewares
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Serve static frontend files (never exposes .xlsx or database)
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiting to prevent spam / accidental duplicate clicks
const submissionHistory = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of submissionHistory.entries()) {
    if (now - timestamp > 60000) {
      submissionHistory.delete(key);
    }
  }
}, 60000);

// Helper to sanitize strings and limit lengths
function cleanString(val, maxLen = 2000) {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

// Generate formatted human-readable timestamp
function getFormattedDateTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

// API endpoint to submit enquiry
app.post('/api/enquiries', async (req, res) => {
  try {
    const body = req.body || {};

    // 1. Validate Required Fields
    const studentName = cleanString(body.student_name, 120);
    const whatsappNumber = cleanString(body.whatsapp_number, 30);
    const collegeName = cleanString(body.college_name, 200);
    const department = cleanString(body.department, 150);
    const academicYear = cleanString(body.academic_year, 50);
    const projectType = cleanString(body.project_type, 100);

    const errors = {};

    if (!studentName) {
      errors.student_name = 'Student Name is required.';
    } else if (studentName.length < 2) {
      errors.student_name = 'Please enter a valid full name.';
    }

    if (!whatsappNumber) {
      errors.whatsapp_number = 'WhatsApp Number is required.';
    } else {
      const digitsOnly = whatsappNumber.replace(/\D/g, '');
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        errors.whatsapp_number = 'Please enter a valid WhatsApp number (8–15 digits).';
      }
    }

    if (!collegeName) {
      errors.college_name = 'College Name is required.';
    }

    if (!department) {
      errors.department = 'Department is required.';
    }

    if (!academicYear) {
      errors.academic_year = 'Academic Year is required.';
    }

    if (!projectType) {
      errors.project_type = 'Project Type is required.';
    }

    // Email format validation if provided
    const emailAddress = cleanString(body.email_address, 150);
    if (emailAddress) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailAddress)) {
        errors.email_address = 'Please provide a valid email address or leave it blank.';
      }
    }

    // Conditional "Other" validations
    const academicYearOther = academicYear === 'Other' ? cleanString(body.academic_year_other, 100) : null;
    if (academicYear === 'Other' && !academicYearOther) {
      errors.academic_year_other = 'Please specify your academic year.';
    }

    const projectTypeOther = projectType === 'Other' ? cleanString(body.project_type_other, 150) : null;
    if (projectType === 'Other' && !projectTypeOther) {
      errors.project_type_other = 'Please specify your project type.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please resolve the highlighted validation errors.',
        errors
      });
    }

    // Convert multi-select domains to clean comma-separated text
    let projectDomainsList = [];
    if (Array.isArray(body.project_domains)) {
      projectDomainsList = body.project_domains.filter(d => typeof d === 'string' && d.trim().length > 0);
    } else if (typeof body.project_domains === 'string' && body.project_domains.trim()) {
      projectDomainsList = [body.project_domains.trim()];
    }
    const projectDomainOther = cleanString(body.project_domain_other, 200);
    if (projectDomainsList.includes('Other') && projectDomainOther) {
      // Append other text
      projectDomainsList = projectDomainsList.map(d => d === 'Other' ? `Other (${projectDomainOther})` : d);
    }
    const projectDomainReadable = projectDomainsList.join(', ');

    // Convert multi-select assistance to clean comma-separated text
    let requiredAssistanceList = [];
    if (Array.isArray(body.required_assistance)) {
      requiredAssistanceList = body.required_assistance.filter(a => typeof a === 'string' && a.trim().length > 0);
    } else if (typeof body.required_assistance === 'string' && body.required_assistance.trim()) {
      requiredAssistanceList = [body.required_assistance.trim()];
    }
    const requiredAssistanceReadable = requiredAssistanceList.join(', ');

    const projectRequirements = cleanString(body.project_requirements, 5000);
    const preferredTechnologies = cleanString(body.preferred_technologies, 500);
    const collegeGuidelines = cleanString(body.college_guidelines, 5000);
    const budgetPreference = cleanString(body.budget_preference, 100);
    const specificBudgetAmount = budgetPreference === 'Have a specific budget' ? cleanString(body.specific_budget_amount, 50) : null;
    const additionalRequirements = cleanString(body.additional_requirements, 3000);

    // Rate Limiting check
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `${clientIp}_${whatsappNumber}`;
    const lastSub = submissionHistory.get(rateLimitKey);
    const now = Date.now();
    if (lastSub && (now - lastSub) < 6000) { // 6 seconds debounce
      return res.status(429).json({
        success: false,
        message: 'You have just submitted an enquiry. Please wait a few seconds before trying again.'
      });
    }

    const userAgent = cleanString(req.headers['user-agent'] || '', 300);

    // Effective Academic Year & Project Type labels
    const displayAcademicYear = academicYear === 'Other' && academicYearOther ? `Other (${academicYearOther})` : academicYear;
    const displayProjectType = projectType === 'Other' && projectTypeOther ? `Other (${projectTypeOther})` : projectType;

    // Generate Unique Enquiry ID: NGC-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniqueEnquiryCode = `NGC-${datePrefix}-${randomSuffix}`;
    const submissionTimestamp = getFormattedDateTime();

    // 1. Write to Excel file FIRST
    const excelPayload = {
      enquiry_id: uniqueEnquiryCode,
      submission_time: submissionTimestamp,
      student_name: studentName,
      whatsapp_number: whatsappNumber,
      email_address: emailAddress || '',
      college_name: collegeName,
      department: department,
      academic_year: displayAcademicYear,
      project_type: displayProjectType,
      project_domain: projectDomainReadable,
      project_requirements: projectRequirements || '',
      preferred_technologies: preferredTechnologies || '',
      college_guidelines: collegeGuidelines || '',
      budget_preference: budgetPreference || '',
      specific_budget_amount: specificBudgetAmount || '',
      required_assistance: requiredAssistanceReadable,
      additional_requirements: additionalRequirements || '',
      enquiry_status: 'New'
    };

    // 1. In local mode or if filesystem is writable, append to local Excel file
    try {
      await appendEnquiryToExcel(excelPayload);
    } catch (excelErr) {
      console.warn('Local Excel file write note (expected in read-only serverless):', excelErr.message);
    }

    // 2. Persist to database (Cloud PostgreSQL or SQLite)
    await ensureDb();
    const recordId = await insertEnquiry({
      enquiry_code: uniqueEnquiryCode,
      student_name: studentName,
      whatsapp_number: whatsappNumber,
      email_address: emailAddress,
      college_name: collegeName,
      department: department,
      academic_year: academicYear,
      academic_year_other: academicYearOther,
      project_type: projectType,
      project_type_other: projectTypeOther,
      project_domains: JSON.stringify(projectDomainsList),
      project_domain_other: projectDomainOther,
      project_requirements: projectRequirements,
      preferred_technologies: preferredTechnologies,
      college_guidelines: collegeGuidelines,
      budget_preference: budgetPreference,
      specific_budget_amount: specificBudgetAmount,
      required_assistance: JSON.stringify(requiredAssistanceList),
      additional_requirements: additionalRequirements,
      enquiry_status: 'New',
      ip_address: clientIp,
      user_agent: userAgent
    });

    submissionHistory.set(rateLimitKey, now);

    return res.status(201).json({
      success: true,
      message: 'Your project enquiry has been submitted successfully.',
      enquiryId: uniqueEnquiryCode,
      recordId: recordId
    });

  } catch (err) {
    console.error('Server error submitting enquiry:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while saving your enquiry to the Excel record. Please try again or message us on WhatsApp.'
    });
  }
});

// Secure Admin Export of the Excel file (Streaming dynamically from persistent records or file)
app.get('/api/admin/export-excel', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || req.query.key;
    if (!authHeader || authHeader !== ADMIN_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Admin key required to export enquiries.'
      });
    }

    await ensureDb();
    const records = await getAllEnquiries();

    if (records.length === 0 && !fs.existsSync(EXCEL_FILE_PATH)) {
      return res.status(404).json({
        success: false,
        message: 'No enquiries found yet in persistent storage.'
      });
    }

    // Build fresh formatted Excel workbook buffer from persistent database records
    const buffer = await buildWorkbookFromEnquiries(records);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="NextGen_Codes_Student_Enquiries.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error generating Excel export:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to export enquiries workbook.'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'NextGen Codes Project Enquiry API',
    databaseMode: isCloudDatabase() ? 'PostgreSQL (Cloud Persistent)' : 'SQLite (Local Persistent)',
    excelExport: 'Active (On-Demand & File Synchronized)',
    timestamp: new Date().toISOString()
  });
});

// Catch-all for SPA landing page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only start standalone listener if not imported as a Vercel serverless function module
if (process.env.VERCEL !== '1' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`NextGen Codes Enquiry server running on http://localhost:${PORT}`);
    console.log(`Excel file target: ${EXCEL_FILE_PATH}`);
  });
}

module.exports = app;

