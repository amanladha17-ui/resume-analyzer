// Resume Analyzer — Gemini AI powered (gemini-2.5-flash)

const { GoogleGenerativeAI } = require('@google/generative-ai');

const SKILL_KEYWORDS = {
  programming: ['javascript','python','java','c++','c#','typescript','go','rust','kotlin','swift','php','ruby','scala','r','matlab'],
  frontend: ['react','vue','angular','html','css','sass','tailwind','nextjs','redux','webpack','figma','react.js'],
  backend: ['node','express','django','flask','fastapi','spring','laravel','graphql','rest','api','node.js','express.js'],
  database: ['sql','mysql','postgresql','mongodb','redis','sqlite','oracle','firebase','dynamodb'],
  cloud: ['aws','azure','gcp','docker','kubernetes','terraform','jenkins','heroku','vercel'],
  ml: ['machine learning','deep learning','tensorflow','pytorch','scikit-learn','llm','gemini','openai','pandas','numpy'],
  tools: ['git','github','linux','agile','scrum','jira','figma','postman','vs code','bash']
};

const JOB_ROLES = [
  { title: 'Frontend Developer',   requiredSkills: ['react','javascript','html','css','typescript'] },
  { title: 'Backend Developer',    requiredSkills: ['node','python','java','sql','api'] },
  { title: 'Full Stack Developer', requiredSkills: ['react','node','javascript','sql','git'] },
  { title: 'Data Scientist',       requiredSkills: ['python','machine learning','pandas','numpy','sql'] },
  { title: 'ML Engineer',          requiredSkills: ['python','tensorflow','pytorch','machine learning','gemini'] },
  { title: 'DevOps Engineer',      requiredSkills: ['docker','kubernetes','aws','linux','git'] },
  { title: 'Software Engineer',    requiredSkills: ['git','api','sql','java','python'] },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
function extractEmail(text) {
  const m = text.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}
function extractPhone(text) {
  const m = text.match(/(\+?\d[\d\s\-().]{8,14}\d)/);
  return m ? m[1].trim() : null;
}
function extractLinkedIn(text) {
  const m = text.match(/linkedin\.com\/in\/([\w\-]+)/i);
  return m ? { full: m[0], slug: m[1] } : null;
}
function extractGitHub(text) {
  const m = text.match(/github\.com\/([\w\-]+)/i);
  return m ? { full: m[0], username: m[1] } : null;
}
function extractSkillsLocally(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const kws of Object.values(SKILL_KEYWORDS))
    for (const kw of kws) if (lower.includes(kw)) found.add(kw);
  return [...found];
}
function extractNameLocally(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line.length > 2 && line.length < 50 && /^[A-Z][a-zA-Z\s.'-]+$/.test(line) && !line.includes('@') && !/\d/.test(line))
      return line;
  }
  return null;
}
function extractExpLocally(text) {
  const m = text.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|work)/i);
  if (m) return parseInt(m[1]);
  const ranges = [...text.matchAll(/(\d{4})\s*[-–]\s*(present|current|\d{4})/gi)];
  return ranges.length ? Math.min(ranges.length * 2, 12) : 1;
}
function extractEduLocally(text) {
  const degrees = ['phd','ph.d','doctorate','master','msc','mba','bachelor','bsc','b.tech','m.tech','b.e','m.e','bca','mca'];
  const lower = text.toLowerCase();
  for (const deg of degrees) {
    if (lower.includes(deg)) {
      const idx = lower.indexOf(deg);
      return text.substring(idx, idx + 80).split('\n')[0].trim();
    }
  }
  return 'Not specified';
}
function getSkillsByCategory(skills) {
  const result = {};
  for (const [cat, kws] of Object.entries(SKILL_KEYWORDS)) {
    const matched = skills.filter(s => kws.includes(s));
    if (matched.length) result[cat] = matched;
  }
  return result;
}
function getJobMatches(skills) {
  return JOB_ROLES.map(role => {
    const matched = role.requiredSkills.filter(s => skills.includes(s));
    const pct = Math.round((matched.length / role.requiredSkills.length) * 100);
    return { title: role.title, match: pct, matchedSkills: matched, missingSkills: role.requiredSkills.filter(s => !skills.includes(s)) };
  }).filter(r => r.match >= 20).sort((a, b) => b.match - a.match).slice(0, 5);
}
function checkIntegrity(text, name) {
  const issues = [], warnings = [];
  const linkedin = extractLinkedIn(text);
  const github = extractGitHub(text);
  if (name && linkedin) {
    const nameTokens = name.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(t => t.length > 1);
    const slug = linkedin.slug.toLowerCase();
    if (!nameTokens.some(t => slug.includes(t))) {
      const slugName = slug.replace(/-?\d+\w*$/,'').replace(/-/g,' ').trim();
      issues.push(`🚨 LinkedIn Mismatch: URL belongs to "${slugName}" but resume is for "${name}". Update immediately.`);
    }
  }
  if (!linkedin) issues.push('🚨 No LinkedIn URL found — add linkedin.com/in/yourprofile');
  if (linkedin && !github) warnings.push('💡 No GitHub link found — adding it boosts credibility for tech roles');
  return { issues, warnings, linkedin: linkedin?.full, github: github?.full };
}

