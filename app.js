// app.js
// -----------------------------------------------------------------------------
// Backend server for the LOC dashboard.
//
// - Serves the main pages (Dashboard, History, Schedule)
// - Exposes API routes for divisions, submissions, archives, years, and schedule
// - Connects to MySQL using a connection pool
// -----------------------------------------------------------------------------

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'
import mysql2 from 'mysql2'
dotenv.config()

// -----------------------------------------------------------------------------
// Basic Express setup
// -----------------------------------------------------------------------------

// make __dirname work in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// create express app
const app = express()
app.use(express.json())

// serve static files (public assets and JSON seed data)
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.static(path.join(__dirname, 'data')))

// -----------------------------------------------------------------------------
// MySQL connection pool
// -----------------------------------------------------------------------------

// create MySQL pool using values from .env
export const pool = mysql2
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
  .promise()

// small test route to confirm DB connectivity
app.get('/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS result')
    res.json(rows)
  } catch (error) {
    console.error('DB error:', error)
    res.status(500).send('Database error')
  }
})

// -----------------------------------------------------------------------------
// Page routes (HTML)
// -----------------------------------------------------------------------------

// main dashboard page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'))
})

// version history page
app.get(['/history', '/history.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'history.html'))
})

// schedule page
app.get('/schedule', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'schedule.html'))
})

// -----------------------------------------------------------------------------
// Division APIs
// - full list of divisions with programs + payees
// - single division with programs + payees
// - saving division drafts (submissions)
// -----------------------------------------------------------------------------

