import { getServiceClient } from './supabase.js';
import {
  PLAYBOOK_VERSION,
  normalizeDiscoveryAnswers,
  validateDiscoveryAnswers,
} from './playbook/index.js';

export const DISCOVERY_SESSION_STATUSES = ['in_progress', 'recommended', 'selected'];
export const DISCOVERY_TOTAL_STEPS = 6;

function isMissingTableError(error) {
  return error && (error.code === '42P01' || /discovery_sessions/i.test(error.message || '') && /does not exist|schema cache/i.test(error.message || ''));
}

function clampStep(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(DISCOVERY_TOTAL_STEPS, Math.max(1, Math.trunc(n)));
}

function safeStatus(value) {
  return DISCOVERY_SESSION_STATUSES.includes(value) ? value : 'in_progress';
}

export function serializeDiscoverySession(row) {
  if (!row) return null;
  return {
    id: row.id,
    buyer_id: row.buyer_id,
    answers: normalizeDiscoveryAnswers(row.answers || {}),
    normalized_profile: row.normalized_profile || {},
    status: safeStatus(row.status),
    current_step: clampStep(row.current_step),
    recommendations: row.recommendations || null,
    selected_recommendation: row.selected_recommendation || null,
    playbook_version: row.playbook_version || PLAYBOOK_VERSION,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function publicDiscoverySession(row) {
  const session = serializeDiscoverySession(row);
  if (!session) return null;
  const { buyer_id, ...safe } = session;
  return safe;
}

export function prepareDiscoverySessionSave({
  buyerId,
  answers = {},
  currentStep = 1,
  status = 'in_progress',
  recommendations = undefined,
  selectedRecommendation = undefined,
} = {}) {
  if (!buyerId) throw new Error('buyerId is required');
  const validation = validateDiscoveryAnswers(answers);
  if (!validation.ok) {
    const err = new Error('Discovery answers are invalid');
    err.validation = validation;
    throw err;
  }
  const patch = {
    buyer_id: buyerId,
    answers: validation.answers,
    normalized_profile: validation.normalized_profile,
    status: safeStatus(status),
    current_step: clampStep(currentStep),
    playbook_version: PLAYBOOK_VERSION,
    updated_at: new Date().toISOString(),
  };
  if (recommendations !== undefined) patch.recommendations = recommendations;
  if (selectedRecommendation !== undefined) patch.selected_recommendation = selectedRecommendation;
  return patch;
}

export async function getDiscoverySessionForBuyer(buyerId, { client } = {}) {
  const supabase = client || (await getServiceClient());
  const { data, error } = await supabase
    .from('discovery_sessions')
    .select('*')
    .eq('buyer_id', buyerId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(`discovery session lookup failed: ${error.message}`);
  }
  return serializeDiscoverySession(data);
}

export async function saveDiscoverySessionForBuyer(buyerId, input = {}, { client } = {}) {
  const supabase = client || (await getServiceClient());
  const patch = prepareDiscoverySessionSave({ buyerId, ...input });
  const { data, error } = await supabase
    .from('discovery_sessions')
    .upsert(patch, { onConflict: 'buyer_id' })
    .select('*')
    .single();
  if (error) {
    if (isMissingTableError(error)) {
      const err = new Error('Discovery session storage is not available yet');
      err.code = 'DISCOVERY_SESSION_TABLE_MISSING';
      throw err;
    }
    throw new Error(`discovery session save failed: ${error.message}`);
  }
  return serializeDiscoverySession(data);
}