// ── GEMINI AI ────────────────────────────────────────────────────────────────
async function analyzeWithGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured in .env file');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // gemini-2.5-flash — best free tier limits (1500 req/day, 15 req/min)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert resume analyzer and career coach. Analyze this resume carefully and return ONLY valid JSON with no markdown formatting, no code fences, no explanation.

Resume:
"""
${text.substring(0, 3500)}
"""

Return exactly this JSON structure:
{
  "name": "candidate full name from resume",
  "experience_years": <integer, estimate from dates or explicit mention, 0 if student>,
  "education": "degree and institution in one line",
  "ats_score": <integer 0-100: skills=30pts, contact info=20pts, formatting=20pts, experience=15pts, summary=15pts>,
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3", "actionable suggestion 4"],
  "skills": ["skill1", "skill2", "skill3"],
  "summary": "2 sentence professional summary of this specific candidate"
}

RULES:
- Be specific to THIS resume, not generic
- skills must be actual technologies mentioned in the resume
- Return ONLY the JSON object, nothing else, no backticks`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  return JSON.parse(raw);
}

// ── FALLBACK ─────────────────────────────────────────────────────────────────
function fallbackAnalyze(text, reason) {
  const skills = extractSkillsLocally(text);
  const expYears = extractExpLocally(text);
  let score = 30 + Math.min(skills.length * 3, 30);
  if (extractEmail(text)) score += 10;
  if (extractPhone(text)) score += 5;
  if (text.toLowerCase().includes('experience')) score += 5;
  if (text.toLowerCase().includes('education')) score += 5;
  if (text.toLowerCase().includes('project')) score += 5;

  const weaknesses = [];
  if (reason && reason.includes('429')) {
    weaknesses.push('⚠️ Gemini API rate limit reached — wait 1 minute and try again, or the free tier daily limit (1500 req/day) has been hit');
  } else if (reason && reason.includes('not configured')) {
    weaknesses.push('⚠️ Gemini API key not set — add GEMINI_API_KEY to your .env file for full AI analysis');
  } else {
    weaknesses.push('⚠️ Gemini AI unavailable — showing rule-based analysis');
  }

  return {
    name: extractNameLocally(text),
    experience_years: expYears,
    education: extractEduLocally(text),
    ats_score: Math.min(score, 85),
    strengths: [
      skills.length >= 8 ? `Strong technical skill set: ${skills.slice(0,4).join(', ')}` : 'Technical skills present',
      text.toLowerCase().includes('project') ? 'Projects section demonstrates practical experience' : 'Resume has relevant content',
      extractEmail(text) ? 'Contact information included' : 'Content is structured'
    ],
    weaknesses,
    suggestions: [
      'Add a professional summary at the top of your resume',
      'Quantify achievements with numbers (e.g. "improved performance by 40%")',
      'Add cloud skills (AWS/GCP/Azure) — highly valued in 2025',
      'Ensure LinkedIn and GitHub profile links are included'
    ],
    skills,
    summary: `Candidate with ${skills.length} detected technical skills and ${expYears} year(s) of experience. Running in fallback mode — add Gemini API key for full AI analysis.`
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function analyzeResume(text) {
  // If text is too short, PDF parsing likely failed
  if (!text || text.trim().length < 100) {
    console.warn('⚠️  Resume text too short — PDF may have unreadable fonts. Text length:', text?.length || 0);
    text = text || '';
  }

  let geminiResult;
  let usedFallback = false;

  try {
    geminiResult = await analyzeWithGemini(text);
    console.log('✅ Gemini AI analysis complete for:', geminiResult.name);
  } catch (err) {
    console.warn('⚠️  Gemini API error, using fallback analyzer:', err.message);
    geminiResult = fallbackAnalyze(text, err.message);
    usedFallback = true;
  }

  const name = geminiResult.name || extractNameLocally(text) || 'Candidate';
  const skills = (geminiResult.skills || []).map(s => s.toLowerCase()).filter(Boolean);
  const localSkills = extractSkillsLocally(text);
  // Merge Gemini skills with locally detected ones for better coverage
  const allSkills = [...new Set([...skills, ...localSkills])];

  const { issues, warnings, linkedin, github } = checkIntegrity(text, name);
  const atsScore = Math.max(15, Math.min(98, (geminiResult.ats_score || 50) - (issues.length * 15)));

  return {
    name,
    email: extractEmail(text),
    phone: extractPhone(text),
    linkedin,
    github,
    skills: allSkills,
    skillsByCategory: getSkillsByCategory(allSkills),
    experience_years: geminiResult.experience_years || extractExpLocally(text),
    education: geminiResult.education || extractEduLocally(text),
    ats_score: atsScore,
    integrity_issues: issues.length,
    used_fallback: usedFallback,
    strengths: geminiResult.strengths || [],
    weaknesses: [...issues, ...warnings, ...(geminiResult.weaknesses || [])],
    suggestions: geminiResult.suggestions || [],
    job_matches: getJobMatches(allSkills),
    summary: geminiResult.summary || ''
  };
}

module.exports = { analyzeResume };
