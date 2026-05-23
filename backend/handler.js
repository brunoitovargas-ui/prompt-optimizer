import analyzeNeed from './steps/analyzeNeed.js';
import refinePrompt from './steps/refinePrompt.js';
import computeSavings from './steps/computeSavings.js';
import { countInputTokens } from './lib/tokenCounter.js';
import { MODELS } from './lib/modelCatalog.js';

const SHORT_CIRCUIT_CONFIDENCE = 0.75;

// Abaixo desse tamanho, a economia possível em tokens de entrada é menor que o
// custo de chamar o Sonnet para reescrever — pula o refinePrompt.
const MIN_TOKENS_TO_REFINE = 30;

function validate(payload) {
  if (!payload || typeof payload !== 'object') return 'body must be a JSON object';
  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return 'prompt is required';
  if (typeof payload.originalModel !== 'string' || !MODELS[payload.originalModel]) {
    return `originalModel must be one of: ${Object.keys(MODELS).join(', ')}`;
  }
  if (payload.intent !== undefined && typeof payload.intent !== 'string') {
    return 'intent must be a string';
  }
  if (
    payload.expectedOutputTokens !== undefined &&
    (!Number.isInteger(payload.expectedOutputTokens) || payload.expectedOutputTokens <= 0)
  ) {
    return 'expectedOutputTokens must be a positive integer';
  }
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

  // count_tokens é gratuito — contamos cedo para reuso em decisões e cálculo.
  state.originalInputTokens = await countInputTokens({
    model: state.originalModel,
    messages: [{ role: 'user', content: state.prompt }],
  });

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

export async function handler(event) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const data = await runPipeline(body);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    };
  } catch (e) {
    const status = e.code === 'invalid_input' ? 400 : 500;
    return {
      statusCode: status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { code: e.code ?? 'internal_error', message: e.message } }),
    };
  }
}
