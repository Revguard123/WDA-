// Claude-backed pieces of Slice 2: the disqualification pass and the one-line
// "why we picked this". Uses the official Anthropic SDK with structured outputs
// so the disqualification result is always valid JSON, never free text to parse
// by hand.
//
// Model: the disqualification pass is a high-volume classifier (one call per
// surviving candidate per buyer per batch), so it defaults to Claude Haiku for
// cost and speed. Override with ANTHROPIC_MODEL if you want a stronger model.
//
// Copy rule from the build spec: generated text must never use the long dash
// character. Both prompts instruct the model accordingly.

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

let cachedClient = null;
async function getAnthropic() {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY must be set');
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  cachedClient = new Anthropic();
  return cachedClient;
}

// The disqualification list, verbatim from Appendix A of the build spec.
const DISQUALIFICATION_LIST = `Disqualify the contract if any of these are true:
- The response deadline is too soon to prepare a real bid, or it is already closed or amended past its due date.
- It is reserved for a set-aside the buyer does not hold.
- It is a sources-sought notice or RFI (market research), not a live solicitation.
- The language signals a locked incumbent recompete, a named sole-source award, or a brand-name-only requirement.
- It requires a security clearance, license, or certification the buyer does not have.
- It demands specific prior federal past performance a new entrant cannot meet.
- It requires bid or performance bonding, or financial capacity, beyond the buyer's size.
- Its estimated value is clearly outside the buyer's stated size band.
- It requires manufacturing, products, or specialized capability outside the buyer's NAICS and keywords.
- Its place of performance is outside the area the buyer said they will service.
- It is gated behind a GWAC, schedule, or IDIQ vehicle the buyer is not on.
- A mandatory step, such as a required site visit, has already passed.`;

function buyerSummary(buyer = {}) {
  const lines = [
    `NAICS codes: ${(buyer.naics || []).join(', ') || 'none stated'}`,
    `Keywords / capabilities: ${(buyer.keywords || []).join(', ') || 'none stated'}`,
    `Set-asides held: ${(buyer.set_asides || []).join(', ') || 'none (full and open only)'}`,
    `Service area / state: ${buyer.state || 'not restricted'}`,
    `Size band: ${buyer.size_min != null ? `$${buyer.size_min}` : 'no floor'} to ${buyer.size_max != null ? `$${buyer.size_max}` : 'no ceiling'}`,
  ];
  return lines.join('\n');
}

function contractSummary(op = {}) {
  return [
    `Title: ${op.title || 'n/a'}`,
    `Agency: ${op.agency || 'n/a'}`,
    `NAICS: ${op.naics || 'n/a'}`,
    `Set-aside code: ${op.set_aside_type || '(full and open)'}`,
    `Place of performance: ${op.place_of_perf || 'n/a'}`,
    `Response deadline: ${op.response_deadline || 'n/a'}`,
    `Estimated value: ${op.est_value != null ? `$${op.est_value}` : 'not stated'}`,
    '',
    'Solicitation text:',
    (op.description || '(no description text available)').slice(0, 12000),
  ].join('\n');
}

