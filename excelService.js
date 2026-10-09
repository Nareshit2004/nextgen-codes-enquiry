const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Storage location: server root (not in public/ static folder)
const EXCEL_FILE_PATH = process.env.EXCEL_PATH || path.join(__dirname, 'NextGen_Codes_Student_Enquiries.xlsx');
const SHEET_NAME = 'Student Enquiries';

// Columns in the exact specified order
const EXCEL_COLUMNS = [
  { header: 'Enquiry ID', key: 'enquiry_id', width: 16 },
  { header: 'Submission Date & Time', key: 'submission_time', width: 24 },
  { header: 'Student Name', key: 'student_name', width: 22 },
  { header: 'WhatsApp Number', key: 'whatsapp_number', width: 18 },
  { header: 'Email Address', key: 'email_address', width: 25 },
  { header: 'College Name', key: 'college_name', width: 28 },
  { header: 'Department', key: 'department', width: 26 },
  { header: 'Academic Year', key: 'academic_year', width: 18 },
  { header: 'Project Type', key: 'project_type', width: 24 },
  { header: 'Project Domain', key: 'project_domain', width: 32 },
  { header: 'Project Idea / Requirements', key: 'project_requirements', width: 38 },
  { header: 'Preferred Technologies', key: 'preferred_technologies', width: 28 },
  { header: 'College Rules / Do\'s and Don\'ts', key: 'college_guidelines', width: 35 },
  { header: 'Budget Preference', key: 'budget_preference', width: 24 },
  { header: 'Specific Budget (INR)', key: 'specific_budget_amount', width: 20 },
  { header: 'Required Assistance', key: 'required_assistance', width: 34 },
  { header: 'Additional Requirements', key: 'additional_requirements', width: 32 },
  { header: 'Enquiry Status', key: 'enquiry_status', width: 16 }
];

// Anti-formula injection sanitizer for spreadsheets
function sanitizeForExcel(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';
  // Check if string starts with formula trigger characters: =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    // Prefix with single quote to force Excel to treat as plain string literal
    return `'${str}`;
  }
  return str;
}

// Global write lock to serialize concurrent student submissions safely
let writeQueue = Promise.resolve();

