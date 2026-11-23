require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractText } = require('./cv-parser');
const { analyzeCV, generateCoverLetter, improveResume } = require('./groq-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Temp directory
const TEMP_DIR = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, DOC, and TXT files are allowed.'));
  }
});

// Static files
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'src')));
app.use('/icons', express.static(path.join(__dirname, '..', 'assets', 'icons')));

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'src', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ---------------------------------------------------------------------------
// POST /api/analyze
// Upload CV + job description → returns missing skills + match analysis
// ---------------------------------------------------------------------------
app.post('/api/analyze', upload.single('cv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a CV file.' });
  }

  const jobDescription = req.body.jobDescription;
  if (!jobDescription || jobDescription.trim().length < 20) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Please provide a job description (at least 20 characters).' });
  }

  try {
    const cvText = await extractText(req.file.path, req.file.originalname);

    if (!cvText || cvText.trim().length < 50) {
      throw new Error('Could not extract enough text from the CV. Please try a different file.');
    }

    const analysis = await analyzeCV(cvText, jobDescription);

    fs.unlinkSync(req.file.path);

    res.json({
      ok: true,
      cvText,
      cvPreview: cvText.slice(0, 500) + (cvText.length > 500 ? '…' : ''),
      analysis
    });

  } catch (err) {
    console.error('Analyze error:', err);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cover-letter
// ---------------------------------------------------------------------------
app.post('/api/cover-letter', async (req, res) => {
  const { cvText, jobDescription } = req.body;

  if (!cvText || cvText.trim().length < 50) {
    return res.status(400).json({ error: 'CV text is required.' });
  }
  if (!jobDescription || jobDescription.trim().length < 20) {
    return res.status(400).json({ error: 'Job description is required.' });
  }

  try {
    const coverLetter = await generateCoverLetter(cvText, jobDescription);
    res.json({ ok: true, coverLetter });
  } catch (err) {
    console.error('Cover letter error:', err);
    res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/improve-resume
// ---------------------------------------------------------------------------
app.post('/api/improve-resume', async (req, res) => {
  const { cvText, jobDescription } = req.body;

  if (!cvText || cvText.trim().length < 50) {
    return res.status(400).json({ error: 'CV text is required.' });
  }
  if (!jobDescription || jobDescription.trim().length < 20) {
    return res.status(400).json({ error: 'Job description is required.' });
  }

  try {
    const improvedResume = await improveResume(cvText, jobDescription);
    res.json({ ok: true, improvedResume });
  } catch (err) {
    console.error('Improve resume error:', err);
    res.status(500).json({ error: err.message || 'Improvement failed.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/download-resume
// ---------------------------------------------------------------------------
app.post('/api/download-resume', async (req, res) => {
  const { text, format } = req.body;
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (!['pdf', 'docx'].includes(format)) {
    return res.status(400).json({ error: 'Format must be "pdf" or "docx".' });
  }

  try {
    if (format === 'docx') {
      await sendDocx(res, text);
    } else {
      await sendPdf(res, text);
    }
  } catch (err) {
    console.error('Download error:', err);
    // Only send JSON if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download failed.' });
    } else {
      res.end();
    }
  }
});

// ---------------------------------------------------------------------------
// DOCX generation — using the `docx` library
// ---------------------------------------------------------------------------
async function sendDocx(res, text) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

  const lines = text.split('\n');
  const children = [];

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    const trimmed = line.trim();

    if (trimmed === '') {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    const isHeading = /^[A-Z][A-Z\s&/,.'-]{2,}$/.test(trimmed) && trimmed.length < 60;

    if (isHeading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: trimmed, bold: true, size: 28 })],
          spacing: { before: 240, after: 120 }
        })
      );
    } else if (/^[•\-\*]\s/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/^[•\-\*]\s+/, ''), size: 22 })],
          bullet: { level: 0 },
          spacing: { after: 80 }
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22 })],
          spacing: { after: 100 }
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } }
        },
        children
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="improved-resume.docx"');
  res.end(buffer, 'binary');
}

// ---------------------------------------------------------------------------
// PDF generation — Puppeteer renders HTML → PDF
// ---------------------------------------------------------------------------
async function sendPdf(res, text) {
  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm; }
  body {
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: inherit;
    font-size: inherit;
    margin: 0;
  }
</style>
</head>
<body>
<pre>${escapeHtml(text)}</pre>
</body>
</html>`;

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    throw new Error('PDF generation requires Puppeteer. Run: npm install puppeteer');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF as a Buffer (not Uint8Array)
    const pdfBuffer = Buffer.from(
      await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
      })
    );

    // CRITICAL: send as raw binary with complete headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Transfer-Encoding': 'binary',
      'Content-Disposition': 'attachment; filename="improved-resume.pdf"',
      'Cache-Control': 'no-store'
    });

    res.end(pdfBuffer, 'binary');

  } finally {
    await browser.close();
  }
}

// Start
app.listen(PORT, () => {
  console.log(`CVGenius running at http://localhost:${PORT}`);
  console.log(`Groq API key: ${process.env.GROQ_API_KEY ? '✓ Set' : '✗ NOT SET'}`);

  try {
    require.resolve('docx');
  } catch {
    console.warn('⚠️  "docx" not installed — DOCX downloads will fail. Run: npm install docx');
  }
  try {
    require.resolve('puppeteer');
  } catch {
    console.warn('⚠️  "puppeteer" not installed — PDF downloads will fail. Run: npm install puppeteer');
  }
});