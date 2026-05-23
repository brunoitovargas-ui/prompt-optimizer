import { callStructured } from '../lib/anthropicClient.js';
import { costUsd } from '../lib/modelCatalog.js';

const MODEL = 'claude-haiku-4-5';

const TOOL = {
  name: 'analyze',
  description: 'Decide se a tarefa precisa de LLM e, em caso afirmativo, qual o menor modelo Anthropic suficiente.',
  input_schema: {
    type: 'object',
    properties: {
      recommendation: {
        type: 'string',
        enum: ['llm', 'regex', 'deterministic', 'search', 'other'],
      },
      confidence: { type: 'number', description: '0..1' },
      reasoning: { type: 'string' },
      alternative: { type: 'string', description: 'Descrição da alternativa não-LLM, se aplicável.' },
      modelChoice: {
        type: 'object',
        description: 'Preencher APENAS se recommendation === "llm".',
        properties: {
          model: {
            type: 'string',
            enum: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-7'],
          },
          reasoning: { type: 'string' },
          confidence: { type: 'number', description: '0..1' },
        },
        required: ['model', 'reasoning', 'confidence'],
      },
    },
    required: ['recommendation', 'confidence', 'reasoning'],
  },
};

const SYSTEM = `Você decide duas coisas sobre um prompt:
1) Se ele realmente precisa de LLM. Use 'llm' só para tarefas que exijam linguagem natural, raciocínio aberto ou julgamento; senão prefira 'regex', 'deterministic', 'search' ou 'other'.
2) Se for LLM, qual menor modelo Anthropic basta:
   - haiku-4-5: classificação, extração, transformação simples, respostas factuais curtas.
   - sonnet-4-6: raciocínio moderado, código médio, análise estruturada.
   - opus-4-7: raciocínio complexo, código difícil, análise profunda.
O modelo declarado pelo usuário é teto, não piso. Se Haiku basta, recomende Haiku.`;

export default async function analyzeNeed(state) {
  const userText = `Modelo declarado: ${state.originalModel}
${state.intent ? `Intenção: ${state.intent}\n` : ''}
Prompt:
${state.prompt}`;

  const { input, usage } = await callStructured({
    model: MODEL,
    system: SYSTEM,
    messages: [{ role: 'user', content: userText }],
    tool: TOOL,
    maxTokens: 600,
  });

  const usd = costUsd(MODEL, usage.input_tokens, usage.output_tokens);
  const { modelChoice, ...classification } = input;

  return {
    ...state,
    classification,
    selectedModel: modelChoice,
    optimizerCost: {
      totalUsd: (state.optimizerCost?.totalUsd ?? 0) + usd,
      breakdown: [
        ...(state.optimizerCost?.breakdown ?? []),
        {
          step: 'analyzeNeed',
          model: MODEL,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          usd,
        },
      ],
    },
  };
}
