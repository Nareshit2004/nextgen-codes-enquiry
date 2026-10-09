const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pgPool = null;
let sqliteDb = null;

if (DATABASE_URL) {
  // Use PostgreSQL (e.g. Neon on Vercel)
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Local fallback: try node:sqlite or in-memory fallback
  try {
    const { DatabaseSync } = require('node:sqlite');
    const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'enquiries.db');
    sqliteDb = new DatabaseSync(DB_FILE);
  } catch (err) {
    console.warn('node:sqlite not available in this environment. Falling back to in-memory store:', err.message);
  }
}

// In-memory fallback if neither PG nor SQLite is available
const memoryEnquiries = [];


// Initialize tables
async function initDatabase() {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS enquiries (
          id SERIAL PRIMARY KEY,
          enquiry_code VARCHAR(64) UNIQUE,
          student_name VARCHAR(150) NOT NULL,
          whatsapp_number VARCHAR(50) NOT NULL,
          email_address VARCHAR(150),
          college_name VARCHAR(250) NOT NULL,
          department VARCHAR(150) NOT NULL,
          academic_year VARCHAR(100) NOT NULL,
          academic_year_other VARCHAR(100),
          project_type VARCHAR(150) NOT NULL,
          project_type_other VARCHAR(150),
          project_domains TEXT,
          project_domain_other VARCHAR(200),
          project_requirements TEXT,
          preferred_technologies TEXT,
          college_guidelines TEXT,
          budget_preference VARCHAR(100),
          specific_budget_amount VARCHAR(50),
          required_assistance TEXT,
          additional_requirements TEXT,
          enquiry_status VARCHAR(50) DEFAULT 'New',
          ip_address VARCHAR(64),
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at);
      `);
    } finally {
      client.release();
    }
  } else if (sqliteDb) {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enquiry_code TEXT UNIQUE,
        student_name TEXT NOT NULL,
        whatsapp_number TEXT NOT NULL,
        email_address TEXT,
        college_name TEXT NOT NULL,
        department TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        academic_year_other TEXT,
        project_type TEXT NOT NULL,
        project_type_other TEXT,
        project_domains TEXT,
        project_domain_other TEXT,
        project_requirements TEXT,
        preferred_technologies TEXT,
        college_guidelines TEXT,
        budget_preference TEXT,
        specific_budget_amount TEXT,
        required_assistance TEXT,
        additional_requirements TEXT,
        enquiry_status TEXT DEFAULT 'New',
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_created_at ON enquiries(created_at);
    `);
  }
}

// Insert an enquiry record into whichever database is active
async function insertEnquiry(record) {
  if (pgPool) {
    const query = `
      INSERT INTO enquiries (
        enquiry_code, student_name, whatsapp_number, email_address,
        college_name, department, academic_year, academic_year_other,
        project_type, project_type_other, project_domains, project_domain_other,
        project_requirements, preferred_technologies, college_guidelines,
        budget_preference, specific_budget_amount, required_assistance,
        additional_requirements, enquiry_status, ip_address, user_agent
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) RETURNING id;
    `;
    const values = [
      record.enquiry_code,
      record.student_name,
      record.whatsapp_number,
      record.email_address,
      record.college_name,
      record.department,
      record.academic_year,
      record.academic_year_other,
      record.project_type,
      record.project_type_other,
      record.project_domains,
      record.project_domain_other,
      record.project_requirements,
      record.preferred_technologies,
      record.college_guidelines,
      record.budget_preference,
      record.specific_budget_amount,
      record.required_assistance,
      record.additional_requirements,
      record.enquiry_status || 'New',
      record.ip_address,
      record.user_agent
    ];
    const res = await pgPool.query(query, values);
    return res.rows[0].id;
  } else if (sqliteDb) {
    const insertStmt = sqliteDb.prepare(`
      INSERT INTO enquiries (
        enquiry_code, student_name, whatsapp_number, email_address,
        college_name, department, academic_year, academic_year_other,
        project_type, project_type_other, project_domains, project_domain_other,
        project_requirements, preferred_technologies, college_guidelines,
        budget_preference, specific_budget_amount, required_assistance,
        additional_requirements, enquiry_status, ip_address, user_agent
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);
    const res = insertStmt.run(
      record.enquiry_code,
      record.student_name,
      record.whatsapp_number,
      record.email_address,
      record.college_name,
      record.department,
      record.academic_year,
      record.academic_year_other,
      record.project_type,
      record.project_type_other,
      record.project_domains,
      record.project_domain_other,
      record.project_requirements,
      record.preferred_technologies,
      record.college_guidelines,
      record.budget_preference,
      record.specific_budget_amount,
      record.required_assistance,
      record.additional_requirements,
      record.enquiry_status || 'New',
      record.ip_address,
      record.user_agent
    );
    return res.lastInsertRowid;
  } else {
    // Memory fallback
    const id = memoryEnquiries.length + 1;
    memoryEnquiries.push({
      id,
      ...record,
      created_at: new Date().toISOString()
    });
    return id;
  }
}

// Fetch all enquiry records (for generating Excel workbook on demand)
async function getAllEnquiries() {
  if (pgPool) {
    const res = await pgPool.query(`
      SELECT 
        enquiry_code,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as submission_time,
        student_name,
        whatsapp_number,
        email_address,
        college_name,
        department,
        academic_year,
        academic_year_other,
        project_type,
        project_type_other,
        project_domains,
        project_domain_other,
        project_requirements,
        preferred_technologies,
        college_guidelines,
        budget_preference,
        specific_budget_amount,
        required_assistance,
        additional_requirements,
        enquiry_status,
        created_at
      FROM enquiries 
      ORDER BY id ASC;
    `);
    return res.rows;
  } else if (sqliteDb) {
    const stmt = sqliteDb.prepare(`
      SELECT 
        enquiry_code,
        strftime('%Y-%m-%d %H:%M:%S', created_at) as submission_time,
        student_name,
        whatsapp_number,
        email_address,
        college_name,
        department,
        academic_year,
        academic_year_other,
        project_type,
        project_type_other,
        project_domains,
        project_domain_other,
        project_requirements,
        preferred_technologies,
        college_guidelines,
        budget_preference,
        specific_budget_amount,
        required_assistance,
        additional_requirements,
        enquiry_status,
        created_at
      FROM enquiries 
      ORDER BY id ASC;
    `);
    return stmt.all();
  }
  return memoryEnquiries.map(m => ({
    ...m,
    submission_time: new Date().toISOString().replace('T', ' ').slice(0, 19)
  }));
}

function isCloudDatabase() {
  return !!pgPool;
}

module.exports = {
  initDatabase,
  insertEnquiry,
  getAllEnquiries,
  isCloudDatabase
};
