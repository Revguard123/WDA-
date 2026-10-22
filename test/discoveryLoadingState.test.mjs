import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Discovery resumes persisted chat and reconciles optimistic answers without duplicating them', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  for (const marker of [
    '/conversation', "useState('chat')", 'initialAdvisorState(initialSession)',
    'initialSession?.recommendations', 'optimisticMessages', 'afterMessageCount',
    'pendingOptimisticMessages', 'latestStudent?.content === message.content',
    'message.originalIndex ?? visualIndex', "callConversation({ start: true })",
    'questionForMessage(index)', 'async function editAnswer(index, content)',
    'edit_answer: true', 'draft_suggestion: true',
  ]) assert.ok(source.includes(marker), marker);
});

test('thinking, suggestion drafting and shortlist loading use local accessible states, not remote animation frames', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.match(source, /const buildingRecommendations = busy && state.complete && !recs.length/);
  assert.match(source, /busy && !buildingRecommendations/);
  assert.match(source, /role="status" aria-label="Advisor is thinking"/);
  assert.match(source, /className="wda-typing-bubble" aria-hidden="true"/);
  assert.match(source, /drafting && !pending\?\.options\?\.length/);
  assert.match(source, /buildingRecommendations \? <RecommendationLoading \/>/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /aria-busy=\{busy \|\| drafting \|\| buildingRecommendations\}/);
  assert.doesNotMatch(source, /<iframe|lottie\.host|THINKING_LOTTIE_URL|DRAFT_LOTTIE_URL/);
});

test('composer retains keyboard entry, safe busy controls and reduced-motion-aware history scrolling', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  for (const marker of [
    'Enter to send', 'Shift+Enter', 'rows={1}', 'onKeyDown={sendWithKey}',
    'function resizeComposer(event)', 'Math.min(el.scrollHeight, 128)',
    'disabled={drafting || ((recs.length > 0 || buildingRecommendations) && editingIndex == null)}',
    'disabled={locked || ((recs.length > 0 || buildingRecommendations) && editingIndex == null) || !draft.trim()}',
    'historyRef', 'scrollChatToBottom', "prefersReducedMotion ? 'auto' : behavior",
    'window.scrollTo(0, 0)', 'setShowAnswers(true)', 'Your answers are saved',
  ]) assert.ok(source.includes(marker), marker);
  assert.doesNotMatch(source, /Give me the short version|<aside className="discovery-sidebar">/);
});

test('Discovery route counts answered adaptive questions as clarification rounds', () => {
  const source = readFileSync('app/api/discover/[token]/route.js', 'utf8');
  assert.ok(source.includes('Object.keys(answers.adaptive_answers || {}).length'));
});

test('Discovery conversation submit handles empty or non-JSON error responses safely', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.ok(source.includes('async function readJsonResponse'));
  assert.ok(source.includes('function customerSafeError'));
  assert.ok(source.includes('failed to execute|unexpected end|json|syntaxerror'));
  assert.ok(source.includes('const text = await response.text()'));
  assert.equal(source.includes('const data = await response.json();'), false);
  assert.equal(source.includes('const result = await response.json();'), false);
});

test('Discovery conversation route returns JSON for unexpected failures', () => {
  const source = readFileSync('app/api/discover/[token]/conversation/route.js', 'utf8');
  assert.ok(source.includes('async function handleConversationPost'));
  assert.ok(source.includes("stage: 'discovery_answers_validation_failed'"));
  assert.ok(source.includes('validation_failure_path'));
  assert.ok(source.includes('validation_failure_reason'));
  assert.ok(source.includes("stage: 'conversation_route_failed'"));
  assert.ok(source.includes("Response.json({ error: 'Could not continue this conversation right now.' }, { status: 503 })"));
});

test('New Discovery reset clears stale recommendations and selected recommendation state', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  const route = readFileSync('app/api/discover/[token]/conversation/route.js', 'utf8');
  assert.ok(source.includes('setRecs([])'));
  assert.ok(source.includes('setAnswers({})'));
  assert.ok(source.includes('setState(emptyState)'));
  assert.match(
  source,
  /recommendations:\s*\[\],\s*selected_recommendation:\s*null/,
);
  assert.match(
  source,
  /start:\s*true,\s*reset:\s*true/,
);
  assert.ok(route.includes('const forceReset = body.start && body.reset === true'));
  assert.ok(route.includes('body.start && !forceReset'));
  assert.ok(route.includes('const existingAnswers = forceReset ? {}'));
});

test('editing a prior Discovery answer updates in place instead of truncating later chat', () => {
  const source = readFileSync('app/api/discover/[token]/conversation/route.js', 'utf8');
  assert.match(source, /nextMessages\s*=\s*answer\s*\?\s*messages\.map/);
  assert.match(source, /advisor_state:\s*advisorState/);
  assert.equal(source.includes('.slice(-10)'), false);
  assert.equal(source.includes('.slice(-14)'), false);
  assert.equal(source.includes('const priorMessages'), false);
});

test('Discovery uses the shared workspace while keeping history and composer in a constrained viewport', () => {
  const source = readFileSync('app/discover/[token]/page.js', 'utf8');
  assert.ok(source.includes('locked'));
  assert.ok(source.includes('SetupWorkspace'));
  assert.ok(source.includes('embedded'));
  const css = readFileSync('app/workspace.css', 'utf8');
  assert.ok(css.includes('.is-workspace .wda-setup-scroll:has(.wda-discovery-workspace)'));
  assert.ok(css.includes('overflow: hidden'));
});

test('Shared shell header has compact mobile brand sizing', () => {
  const source = readFileSync('app/_components/Shell.jsx', 'utf8');
  assert.ok(source.includes('shell-brand-header'));
  assert.ok(source.includes('@media(max-width:600px)'));
  assert.ok(source.includes('.shell-brand-logo{width:145px'));
  assert.ok(source.includes('.shell-brand-header{padding:18px 16px 14px}'));
});
