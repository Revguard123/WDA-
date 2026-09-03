import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Discovery uses a persisted advisor conversation with compact header controls', () => {
  const source = readFileSync('app/_components/DiscoveryForm.jsx', 'utf8');
  assert.ok(source.includes('/conversation'));
  assert.ok(source.includes("useState('chat')"));
  assert.ok(source.includes('THINKING_LOTTIE_URL'));
  assert.ok(source.includes('lottie.host/embed/d600c658-5662-4e45-bdba-bf24d1abbff8/P88Xg7Vftf.lottie'));
  assert.ok(source.includes('<iframe title="Advisor thinking animation"'));
  assert.ok(source.includes('optimisticMessages'));
  assert.ok(source.includes('afterMessageCount'));
  assert.ok(source.includes('pendingOptimisticMessages'));
  assert.ok(source.includes('Sending...'));
  assert.ok(source.includes('Enter to send'));
  assert.ok(source.includes('Suggestions, not limits'));
  assert.ok(source.includes('showSuggestions'));
  assert.ok(source.includes('setTimeout(() => setShowSuggestions(true), 3500)'));
  assert.ok(source.includes('font-size:13px'));
  assert.ok(source.includes('discovery-toolbar'));
  assert.ok(source.includes('function Icon({ name })'));
  assert.ok(source.includes('optionIcons'));
  assert.ok(source.includes('<Icon name="plus" /> New'));
  assert.ok(source.includes('<Icon name="message" /> Current'));
  assert.ok(source.includes('<Icon name="target" /> Build targeting'));
  assert.ok(source.includes('discovery-composer-leading'));
  assert.ok(source.includes('<Icon name="send" />'));
  assert.ok(source.includes('draftSuggestion(option.label)'));
  assert.ok(source.includes('draft_suggestion: true'));
  assert.ok(source.includes('DRAFT_LOTTIE_URL'));
  assert.ok(source.includes('lottie.host/embed/322a6aa2-45b8-484f-aa83-529d5134cf7f/Fs00gWaIMv.json'));
  assert.ok(source.includes('<div className="discovery-draft-animation"><iframe title="Generating suggested answer" src={DRAFT_LOTTIE_URL}></iframe></div>'));
  assert.ok(source.includes('Generating an answer you can review...'));
  assert.ok(source.includes('!drafting && (pending || recs.length || buildingRecommendations)'));
  assert.ok(source.includes('Recommendations are ready. Edit an earlier answer to change them.'));
  assert.ok(source.includes('const buildingRecommendations = busy && state.complete && !recs.length'));
  assert.ok(source.includes('Building your recommendations'));
  assert.ok(source.includes('<iframe title="Building recommendations animation" src={THINKING_LOTTIE_URL}></iframe>'));
  assert.ok(source.includes('checking the safest starting lanes'));
  assert.ok(source.includes('disabled={(recs.length > 0 || buildingRecommendations) && editingIndex == null}'));
  assert.ok(source.includes("buildingRecommendations ? 'Building your recommendations...'"));
  assert.ok(source.includes('Writing a draft you can edit...'));
  assert.ok(source.includes('draft.trim()'));
  assert.ok(source.includes("result.status === 'needs_clarification'"));
  assert.ok(source.includes('historyRef'));
  assert.ok(source.includes('scrollChatToBottom'));
  assert.ok(source.includes('discovery-bottom-jump'));
  assert.ok(source.includes('↓ Latest'));
  assert.ok(source.includes("callConversation({ start: true })"));
  assert.ok(source.includes('Build targeting'));
  assert.equal(source.includes('<aside className="discovery-sidebar">'), false);
  assert.ok(source.includes('discovery-active-question'));
  assert.ok(source.includes('discovery-question-line'));
  assert.ok(source.includes('background:#fffaf4'));
  assert.ok(source.includes('@media(max-width:600px)'));
  assert.ok(source.includes('.discovery-active-question .discovery-question{font-size:16px'));
  assert.ok(source.includes('.discovery-chip{padding:6px 9px;font-size:12px}'));
  assert.ok(source.includes('.discovery-composer{padding-top:8px;padding-bottom:20px}'));
  assert.ok(source.includes('function resizeComposer(event)'));
  assert.ok(source.includes('Math.min(el.scrollHeight, 128)'));
  assert.ok(source.includes('max-height:128px'));
  assert.ok(source.includes('bottom:6px;width:30px;height:30px'));
  assert.equal(source.includes('<div className="discovery-name">Niche Advisor</div><div className="discovery-copy">{message.content}</div>'), false);
  assert.ok(source.includes('function questionForMessage(index)'));
  assert.ok(source.includes('async function editAnswer(index, content)'));
  assert.ok(source.includes('edit_answer: true'));
  assert.ok(source.includes('discovery-student-label'));
  assert.ok(source.includes('discovery-edit-answer'));
  assert.ok(source.includes('<Icon name="edit" /> Edit'));
  assert.ok(source.includes('is-editing'));
  assert.ok(source.includes('@keyframes wdaEditGlow'));
  assert.ok(source.includes('linear-gradient(90deg,#f52ea9,#ff9f58'));
  assert.ok(source.includes('discovery-recommendation-message'));
  assert.ok(source.includes('Niche Advisor recommendation'));
  assert.ok(source.includes('discovery-rec-grid'));
  assert.ok(source.includes('discovery-rec-button'));
  assert.ok(source.includes('discovery-rec-button discovery-chip'));
  assert.equal(source.includes('<strong style={{ color: UI.ink, fontSize: 18 }}>{rec.subindustry_name}</strong>'), false);
  assert.ok(source.includes('rows={1}'));
  assert.ok(source.includes('onClick={startNewDiscovery}'));
  assert.ok(source.includes('overflow-y:auto'));
  assert.ok(source.includes('height:100%'));
  assert.equal(source.includes('max-width:1134px'), false);
  assert.ok(source.includes('window.scrollTo(0, 0)'));
  assert.equal(source.includes('.discovery-main{margin:24px 33px 20px 22px;padding:20px 18px 13px;background:#fff;border:'), false);
  assert.equal(source.includes('Give me the short version'), false);
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
  assert.ok(source.includes('recommendations: [], selected_recommendation: null'));
  assert.ok(source.includes('start: true, reset: true'));
  assert.ok(route.includes('const forceReset = body.start && body.reset === true'));
  assert.ok(route.includes('body.start && !forceReset'));
  assert.ok(route.includes('const existingAnswers = forceReset ? {}'));
});

test('editing a prior Discovery answer updates in place instead of truncating later chat', () => {
  const source = readFileSync('app/api/discover/[token]/conversation/route.js', 'utf8');
  assert.ok(source.includes('nextMessages = answer ? messages.map'));
  assert.ok(source.includes('advisor_state: { messages,'));
  assert.equal(source.includes('.slice(-10)'), false);
  assert.equal(source.includes('.slice(-14)'), false);
  assert.equal(source.includes('const priorMessages'), false);
});

test('Discovery page wrapper owns the viewport height under the header', () => {
  const source = readFileSync('app/discover/[token]/page.js', 'utf8');
  assert.ok(source.includes('locked'));
  assert.ok(source.includes("height: '100%'"));
  assert.ok(source.includes("overflow: 'hidden'"));
});

test('Shared shell header has compact mobile brand sizing', () => {
  const source = readFileSync('app/_components/Shell.jsx', 'utf8');
  assert.ok(source.includes('shell-brand-header'));
  assert.ok(source.includes('@media(max-width:600px)'));
  assert.ok(source.includes('.shell-brand-logo{width:145px'));
  assert.ok(source.includes('.shell-brand-header{padding:18px 16px 14px}'));
});
