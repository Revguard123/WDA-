// Keyword matching for Slice 2. Scores how well an opportunity's text matches a
// buyer's stated keywords. This is a RANKING signal and AI-context input, not a
// hard filter: a low score never drops a contract on its own (the AI
// disqualification pass and ranking decide that). The score is explainable, it
// returns exactly which terms matched and where.

// Normalize free text to a single space-padded lowercase string so phrases can
// be matched with word boundaries (" phrase " lookups). Punctuation becomes
// spaces, so "janitorial." and "(custodial)" match cleanly.
export function normalizeText(text) {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ` ${cleaned} `;
}

// Light singular/plural variants for a normalized keyword. We only add a safe
// trailing-s variant (or strip a trailing s), never aggressive stemming.
function keywordVariants(normalizedKeyword) {
  const kw = normalizedKeyword.trim();
  if (!kw) return [];
  const variants = new Set([kw]);
  if (kw.endsWith('s')) variants.add(kw.slice(0, -1));
  else variants.add(`${kw}s`);
  return [...variants];
}

// Does a keyword (any variant) appear as a whole word/phrase in normalized text?
function phraseInText(normalizedKeyword, paddedText) {
  return keywordVariants(normalizedKeyword).some((v) => paddedText.includes(` ${v} `));
}

// Score an opportunity's title + description against a buyer's keywords.
// Returns the matched terms (split by title vs body), a raw weighted count
// (title hits count double), and coverage (fraction of keywords matched
// anywhere). Keywords are de-duplicated after normalization.
export function scoreKeywords(opportunity, keywords = []) {
  const title = normalizeText(opportunity?.title);
  const body = normalizeText(opportunity?.description);

  const normKeywords = [...new Set(
    (keywords || []).map((k) => normalizeText(k).trim()).filter(Boolean),
  )];

  const matchedInTitle = [];
  const matchedInBody = [];
  for (const kw of normKeywords) {
    if (phraseInText(kw, title)) matchedInTitle.push(kw);
    else if (phraseInText(kw, body)) matchedInBody.push(kw);
  }

  const matched = [...matchedInTitle, ...matchedInBody];
  const weighted = matchedInTitle.length * 2 + matchedInBody.length * 1;
  const coverage = normKeywords.length ? matched.length / normKeywords.length : 0;

  return {
    matchedInTitle,
    matchedInBody,
    matched,
    weighted,
    coverage,
    keywordCount: normKeywords.length,
  };
}

// Overall match strength in [0,1], combining NAICS tag match with keyword
// signal. When the buyer has keywords, the score leans on them (0.65) with
// NAICS as a floor (0.35); a couple of title hits saturate the keyword signal.
// When the buyer has no keywords, we fall back to the NAICS tag alone.
export function matchStrength(opportunity, buyer = {}) {
  const kw = scoreKeywords(opportunity, buyer.keywords);
  const naicsList = (buyer.naics || []).map(String);
  const naicsExact = opportunity?.naics && naicsList.includes(String(opportunity.naics)) ? 1 : 0;

  // 2 title hits, or 4 body hits, reaches full keyword signal.
  const keywordSignal = Math.min(1, kw.weighted / 4);

  const score = kw.keywordCount > 0
    ? 0.35 * naicsExact + 0.65 * keywordSignal
    : naicsExact;

  return {
    score: Number(score.toFixed(4)),
    naicsExact,
    keywordSignal: Number(keywordSignal.toFixed(4)),
    ...kw,
  };
}
