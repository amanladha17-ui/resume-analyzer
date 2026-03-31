const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { analyzeResume } = require('../utils/analyzer');
const { getDb, run, get, all } = require('../utils/db');

const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, TXT files are allowed'));
  }
});

async function extractText(filePath, originalname) {
  const ext = path.extname(originalname).toLowerCase();

  if (ext === '.pdf') {
    const buf = fs.readFileSync(filePath);
    try {
      // Try standard extraction first
      const data = await pdfParse(buf, {
        // Suppress font warnings
        verbosity: -1
      });
      const text = data.text || '';
      console.log(`PDF extracted: ${text.length} chars`);
      if (text.trim().length > 50) return text;

      // If extraction yielded nothing useful, try raw text mode
      console.warn('PDF standard extraction yielded little text, trying raw mode...');
      const raw = buf.toString('utf-8', 0, Math.min(buf.length, 50000));
      // Extract anything between BT and ET (PDF text markers)
      const btMatches = [...raw.matchAll(/BT([\s\S]*?)ET/g)].map(m => m[1]);
      const extracted = btMatches.join(' ').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
      if (extracted.length > 50) return extracted;

      return `[PDF text could not be extracted — the PDF may use embedded or image-based fonts. Please upload a DOCX version of your resume for best results. File: ${originalname}]`;
    } catch (err) {
      console.error('PDF parse error:', err.message);
      return '';
    }
  }

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  return fs.readFileSync(filePath, 'utf-8');
}

// POST /api/analyze
router.post('/analyze', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const text = await extractText(req.file.path, req.file.originalname);
    const ext = path.extname(req.file.originalname).toLowerCase();

    // For PDFs with extraction issues, warn but continue
    if (ext === '.pdf' && text.trim().length < 100) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Could not read text from this PDF. The PDF may use image-based or embedded fonts. Please upload your resume as a DOCX file instead — it will work perfectly.'
      });
    }

    const result = await analyzeResume(text);
    const id = uuidv4();
    await getDb();

    run(
      `INSERT INTO analyses (id,filename,raw_text,name,email,phone,skills,experience_years,education,summary,ats_score,strengths,weaknesses,suggestions,job_matches)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, req.file.originalname, text.substring(0, 5000),
        result.name, result.email, result.phone,
        JSON.stringify(result.skills), result.experience_years,
        result.education, result.summary, result.ats_score,
        JSON.stringify(result.strengths), JSON.stringify(result.weaknesses),
        JSON.stringify(result.suggestions), JSON.stringify(result.job_matches)
      ]
    );

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({ id, ...result });

  } catch (err) {
    console.error('Analysis error:', err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

router.get('/analyses', async (req, res) => {
  await getDb();
  res.json(all('SELECT id,filename,name,ats_score,experience_years,created_at FROM analyses ORDER BY created_at DESC LIMIT 20'));
});

router.get('/analyses/:id', async (req, res) => {
  await getDb();
  const row = get('SELECT * FROM analyses WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.skills = JSON.parse(row.skills || '[]');
  row.strengths = JSON.parse(row.strengths || '[]');
  row.weaknesses = JSON.parse(row.weaknesses || '[]');
  row.suggestions = JSON.parse(row.suggestions || '[]');
  row.job_matches = JSON.parse(row.job_matches || '[]');
  res.json(row);
});

router.delete('/analyses/:id', async (req, res) => {
  await getDb();
  run('DELETE FROM analyses WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
