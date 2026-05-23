import { getClient } from './anthropicClient.js';

/**
 * Conta tokens de entrada via /v1/messages/count_tokens.
 * NUNCA usar tiktoken para modelos Claude.
 */
export async function countInputTokens({ model, system, messages }) {
  const c = await getClient();
  const res = await c.messages.countTokens({ model, system, messages });
  return res.input_tokens;
}
