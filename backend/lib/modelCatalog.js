/**
 * Catálogo de modelos Anthropic e preços (USD por 1M tokens).
 * Atualizar aqui quando a Anthropic mudar tabela.
 */
export const MODELS = {
  'claude-haiku-4-5':  { input: 0.80,  output: 4.00 },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
};

export function priceFor(model) {
  const p = MODELS[model];
  if (!p) throw new Error(`unknown model: ${model}`);
  return p;
}

export function costUsd(model, inputTokens, outputTokens) {
  const p = priceFor(model);
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