// load complete division list with nested programs and payees
app.get('/api/divisions', async (req, res) => {
  try {
    const [divisions] = await pool.query('SELECT * FROM divisions')

    for (const d of divisions) {
      // load programs under this division
      const [programs] = await pool.query(
        'SELECT * FROM programs WHERE division_id = ?',
        [d.id]
      )

      // attach payees for each program
      for (const p of programs) {
        const [payees] = await pool.query(
          'SELECT * FROM payees WHERE program_id = ?',
          [p.id]
        )
        p.payees = payees
      }

      d.programList = programs
    }

    res.json(divisions)
  } catch (error) {
    console.error('API /api/divisions error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// load a single division with its programs and payees
app.get('/api/divisions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) {
      return res.status(400).json({
        error: "The selected division is not valid. Please choose again."
      });
    }


    const [divRows] = await pool.query(
      'SELECT * FROM divisions WHERE id = ?',
      [id]
    )
    if (!divRows.length) return res.status(404).json({ error: 'not found' })

    const division = divRows[0]

    const [programs] = await pool.query(
      'SELECT * FROM programs WHERE division_id = ?',
      [id]
    )

    for (const p of programs) {
      const [payees] = await pool.query(
        'SELECT * FROM payees WHERE program_id = ?',
        [p.id]
      )
      p.payees = payees
    }

    division.programList = programs

    res.json(division)
  } catch (e) {
    console.error('API /api/divisions/:id error:', e)
    res.status(500).json({ error: 'server error' })
  }
})

// save a division draft from the editor as a new submission record
app.post('/api/division-drafts', async (req, res) => {
  try {
    const draft = req.body
    console.log('Received division draft:', draft)

    const { divisionName, dean, chair, pen, loc, notes, programsData } = draft

    if (!divisionName) {
      return res.status(400).json({ error: 'divisionName required' })
    }

    // try to look up matching division id (optional, good when it exists)
    let divisionId = null
    try {
      const [rows] = await pool.query(
        'SELECT id FROM divisions WHERE divisionName = ? LIMIT 1',
        [divisionName]
      )
      if (rows.length) divisionId = rows[0].id
    } catch (e) {
      console.warn(
        'Could not look up division id for',
        divisionName,
        e.message
      )
    }

    const programsJson = JSON.stringify(programsData || [])

    await pool.query(
      `
      INSERT INTO division_submissions
        (division_id, divisionName, dean, chair, pen, loc, notes, programs_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        divisionId,
        divisionName || '',
        dean || '',
        chair || '',
        pen || '',
        loc || '',
        notes || '',
        programsJson
      ]
    )

    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('Error saving division draft:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// -----------------------------------------------------------------------------
// Helpers for submissions / archives
// -----------------------------------------------------------------------------

// turn one DB submission row into a richer object with totals
function hydrateSubmission(row) {
  let programs = []
  try {
    programs = row.programs_json ? JSON.parse(row.programs_json) : []
  } catch {
    programs = []
  }

  let programCount = 0
  let payeeCount = 0
  let totalAmount = 0

  if (Array.isArray(programs)) {
    programCount = programs.length

    programs.forEach(p => {
      const payees = Array.isArray(p?.payees) ? p.payees : []
      payeeCount += payees.length

      payees.forEach(pe => {
        totalAmount += Number(pe.amount) || 0
      })
    })
  }

  return {
    id: row.id,
    division_id: row.division_id,
    divisionName: row.divisionName,
    dean: row.dean,
    chair: row.chair,
    pen: row.pen,
    loc: row.loc,
    notes: row.notes,
    programs,
    programCount,
    payeeCount,
    totalAmount,
    created_at: row.created_at
  }
}

// compute academic year label (e.g. "2024-2025") from a date
// year runs from July to June
function getAcademicYear(dateValue) {
  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return null

  const year = d.getFullYear()
  const month = d.getMonth() // 0 = Jan, 6 = July

  const startYear = month >= 6 ? year : year - 1
  const endYear = startYear + 1

  return `${startYear}-${endYear}`
}

// -----------------------------------------------------------------------------
// Submissions APIs
// - recent submissions (right panel)
// - full history (History page)
// - archives summary (bottom drawer)
// -----------------------------------------------------------------------------

// last 30 submissions for the right-hand "Recent Activity" panel
app.get('/api/submissions/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, division_id, divisionName, dean, chair, pen, loc, notes,
             programs_json, created_at
      FROM division_submissions
      ORDER BY created_at DESC
      LIMIT 30
      `
    )

    const items = rows.map(hydrateSubmission)
    res.json(items)
  } catch (err) {
    console.error('Error in /api/submissions/recent:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// full submissions history for the History page
app.get('/api/submissions', async (req, res) => {
  try {
    // allow caller to choose a limit, but cap it for safety
    const limit = Math.min(Number(req.query.limit) || 200, 500)

    const [rows] = await pool.query(
      `
      SELECT id, division_id, divisionName, dean, chair, pen, loc, notes,
             programs_json, created_at
      FROM division_submissions
      ORDER BY created_at DESC
      LIMIT ?
      `,
      [limit]
    )

    const items = rows.map(hydrateSubmission)
    res.json(items)
  } catch (err) {
    console.error('Error in /api/submissions:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// archives summary grouped by academic year and division
// used in the bottom drawer of the dashboard
app.get('/api/archives/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, divisionName, dean, chair, created_at
      FROM division_submissions
      ORDER BY created_at DESC
      LIMIT 1000
      `
    )

    const buckets = new Map()

    for (const row of rows) {
      const year = getAcademicYear(row.created_at)
      if (!year) continue

      const divisionName = row.divisionName || 'Unknown'
      const key = `${year}||${divisionName}`

      const existing = buckets.get(key)

      if (!existing) {
        buckets.set(key, {
          year,
          divisionName,
          dean: row.dean || '',
          chair: row.chair || '',
          changes: 1
        })
      } else {
        existing.changes += 1
      }
    }

    const result = Array.from(buckets.values()).sort((a, b) => {
      if (a.year === b.year) {
        return a.divisionName.localeCompare(b.divisionName)
      }
      // newer years first
      return a.year < b.year ? 1 : -1
    })

    res.json(result)
  } catch (err) {
    console.error('Error in /api/archives/summary:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// -----------------------------------------------------------------------------
// Academic years API
// - list years
// - add a new year
// - set current year
// - delete a non-current year
// -----------------------------------------------------------------------------

// list all academic years
app.get('/api/years', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM academic_years ORDER BY start_date IS NULL, start_date, id'
    )
    res.json(rows)
  } catch (err) {
    console.error('/api/years error:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// create the next academic year label (e.g. 2024-2025 -> 2025-2026)
app.post('/api/years', async (req, res) => {
  try {
    // get last label so we can increment
    const [rows] = await pool.query(
      'SELECT label FROM academic_years ORDER BY id DESC LIMIT 1'
    )

    let nextLabel = '2024-2025'

    if (rows.length > 0) {
      const last = rows[0].label || ''
      const parts = last.split('-').map(p => parseInt(p, 10))

      if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
      ) {
        const s = parts[0] + 1
        const e = parts[1] + 1
        nextLabel = `${s}-${e}`
      }
    }

    const [ins] = await pool.query(
      'INSERT INTO academic_years (label) VALUES (?)',
      [nextLabel]
    )

    const [created] = await pool.query(
      'SELECT * FROM academic_years WHERE id = ?',
      [ins.insertId]
    )

    res.status(201).json(created[0])
  } catch (err) {
    console.error('POST /api/years error:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// update a year (mainly used to set which year is current)
app.patch('/api/years/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: "We couldn’t load the selected year. Please try again." })

    const { is_current } = req.body ?? {}
    const flag = is_current ? 1 : 0

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // only one year can be current at a time
      if (flag === 1) {
        await conn.query('UPDATE academic_years SET is_current = 0')
      }

      await conn.query(
        'UPDATE academic_years SET is_current = ? WHERE id = ?',
        [flag, id]
      )

      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }

    const [rows] = await pool.query(
      'SELECT * FROM academic_years WHERE id = ?',
      [id]
    )

    res.json(rows[0])
  } catch (err) {
    console.error('PATCH /api/years/:id error:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// delete a year (only allowed if it is not the current year)
app.delete('/api/years/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) {
    return res.status(400).json({
      error: "The selected year is not valid. Please choose again."
    });
}


    const [rows] = await pool.query(
      'SELECT * FROM academic_years WHERE id = ?',
      [id]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'year not found' })
    }

    const year = rows[0]
    if (year.is_current) {
      return res
        .status(400)
        .json({ error: 'cannot delete the current academic year' })
    }

    // program_schedule has FK with ON DELETE CASCADE
    await pool.query('DELETE FROM academic_years WHERE id = ?', [id])

    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/years/:id error:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// -----------------------------------------------------------------------------
// Program schedule API
// - get schedule rows for a year or current year
// - toggle selected / not selected for one program in one year
// -----------------------------------------------------------------------------

// GET /api/schedule
// GET /api/schedule?yearId=3
// GET /api/schedule?current=true
app.get('/api/schedule', async (req, res) => {
  try {
    const { yearId, current } = req.query

    let where = ''
    const params = []

    if (current === 'true') {
      where = 'WHERE ay.is_current = 1'
    } else if (yearId) {
      where = 'WHERE ps.academic_year_id = ?'
      params.push(Number(yearId))
    }

    const [rows] = await pool.query(
      `
      SELECT
        ps.*,
        ay.label AS year_label,
        ay.is_current,
        p.programName AS program_name_live,
        d.divisionName AS division_name_live
      FROM program_schedule ps
        JOIN academic_years ay
          ON ps.academic_year_id = ay.id
        LEFT JOIN programs p
          ON ps.program_id = p.id
        LEFT JOIN divisions d
          ON p.division_id = d.id
      ${where}
      ORDER BY ay.id, ps.id
      `,
      params
    )

    res.json(rows)
  } catch (err) {
    console.error('GET /api/schedule error:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// toggle selected / not selected for one program in one academic year
app.post('/api/schedule', async (req, res) => {
  try {
    const { academic_year_id, program_id, is_selected } = req.body || {}

    const yearId = Number(academic_year_id)
    const progId = Number(program_id)
    const flag = is_selected ? 1 : 0

    if (!yearId || !progId) {
      return res.status(400).json({ error: 'missing year or program' })
    }

    // get program + division names for snapshot columns
    const [progRows] = await pool.query(
      `
      SELECT
        p.id,
        p.programName AS program_name,
        d.divisionName AS division_name
      FROM programs p
      JOIN divisions d
        ON p.division_id = d.id
      WHERE p.id = ?
      `,
      [progId]
    )

    if (progRows.length === 0) {
      return res.status(404).json({ error: 'program not found' })
    }

    const prog = progRows[0]
    const snapProgram = prog.program_name || ''
    const snapDivision = prog.division_name || ''

    // see if a row already exists for this year + program
    const [existing] = await pool.query(
      `
      SELECT * FROM program_schedule
      WHERE academic_year_id = ? AND program_id = ?
      `,
      [yearId, progId]
    )

    if (existing.length === 0) {
      // create new row
      const [ins] = await pool.query(
        `
        INSERT INTO program_schedule
          (academic_year_id, program_id, is_selected,
           program_name_snapshot, division_name_snapshot)
        VALUES (?, ?, ?, ?, ?)
        `,
        [yearId, progId, flag, snapProgram, snapDivision]
      )

      const [created] = await pool.query(
        'SELECT * FROM program_schedule WHERE id = ?',
        [ins.insertId]
      )

      return res.status(201).json(created[0])
    } else {
      // update existing row
      const row = existing[0]

      await pool.query(
        `
        UPDATE program_schedule
        SET is_selected = ?,
            program_name_snapshot = ?,
            division_name_snapshot = ?
        WHERE id = ?
        `,
        [flag, snapProgram, snapDivision, row.id]
      )

      const [updated] = await pool.query(
        'SELECT * FROM program_schedule WHERE id = ?',
        [row.id]
      )

      return res.json(updated[0])
    }
  } catch (err) {
    console.error('POST /api/schedule error:', err)
    res.status(500).json({ error: 'server error' })
  }
})

// -----------------------------------------------------------------------------
// Fallback + server start
// -----------------------------------------------------------------------------

// final fallback for unknown routes
app.use((req, res) => {
  res.status(404).send('Page Not Found')
})

// start server on chosen port
const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`)
})