function appendEnquiryToExcel(enquiryData) {
  // Chain through the serialized writeQueue to guarantee atomic reads & writes
  const currentTask = writeQueue.then(async () => {
    const workbook = new ExcelJS.Workbook();
    let worksheet;

    const fileExists = fs.existsSync(EXCEL_FILE_PATH);

    if (fileExists) {
      await workbook.xlsx.readFile(EXCEL_FILE_PATH);
      worksheet = workbook.getWorksheet(SHEET_NAME);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(SHEET_NAME);
      }
    } else {
      worksheet = workbook.addWorksheet(SHEET_NAME, {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
    }

    // Set or enforce columns schema
    worksheet.columns = EXCEL_COLUMNS;

    // Apply clean professional styling to header row (Row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // NextGen Navy #0f172a
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 28;

    // Prepare row values safely
    const newRow = worksheet.addRow({
      enquiry_id: sanitizeForExcel(enquiryData.enquiry_id),
      submission_time: sanitizeForExcel(enquiryData.submission_time),
      student_name: sanitizeForExcel(enquiryData.student_name),
      whatsapp_number: sanitizeForExcel(enquiryData.whatsapp_number),
      email_address: sanitizeForExcel(enquiryData.email_address),
      college_name: sanitizeForExcel(enquiryData.college_name),
      department: sanitizeForExcel(enquiryData.department),
      academic_year: sanitizeForExcel(enquiryData.academic_year),
      project_type: sanitizeForExcel(enquiryData.project_type),
      project_domain: sanitizeForExcel(enquiryData.project_domain),
      project_requirements: sanitizeForExcel(enquiryData.project_requirements),
      preferred_technologies: sanitizeForExcel(enquiryData.preferred_technologies),
      college_guidelines: sanitizeForExcel(enquiryData.college_guidelines),
      budget_preference: sanitizeForExcel(enquiryData.budget_preference),
      specific_budget_amount: sanitizeForExcel(enquiryData.specific_budget_amount),
      required_assistance: sanitizeForExcel(enquiryData.required_assistance),
      additional_requirements: sanitizeForExcel(enquiryData.additional_requirements),
      enquiry_status: sanitizeForExcel(enquiryData.enquiry_status || 'New')
    });

    // Style data row
    newRow.font = { name: 'Calibri', size: 10 };
    newRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Format specific cells
    const rowNum = newRow.number;
    // Zebra striping for readability
    if (rowNum % 2 === 0) {
      newRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
    }

    // Centered columns (ID, Date, Status, WhatsApp)
    newRow.getCell('enquiry_id').alignment = { vertical: 'middle', horizontal: 'center' };
    newRow.getCell('submission_time').alignment = { vertical: 'middle', horizontal: 'center' };
    newRow.getCell('enquiry_status').alignment = { vertical: 'middle', horizontal: 'center' };

    // Atomic file rewrite
    const tempFilePath = `${EXCEL_FILE_PATH}.tmp.${Date.now()}`;
    await workbook.xlsx.writeFile(tempFilePath);

    // Replace actual file atomically
    try {
      if (fs.existsSync(EXCEL_FILE_PATH)) {
        fs.unlinkSync(EXCEL_FILE_PATH);
      }
      fs.renameSync(tempFilePath, EXCEL_FILE_PATH);
    } catch (renameErr) {
      // Fallback copy if rename fails across partitions
      fs.copyFileSync(tempFilePath, EXCEL_FILE_PATH);
      fs.unlinkSync(tempFilePath);
    }

    return {
      success: true,
      filePath: EXCEL_FILE_PATH,
      rowNumber: rowNum
    };
  });

  // Catch errors in the queue chain so subsequent writes don't permanently fail
  writeQueue = currentTask.catch(err => {
    console.error('Excel queue write failure:', err);
  });

  return currentTask;
}

/**
 * Builds an ExcelJS Workbook in memory from an array of enquiry records.
 * Generates an Excel buffer with the exact columns, styling, and formulas sanitized.
 */
async function buildWorkbookFromEnquiries(records = []) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = EXCEL_COLUMNS;

  // Header styling (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;

  records.forEach((row, idx) => {
    const newRow = worksheet.addRow({
      enquiry_id: sanitizeForExcel(row.enquiry_id || row.enquiry_code),
      submission_time: sanitizeForExcel(row.submission_time || row.created_at),
      student_name: sanitizeForExcel(row.student_name),
      whatsapp_number: sanitizeForExcel(row.whatsapp_number),
      email_address: sanitizeForExcel(row.email_address),
      college_name: sanitizeForExcel(row.college_name),
      department: sanitizeForExcel(row.department),
      academic_year: sanitizeForExcel(row.academic_year),
      project_type: sanitizeForExcel(row.project_type),
      project_domain: sanitizeForExcel(row.project_domain || row.project_domains),
      project_requirements: sanitizeForExcel(row.project_requirements),
      preferred_technologies: sanitizeForExcel(row.preferred_technologies),
      college_guidelines: sanitizeForExcel(row.college_guidelines),
      budget_preference: sanitizeForExcel(row.budget_preference),
      specific_budget_amount: sanitizeForExcel(row.specific_budget_amount),
      required_assistance: sanitizeForExcel(row.required_assistance),
      additional_requirements: sanitizeForExcel(row.additional_requirements),
      enquiry_status: sanitizeForExcel(row.enquiry_status || 'New')
    });

    newRow.font = { name: 'Calibri', size: 10 };
    newRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    if (newRow.number % 2 === 0) {
      newRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
    }

    newRow.getCell('enquiry_id').alignment = { vertical: 'middle', horizontal: 'center' };
    newRow.getCell('submission_time').alignment = { vertical: 'middle', horizontal: 'center' };
    newRow.getCell('enquiry_status').alignment = { vertical: 'middle', horizontal: 'center' };
  });

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  EXCEL_FILE_PATH,
  SHEET_NAME,
  appendEnquiryToExcel,
  buildWorkbookFromEnquiries,
  sanitizeForExcel
};

