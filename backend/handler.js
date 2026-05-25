import analyzeNeed from './steps/analyzeNeed.js';
import refinePrompt from './steps/refinePrompt.js';
import computeSavings from './steps/computeSavings.js';
import { countInputTokens } from './lib/tokenCounter.js';
import { MODELS } from './lib/modelCatalog.js';

const SHORT_CIRCUIT_CONFIDENCE = 0.75;
const MIN_TOKENS_TO_REFINE = 30;

// Limites duros — protegem contra abuso e inflação de custo Anthropic.
const MAX_PROMPT_CHARS = 20_000;
const MAX_INTENT_CHARS = 500;
const MAX_INPUT_TOKENS = 8_000;

// Origens permitidas. Sem origin (curl, aws lambda invoke) é aceito;
// browser de outra origem é rejeitado.
const ALLOWED_ORIGINS = new Set([
  'https://main.d2bi1xssyw0yo0.amplifyapp.com',
  'http://localhost:5173',
]);

function validate(payload) {
  if (!payload || typeof payload !== 'object') return 'body must be a JSON object';
  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return 'prompt is required';
  if (payload.prompt.length > MAX_PROMPT_CHARS) {
    return `prompt exceeds ${MAX_PROMPT_CHARS} characters`;
  }
  if (typeof payload.originalModel !== 'string' || !MODELS[payload.originalModel]) {
    return `originalModel must be one of: ${Object.keys(MODELS).join(', ')}`;
  }
  if (payload.intent !== undefined) {
    if (typeof payload.intent !== 'string') return 'intent must be a string';
    if (payload.intent.length > MAX_INTENT_CHARS) {
      return `intent exceeds ${MAX_INTENT_CHARS} characters`;
    }
  }
  if (
    payload.expectedOutputTokens !== undefined &&
    (!Number.isInteger(payload.expectedOutputTokens) || payload.expectedOutputTokens <= 0)
  ) {
    return 'expectedOutputTokens must be a positive integer';
  }
  return null;
}

function checkOrigin(event) {
  const origin = event?.headers?.origin ?? event?.headers?.Origin;
  if (!origin) return null;
  if (!ALLOWED_ORIGINS.has(origin)) return `origin ${origin} not allowed`;
  return null;
}

export async function runPipeline(payload) {
  const err = validate(payload);
  if (err) {
    const e = new Error(err);
    e.code = 'invalid_input';
    throw e;
  }

  let state = {
    prompt: payload.prompt,
    originalModel: payload.originalModel,
    intent: payload.intent,
    expectedOutputTokens: payload.expectedOutputTokens,
    optimizerCost: { totalUsd: 0, breakdown: [] },
  };

  // count_tokens é gratuito — usamos para gate de custo antes de chamar Haiku.
  state.originalInputTokens = await countInputTokens({
    model: state.originalModel,
    messages: [{ role: 'user', content: state.prompt }],
  });

  if (state.originalInputTokens > MAX_INPUT_TOKENS) {
    const e = new Error(
      `prompt exceeds ${MAX_INPUT_TOKENS} input tokens (got ${state.originalInputTokens})`,
    );
    e.code = 'invalid_input';
    throw e;
  }

  state = await analyzeNeed(state);

  const shortCircuit =
    state.classification.recommendation !== 'llm' &&
    state.classification.confidence > SHORT_CIRCUIT_CONFIDENCE;

  let skippedRefine = false;
  if (!shortCircuit && state.selectedModel) {
    const sameModel = state.selectedModel.model === state.originalModel;
    const tinyPrompt = state.originalInputTokens <= MIN_TOKENS_TO_REFINE;
    if (sameModel && tinyPrompt) {
      skippedRefine = true;
    } else {
      state = await refinePrompt(state);
    }
  }

  state = await computeSavings(state);
  return { ...state, shortCircuit, skippedRefine };
}

function logEvent(o) {
  // Estruturado para CloudWatch Logs Insights. Nunca loga conteúdo do prompt.
  console.log(JSON.stringify(o));
}

export async function handler(event) {
  const start = Date.now();
  const requestId = event?.requestContext?.requestId ?? 'unknown';

  const originErr = checkOrigin(event);
  if (originErr) {
    logEvent({ requestId, type: 'origin_blocked', message: originErr, durationMs: Date.now() - start });
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { code: 'forbidden', message: 'origin not allowed' } }),
    };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const data = await runPipeline(body);

    logEvent({
      requestId,
      type: 'success',
      originalModel: data.originalModel,
      originalInputTokens: data.originalInputTokens,
      verdict: data.savings?.verdict,
      optimizerCostUsd: data.optimizerCost?.totalUsd,
      shortCircuit: data.shortCircuit,
      skippedRefine: data.skippedRefine,
      durationMs: Date.now() - start,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    };
  } catch (e) {
    const status = e.code === 'invalid_input' ? 400 : 500;
    logEvent({
      requestId,
      type: 'error',
      code: e.code ?? 'internal_error',
      message: e.message,
      statusCode: status,
      durationMs: Date.now() - start,
    });
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { code: e.code ?? 'internal_error', message: e.message } }),
    };
  }
}