const DISQUALIFY_SCHEMA = {
  type: 'object',
  properties: {
    disqualified: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['disqualified', 'reason'],
  additionalProperties: false,
};

// Ask Claude whether this contract should be disqualified for this buyer.
// Returns { disqualified: boolean, reason: string }. Defaults to disqualifying
// when the model is genuinely uncertain (per the spec).
export async function disqualifyContract(opportunity, buyer, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system =
    'You screen federal contract opportunities for a specific small-business buyer. ' +
    'You decide only whether a contract should be disqualified (dropped) for this buyer, ' +
    'using the disqualification list provided. Default to disqualifying when you are genuinely ' +
    'uncertain: it is better to drop a marginal contract than to send one that wastes the ' +
    "buyer's time. Do not use the long dash character in your reason. Keep the reason to one short sentence.";

  const userPrompt = [
    'BUYER PROFILE',
    buyerSummary(buyer),
    '',
    'DISQUALIFICATION LIST',
    DISQUALIFICATION_LIST,
    '',
    'CONTRACT',
    contractSummary(opportunity),
    '',
    'Decide: should this contract be disqualified for this buyer? Return disqualified (true/false) and a one-sentence reason.',
  ].join('\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: DISQUALIFY_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text);
  return {
    disqualified: parsed.disqualified === true,
    reason: String(parsed.reason || '').replace(/—/g, '-'),
  };
}

const WHY_SCHEMA = {
  type: 'object',
  properties: { why_line: { type: 'string' } },
  required: ['why_line'],
  additionalProperties: false,
};

// The "why we picked this" note. Two tight sentences, in the voice of a human
// reviewer who read both the solicitation and the buyer's profile. No long dash.
export async function whyLine(opportunity, buyer, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system = [
    'You are a member of a contract-sourcing team writing the short "why we picked this" note',
    'that goes to one specific small-business owner about one federal contract. Write exactly two',
    'sentences, plain and concrete, as a person who actually read the solicitation.',
    '',
    'Sentence 1: say what the work actually is in plain terms. Name the real scope (what gets built,',
    'serviced, supplied, or delivered), who needs it (the agency or installation), and where it is.',
    'Pull specifics from the solicitation text, not just the title.',
    '',
    'Sentence 2: tie it directly to what THIS owner told us they do. Reference their actual stated',
    'capabilities and keywords and their service area in your own words, so it is obvious we matched',
    'it to their profile on purpose. Speak to the owner as "you" and "your".',
    '',
    'Hard rules: Do not just restate a NAICS number or say "aligns with your NAICS." Do not mention',
    'AI, algorithms, or automated screening; we are a team of people. No hype, no filler. Do not use',
    'the long dash character.',
  ].join(' ');
  const userPrompt = [
    'THE OWNER TOLD US (their niche profile)',
    buyerSummary(buyer),
    '',
    'THE CONTRACT',
    contractSummary(opportunity),
    '',
    'Write the two-sentence "why we picked this" note for this owner.',
  ].join('\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: WHY_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text);
  return String(parsed.why_line || '').replace(/—/g, '-');
}

const DEEP_DIVE_SCHEMA = {
  type: 'object',
  properties: { deep_dive: { type: 'string' } },
  required: ['deep_dive'],
  additionalProperties: false,
};

// Plain-English breakdown of one chosen contract, pre-generated at send time and
// stored so the Dive Deeper page loads instantly. Covers what the agency wants,
// why the solicitation is structured the way it is, and why it fits this buyer.
export async function deepDive(opportunity, buyer, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system =
    'You explain a federal contract opportunity to a small-business owner in plain English. ' +
    'Write three short paragraphs: (1) what the agency actually wants and needs done, ' +
    '(2) why the solicitation is structured the way it is and what to watch for, ' +
    "(3) why this fits this buyer's niche and how to position for it. " +
    'Be concrete and practical, no fluff. Do not use the long dash character.';
  const userPrompt = [
    'BUYER PROFILE',
    buyerSummary(buyer),
    '',
    'CONTRACT',
    contractSummary(opportunity),
    '',
    'Write the three-paragraph breakdown.',
  ].join('\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: DEEP_DIVE_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text);
  return String(parsed.deep_dive || '').replace(/—/g, '-');
}

const NAICS_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['code', 'title'],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

// Map a plain-English description of a business or type of work to real 2022
// six-digit NAICS codes, so a buyer who has never heard of NAICS can just type
// what they do ("office cleaning", "paving roads") and get the right codes.
// Returns up to 6 { code, title } matches, most relevant first, validated to
// real-looking six-digit codes.
export async function suggestNaics(query, { client, model = DEFAULT_MODEL } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const anthropic = client || (await getAnthropic());
  const system =
    'You map a plain-English description of a business or type of work to the most relevant US ' +
    '2022 NAICS codes. Return up to 6 six-digit NAICS codes, most relevant first, each with its ' +
    'official NAICS title. Use only real, current six-digit codes and their official titles. Never ' +
    'invent a code. If the description is vague, return the closest common codes. Do not use the ' +
    'long dash character.';
  const userPrompt = `Business description: ${q}\n\nReturn the best-matching six-digit NAICS codes and their official titles.`;

  const res = await anthropic.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: NAICS_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const seen = new Set();
  return (parsed.matches || [])
    .map((m) => ({
      code: String(m.code || '').replace(/\D/g, ''),
      title: String(m.title || '').replace(/—/g, '-').trim(),
    }))
    .filter((m) => /^\d{6}$/.test(m.code) && m.title)
    .filter((m) => (seen.has(m.code) ? false : (seen.add(m.code), true)))
    .slice(0, 6);
}

const DISCOVER_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          industry: { type: 'string' },
          naics: {
            type: 'array',
            items: {
              type: 'object',
              properties: { code: { type: 'string' }, title: { type: 'string' } },
              required: ['code', 'title'],
              additionalProperties: false,
            },
          },
          explanation: { type: 'string' },
        },
        required: ['industry', 'naics', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};

// NICHE DISCOVERY: for a contractor who does not yet know what to go after.
// Given what they tell us about themselves, recommend up to 3 winnable niches,
// each with a plain-English industry, real NAICS code(s), and a short reason it
// fits them and tends to be winnable.
//
// NOTE: this framework is a v1. Tune the system prompt to the War Dogs Academy
// niche-selection methodology (from the course) once its rules are captured.
export async function discoverNiches(profile = {}, { client, model = DEFAULT_MODEL } = {}) {
  const anthropic = client || (await getAnthropic());
  const system = [
    'You are a federal-contracting coach helping a NEW contractor choose a winnable niche to pursue.',
    'Given what you know about them, recommend up to 3 specific niches. For each: the industry in plain',
    'English, the most relevant real six-digit NAICS code(s) with official titles, and a short explanation',
    'of why it fits THEM (their background, skills, certifications, location) and why it tends to be winnable.',
    'Favor niches where they have relevant experience or credibility to win and to perform. Favor niches where',
    'their certifications or set-asides shrink the competition. Prefer steady, less-glamorous recurring services',
    'and specialized work over crowded, prestigious categories, less competition is the goal. Use only real,',
    'current six-digit NAICS codes and official titles; never invent a code. Do not use the long dash character.',
  ].join(' ');

  const parts = [];
  if (profile.background) parts.push(`Background and skills: ${profile.background}`);
  if (profile.setAsides && profile.setAsides.length) parts.push(`Certifications / set-asides they hold: ${profile.setAsides.join(', ')}`);
  if (profile.state) parts.push(`Where they can work: ${profile.state}`);
  if (profile.interests) parts.push(`What draws them in or what to avoid: ${profile.interests}`);
  if (parts.length === 0) parts.push('They gave very little detail; recommend broadly accessible, winnable niches for a new small-business contractor.');
  const userPrompt = `${parts.join('\n')}\n\nRecommend up to 3 winnable niches with real NAICS codes and a short reason for each.`;

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: DISCOVER_SCHEMA } },
  });

  const text = res.content.find((b) => b.type === 'text')?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return (parsed.recommendations || [])
    .map((r) => ({
      industry: String(r.industry || '').replace(/—/g, '-').trim(),
      explanation: String(r.explanation || '').replace(/—/g, '-').trim(),
      naics: (r.naics || [])
        .map((n) => ({ code: String(n.code || '').replace(/\D/g, ''), title: String(n.title || '').replace(/—/g, '-').trim() }))
        .filter((n) => /^\d{6}$/.test(n.code) && n.title)
        .slice(0, 3),
    }))
    .filter((r) => r.industry && r.naics.length > 0)
    .slice(0, 3);
}

export { DEFAULT_MODEL, DISQUALIFICATION_LIST };
