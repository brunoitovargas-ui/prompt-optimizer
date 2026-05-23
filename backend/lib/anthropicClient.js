import Anthropic from '@anthropic-ai/sdk';

let client;
let apiKeyPromise;

async function resolveApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const paramName = process.env.ANTHROPIC_PARAMETER_NAME;
  if (!paramName) {
    throw new Error('ANTHROPIC_API_KEY not set and ANTHROPIC_PARAMETER_NAME not provided');
  }
  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const ssm = new SSMClient({});
  const out = await ssm.send(new GetParameterCommand({ Name: paramName, WithDecryption: true }));
  if (!out.Parameter?.Value) throw new Error(`empty SSM parameter: ${paramName}`);
  return out.Parameter.Value;
}

async function getClient() {
  if (client) return client;
  apiKeyPromise ??= resolveApiKey();
  const apiKey = await apiKeyPromise;
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Chamada padrão a /v1/messages forçando saída estruturada via tool_use.
 * Retorna { input, usage: { input_tokens, output_tokens } }.
 */
export async function callStructured({ model, system, messages, tool, maxTokens = 1024 }) {
  const c = await getClient();
  const res = await c.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block) throw new Error(`model did not call tool ${tool.name}`);
  return { input: block.input, usage: res.usage };
}

export { getClient };
