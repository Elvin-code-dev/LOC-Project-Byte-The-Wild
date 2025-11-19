// Load env and modules
import dotenv from 'dotenv';
import mysql2 from 'mysql2';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, '../public/data/divisions.json');


// Create MySQL pool
const pool = mysql2.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

// Helpers
function toBool(v) { return v ? 1 : 0; }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

async function main() {
  console.log('Seeding database from divisions.json ...');

  // read file
  const raw = await fs.readFile(dataPath, 'utf-8');
  const divisions = JSON.parse(raw);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // clean tables
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.query('TRUNCATE TABLE payees');
    await conn.query('TRUNCATE TABLE programs');
    await conn.query('TRUNCATE TABLE divisions');
    await conn.query('SET FOREIGN_KEY_CHECKS=1');

    // insert rows
    for (const d of divisions) {
      const [divRes] = await conn.query(
        `INSERT INTO divisions
         (divisionName, deanName, chairName, penContact, locRep, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [d.divisionName || '', d.deanName || '', d.chairName || '',
         d.penContact || '', d.locRep || '', d.notes || '']
      );
      const divisionId = divRes.insertId;

      const programs = Array.isArray(d.programList) ? d.programList : [];
      for (const p of programs) {
        const [progRes] = await conn.query(
          `INSERT INTO programs
           (division_id, programName, notes, hasBeenPaid, reportSubmitted)
           VALUES (?, ?, ?, ?, ?)`,
          [
            divisionId,
            p?.programName || '',
            (p?.notes || d.notes || ''),
            toBool(p?.hasBeenPaid),
            toBool(p?.reportSubmitted)
          ]
        );
        const programId = progRes.insertId;

        const payees = Array.isArray(p?.payees) ? p.payees : [];
        for (const pe of payees) {
          await conn.query(
            `INSERT INTO payees (program_id, name, amount)
             VALUES (?, ?, ?)`,
            [programId, (pe?.name || '').trim(), toNum(pe?.amount)]
          );
        }
      }
    }

    await conn.commit();
    console.log('Seed complete.');
  } catch (err) {
    await conn.rollback();
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
