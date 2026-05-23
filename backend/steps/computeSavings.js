import { costUsd } from '../lib/modelCatalog.js';

const DEFAULT_OUTPUT_TOKENS = 1024;

function verdictFor(savingsPerRun, optimizerCost) {
  if (savingsPerRun <= 0) return 'not_worth';
  const breakeven = optimizerCost / savingsPerRun;
  if (savingsPerRun >= 3 * optimizerCost) return 'recommended';
  if (breakeven <= 5) return 'borderline';
  return 'not_worth';
}

export default async function computeSavings(state) {
  const optimizerCost = state.optimizerCost?.totalUsd ?? 0;
  const expectedOutputTokens = state.expectedOutputTokens ?? DEFAULT_OUTPUT_TOKENS;

  const originalCostPerRun = costUsd(
    state.originalModel,
    state.originalInputTokens,
    expectedOutputTokens,
  );

  let optimizedCostPerRun;
  if (state.refined && state.selectedModel) {
    optimizedCostPerRun = costUsd(
      state.selectedModel.model,
      state.refined.inputTokens,
      state.refined.maxTokens,
    );
  } else if (state.selectedModel) {
    // Skip do refinePrompt: usa o prompt original mas com o modelo sugerido.
    optimizedCostPerRun = costUsd(
      state.selectedModel.model,
      state.originalInputTokens,
      expectedOutputTokens,
    );
  } else {
    // Curto-circuito: usuário troca o LLM por outra ferramenta.
    optimizedCostPerRun = 0;
  }

  const savingsPerRun = originalCostPerRun - optimizedCostPerRun;
  const breakevenRuns = savingsPerRun > 0 ? optimizerCost / savingsPerRun : null;
  const verdict = verdictFor(savingsPerRun, optimizerCost);

  const summary =
    verdict === 'recommended'
      ? `Economia de ${savingsPerRun.toFixed(6)} USD por execução. Paga o otimizador em ${breakevenRuns?.toFixed(1) ?? '∞'} execuções.`
      : verdict === 'borderline'
      ? `Economia marginal: paga em ${breakevenRuns?.toFixed(1) ?? '∞'} execuções.`
      : `Não compensa: economia insuficiente frente ao custo do otimizador.`;

  return {
    ...state,
    savings: {
      originalCostPerRun,
      optimizedCostPerRun,
      savingsPerRun,
      optimizerCost,
      breakevenRuns,
      verdict,
      summary,
    },
  };
}
