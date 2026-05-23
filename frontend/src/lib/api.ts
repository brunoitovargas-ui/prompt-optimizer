const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export type ModelId = 'claude-haiku-4-5' | 'claude-sonnet-4-6' | 'claude-opus-4-7';

export type OptimizeRequest = {
  prompt: string;
  originalModel: ModelId;
  intent?: string;
  expectedOutputTokens?: number;
};

export type Classification = {
  recommendation: 'llm' | 'regex' | 'deterministic' | 'search' | 'other';
  confidence: number;
  reasoning: string;
  alternative?: string;
};

export type SelectedModel = {
  model: ModelId;
  reasoning: string;
  confidence: number;
};

export type Refined = {
  prompt: string;
  maxTokens: number;
  outputFormat: string;
  inputTokens: number;
  originalInputTokens: number;
};

export type Savings = {
  originalCostPerRun: number;
  optimizedCostPerRun: number;
  savingsPerRun: number;
  optimizerCost: number;
  breakevenRuns: number | null;
  verdict: 'recommended' | 'borderline' | 'not_worth';
  summary: string;
};

export type OptimizerState = {
  prompt: string;
  originalModel: ModelId;
  intent?: string;
  classification: Classification;
  selectedModel?: SelectedModel;
  refined?: Refined;
  savings: Savings;
  shortCircuit: boolean;
  skippedRefine: boolean;
  optimizerCost: {
    totalUsd: number;
    breakdown: Array<{
      step: string;
      model: ModelId;
      inputTokens: number;
      outputTokens: number;
      usd: number;
    }>;
  };
};

export async function optimizePrompt(payload: OptimizeRequest): Promise<OptimizerState> {
  const res = await fetch(`${BASE_URL}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json.data;
}
