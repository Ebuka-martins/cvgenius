const Groq = require('groq-sdk');
const {
  ANALYSIS_PROMPT,
  COVER_LETTER_PROMPT,
  IMPROVE_RESUME_PROMPT
} = require('./prompts');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Available on Groq's free and developer tiers
const MODEL = 'openai/gpt-oss-120b';

/**
 * Analyze CV against job description.
 * Returns structured JSON with missing skills, strengths, match score, etc.
 */
async function analyzeCV(cvText, jobDescription) {
  const prompt = ANALYSIS_PROMPT
    .replace('{{CV}}', cvText)
    .replace('{{JOB}}', jobDescription);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are an expert career advisor and ATS (Applicant Tracking System) analyst. You always respond with valid JSON only — no markdown, no commentary.'
      },
      { role: 'user', content: prompt }
    ],
    model: MODEL,
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Groq.');

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse Groq JSON:', raw);
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}

/**
 * Generate a tailored cover letter.
 * Returns plain text.
 */
async function generateCoverLetter(cvText, jobDescription) {
  const prompt = COVER_LETTER_PROMPT
    .replace('{{CV}}', cvText)
    .replace('{{JOB}}', jobDescription);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a professional cover letter writer. Write in a natural, confident, and specific tone. Avoid clichés and generic phrases. Never invent experience that is not in the CV.'
      },
      { role: 'user', content: prompt }
    ],
    model: MODEL,
    temperature: 0.7,
    max_tokens: 1200
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq.');

  return text.trim();
}

/**
 * Improve/rewrite the CV to better match a job description.
 * Returns plain text — the rewritten CV.
 */
async function improveResume(cvText, jobDescription) {
  const prompt = IMPROVE_RESUME_PROMPT
    .replace('{{CV}}', cvText)
    .replace('{{JOB}}', jobDescription);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are an expert resume writer. You never invent experience. You output only the improved resume text — no commentary, no markdown.'
      },
      { role: 'user', content: prompt }
    ],
    model: MODEL,
    temperature: 0.4,
    max_tokens: 3000
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq.');

  return text.trim();
}

module.exports = { analyzeCV, generateCoverLetter, improveResume };