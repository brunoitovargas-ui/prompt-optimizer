import { callStructured } from '../lib/anthropicClient.js';
import { countInputTokens } from '../lib/tokenCounter.js';
import { costUsd } from '../lib/modelCatalog.js';

const MODEL = 'claude-sonnet-4-6';

const TOOL = {
  name: 'refine_prompt',
  description: 'Reescreve o prompt para ser mais eficiente em tokens sem perder a intenção.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Prompt reescrito, pronto para uso direto.' },
      maxTokens: { type: 'integer', description: 'max_tokens sugerido para a resposta.' },
      outputFormat: {
        type: 'string',
        description: "Formato mais enxuto, ex.: 'json', 'plain', 'single_word', 'single_number', 'list'.",
      },
    },
    required: ['prompt', 'maxTokens', 'outputFormat'],
  },
};

const SYSTEM = `Reescreva prompts para serem mais baratos sem perder a intenção.
- Remova cortesias, redundâncias e instruções óbvias.
- Imponha o formato de saída mais enxuto possível.
- Sugira max_tokens justo para a tarefa.
- Não invente requisitos.
Devolva apenas a saída estruturada via tool.`;

export default async function refinePrompt(state) {
  const userText = `Modelo alvo: ${state.selectedModel.model}
${state.intent ? `Intenção: ${state.intent}\n` : ''}
Prompt original:
${state.prompt}`;

  const { input, usage } = await callStructured({
    model: MODEL,
    system: SYSTEM,
    messages: [{ role: 'user', content: userText }],
    tool: TOOL,
    maxTokens: 1024,
  });

  const refinedInputTokens = await countInputTokens({
    model: state.selectedModel.model,
    messages: [{ role: 'user', content: input.prompt }],
  });

  const usd = costUsd(MODEL, usage.input_tokens, usage.output_tokens);
  return {
    ...state,
    refined: {
      prompt: input.prompt,
      maxTokens: input.maxTokens,
      outputFormat: input.outputFormat,
      inputTokens: refinedInputTokens,
      originalInputTokens: state.originalInputTokens,
    },
    optimizerCost: {
      totalUsd: (state.optimizerCost?.totalUsd ?? 0) + usd,
      breakdown: [
        ...(state.optimizerCost?.breakdown ?? []),
        {
          step: 'refinePrompt',
          model: MODEL,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          usd,
        },
      ],
    },
  };
}
