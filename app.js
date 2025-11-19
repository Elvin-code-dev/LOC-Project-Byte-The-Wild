// app.js runs the backend server for the LOC dashboard
// it serves pages, handles API routes, and talks to MySQL

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'
import mysql2 from 'mysql2'
dotenv.config()

// make __dirname work in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// create express app
const app = express()
app.use(express.json())

// serve static files (public folder and fallback data)
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.static(path.join(__dirname, 'data')))

// create MySQL pool using values from env
export const pool = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise()

// test route used to check DB connection
app.get('/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS result')
    res.json(rows)
  } catch (error) {
    console.error('DB error:', error)
    res.status(500).send('Database error')
  }
})

// serve main dashboard page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'))
})

// serve version history page
app.get(['/history', '/history.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'history.html'))
})


// ----------------------------------------------------
// load complete division list with programs and payees
// ----------------------------------------------------
app.get('/api/divisions', async (req, res) => {
  try {
    const [divisions] = await pool.query('SELECT * FROM divisions')

    for (let d of divisions) {
      const [programs] = await pool.query(
        'SELECT * FROM programs WHERE division_id = ?',
        [d.id]
      )

      for (let p of programs) {
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
    if (!id) return res.status(400).json({ error: 'bad id' })

    const [divRows] = await pool.query(
      'SELECT * FROM divisions WHERE id=?',
      [id]
    )
    if (!divRows.length) return res.status(404).json({ error: 'not found' })

    const division = divRows[0]

    const [programs] = await pool.query(
      'SELECT * FROM programs WHERE division_id=?',
      [id]
    )

    for (const p of programs) {
      const [payees] = await pool.query(
        'SELECT * FROM payees WHERE program_id=?',
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


// ----------------------------------------------------
// save a division draft from the editor
// this creates a new submission record
// ----------------------------------------------------
app.post('/api/division-drafts', async (req, res) => {
  try {
    const draft = req.body
    console.log('Received division draft:', draft)

    const {
      divisionName,
      dean,
      chair,
      pen,
      loc,
      notes,
      programsData
    } = draft

    if (!divisionName) {
      return res.status(400).json({ error: 'divisionName required' })
    }

    // try to look up matching division id
    let divisionId = null
    try {
      const [rows] = await pool.query(
        'SELECT id FROM divisions WHERE divisionName = ? LIMIT 1',
        [divisionName]
      )
      if (rows.length) divisionId = rows[0].id
    } catch (e) {
      console.warn('Could not look up division id for', divisionName, e.message)
    }

    const programsJson = JSON.stringify(programsData || [])

    await pool.query(
      `INSERT INTO division_submissions
       (division_id, divisionName, dean, chair, pen, loc, notes, programs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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


// helper to unpack submission rows and compute totals
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

// find academic year based on July to June
function getAcademicYear(dateValue) {
  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = d.getMonth()
  const startYear = month >= 6 ? year : year - 1
  const endYear = startYear + 1
  return `${startYear}-${endYear}`
}


// ----------------------------------------------------
// recent submissions used in right panel
// ----------------------------------------------------
app.get('/api/submissions/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, division_id, divisionName, dean, chair, pen, loc, notes, programs_json, created_at
       FROM division_submissions
       ORDER BY created_at DESC
       LIMIT 5`
    )
    const items = rows.map(hydrateSubmission)
    res.json(items)
  } catch (err) {
    console.error('Error in /api/submissions/recent:', err)
    res.status(500).json({ error: 'server error' })
  }
})


// full submissions history for history page
app.get('/api/submissions', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500)

    const [rows] = await pool.query(
      `SELECT id, division_id, divisionName, dean, chair, pen, loc, notes, programs_json, created_at
       FROM division_submissions
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    )

    const items = rows.map(hydrateSubmission)
    res.json(items)
  } catch (err) {
    console.error('Error in /api/submissions:', err)
    res.status(500).json({ error: 'server error' })
  }
})


// ----------------------------------------------------
// archives summary used in bottom drawer
// groups by academic year and division
// ----------------------------------------------------
app.get('/api/archives/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, divisionName, dean, chair, created_at
       FROM division_submissions
       ORDER BY created_at DESC
       LIMIT 1000`
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

    const result = Array.from(buckets.values())
      .sort((a, b) => {
        if (a.year === b.year) {
          return a.divisionName.localeCompare(b.divisionName)
        }
        return a.year < b.year ? 1 : -1
      })

    res.json(result)
  } catch (err) {
    console.error('Error in /api/archives/summary:', err)
    res.status(500).json({ error: 'server error' })
  }
})


// final fallback for unknown routes
app.use((req, res) => {
  res.status(404).send('Page Not Found')
})

// start server on chosen port
const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`)
})
