/**
 * Analysis prompt — returns strict JSON.
 * The LLM must compare the CV against the job description and identify gaps.
 */
const ANALYSIS_PROMPT = `Analyze this CV against the job description below.

CV:
"""
{{CV}}
"""

Job Description:
"""
{{JOB}}
"""

Return a JSON object with exactly this structure:
{
  "matchScore": <number 0-100>,
  "summary": "<one sentence overall assessment>",
  "matchingSkills": ["skill1", "skill2", ...],
  "missingSkills": ["skill1", "skill2", ...],
  "strengths": ["<specific strength from CV relevant to this job>", ...],
  "improvements": ["<specific, actionable suggestion to improve the CV for this role>", ...],
  "keywordsToAdd": ["keyword1", "keyword2", ...]
}

Guidelines:
- matchingSkills: skills/technologies present in BOTH the CV and job description
- missingSkills: skills explicitly required or strongly preferred in the job description but absent from the CV
- strengths: 2-4 concrete observations, referencing specific parts of the CV
- improvements: 2-4 concrete suggestions (e.g., "Add a bullet about X", "Quantify Y")
- keywordsToAdd: exact terms from the job description that should appear in the CV
- matchScore: honest 0-100 assessment of fit based on skills overlap
- Be specific. Do not pad with generic advice.`;

/**
 * Cover letter prompt — returns plain prose.
 * Must not fabricate experience.
 */
const COVER_LETTER_PROMPT = `Write a tailored cover letter for this job application.

Candidate CV:
"""
{{CV}}
"""

Job Description:
"""
{{JOB}}
"""

Requirements:
- Address the letter to the hiring manager (use "Dear Hiring Manager" if no name is given).
- Open with a specific hook about the company or role — not "I am writing to apply".
- Highlight 2-3 concrete experiences from the CV that directly match the job's needs.
- Acknowledge one gap honestly and explain how the candidate would address it.
- Keep it under 350 words.
- Close with a clear call to action.
- Tone: professional, confident, direct. No clichés ("team player", "passionate", "go-getter").
- Do NOT invent experience, skills, or achievements not present in the CV.`;

/**
 * Improve resume prompt — returns a rewritten CV.
 * Must preserve all factual information.
 */
const IMPROVE_RESUME_PROMPT = `Rewrite this CV to better match the job description.

Original CV:
"""
{{CV}}
"""

Job Description:
"""
{{JOB}}
"""

Requirements:
- Keep all existing factual information (dates, companies, titles, education) unchanged.
- Incorporate missing skills and keywords from the job description ONLY if they can be reasonably inferred or the candidate likely has them based on adjacent experience.
- Do NOT invent employers, degrees, dates, or certifications.
- Reorganize bullet points to emphasize experience most relevant to this job.
- Use strong action verbs and quantify achievements where possible.
- Keep the same overall structure (sections: Summary, Experience, Education, Skills).
- Output clean plain text with clear section headers.
- Separate sections with blank lines. Use ALL CAPS for section headers (e.g., "PROFESSIONAL SUMMARY", "EXPERIENCE").

Return ONLY the improved CV text. No commentary, no markdown code blocks.`;

module.exports = {
  ANALYSIS_PROMPT,
  COVER_LETTER_PROMPT,
  IMPROVE_RESUME_PROMPT
};