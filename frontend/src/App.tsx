import { useState } from 'react';
import { PromptInput } from './components/PromptInput';
import { ModelSelector } from './components/ModelSelector';
import { IntentInput } from './components/IntentInput';
import { ExpectedOutputInput } from './components/ExpectedOutputInput';
import { ResultPanel } from './components/ResultPanel';
import { optimizePrompt, type ModelId, type OptimizerState } from './lib/api';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelId>('claude-sonnet-4-6');
  const [intent, setIntent] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizerState | null>(null);

  const canSubmit = prompt.trim().length > 0 && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = Number.parseInt(expectedOutput, 10);
      const data = await optimizePrompt({
        prompt: prompt.trim(),
        originalModel: model,
        intent: intent.trim() || undefined,
        expectedOutputTokens: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Prompt Cost Optimizer</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Cole um prompt, escolha o modelo que você usa, descubra se dá para gastar menos.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <PromptInput value={prompt} onChange={setPrompt} disabled={loading} />
          <ModelSelector value={model} onChange={setModel} disabled={loading} />
          <IntentInput value={intent} onChange={setIntent} disabled={loading} />
          <ExpectedOutputInput
            value={expectedOutput}
            onChange={setExpectedOutput}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {loading ? 'Otimizando...' : 'Otimizar'}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8">
            <ResultPanel state={result} />
          </div>
        )}
      </main>
    </div>
  );
}
