import { useState } from 'react';
import type { OptimizerState } from '../lib/api';

const VERDICT_STYLE: Record<OptimizerState['savings']['verdict'], string> = {
  recommended: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  borderline: 'bg-amber-50 text-amber-900 border-amber-200',
  not_worth: 'bg-rose-50 text-rose-900 border-rose-200',
};

const VERDICT_LABEL: Record<OptimizerState['savings']['verdict'], string> = {
  recommended: 'Vale otimizar',
  borderline: 'Marginal',
  not_worth: 'Não compensa',
};

function fmtUsd(n: number, digits = 6) {
  return `$${n.toFixed(digits)}`;
}

function fmtUsdSmart(n: number) {
  if (Math.abs(n) >= 1) return fmtUsd(n, 2);
  if (Math.abs(n) >= 0.01) return fmtUsd(n, 4);
  return fmtUsd(n, 6);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignora */
        }
      }}
      className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
    >
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

function PromptCard({
  title,
  body,
  tokens,
  tone,
  action,
}: {
  title: string;
  body: string;
  tokens: number;
  tone: 'original' | 'refined';
  action?: React.ReactNode;
}) {
  const bg = tone === 'refined' ? 'bg-neutral-900 text-neutral-100' : 'bg-neutral-50 text-neutral-800';
  return (
    <div className="flex flex-col rounded-md border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">{tokens} tokens</span>
          {action}
        </div>
      </header>
      <pre className={`m-0 flex-1 whitespace-pre-wrap break-words p-3 font-mono text-xs ${bg}`}>
        {body}
      </pre>
    </div>
  );
}

export function ResultPanel({ state }: { state: OptimizerState }) {
  const { classification, selectedModel, refined, savings, shortCircuit, prompt } = state;
  const [runsPerMonth, setRunsPerMonth] = useState('1000');

  const runs = Math.max(0, Number.parseInt(runsPerMonth, 10) || 0);
  const netMonth = runs * savings.savingsPerRun - savings.optimizerCost;
  const netYear = netMonth * 12;

  const reduction = refined
    ? Math.round((1 - refined.inputTokens / refined.originalInputTokens) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Hero: verdict + economia destacada */}
      <section className={`rounded-md border p-5 ${VERDICT_STYLE[savings.verdict]}`}>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {VERDICT_LABEL[savings.verdict]}
          </span>
          <span className="text-xs">
            paga em{' '}
            {Number.isFinite(savings.breakevenRuns) ? savings.breakevenRuns.toFixed(1) : '∞'} execuções
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {fmtUsdSmart(savings.savingsPerRun)}
          </span>
          <span className="text-sm">economia por execução</span>
        </div>
        <p className="mt-2 text-xs opacity-80">
          {fmtUsdSmart(savings.originalCostPerRun)} → {fmtUsdSmart(savings.optimizedCostPerRun)}
        </p>
      </section>

      {/* Projeção mensal */}
      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-700">Projeção</h3>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">execuções/mês</span>
            <input
              type="number"
              min={0}
              step={100}
              value={runsPerMonth}
              onChange={(e) => setRunsPerMonth(e.target.value)}
              className="w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-right text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </label>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-neutral-500">Economia mensal bruta</dt>
          <dd className="font-mono tabular-nums">{fmtUsdSmart(runs * savings.savingsPerRun)}</dd>
          <dt className="text-neutral-500">Custo do otimizador (uma vez)</dt>
          <dd className="font-mono tabular-nums">−{fmtUsdSmart(savings.optimizerCost)}</dd>
          <dt className="font-medium text-neutral-700">Líquido no 1º mês</dt>
          <dd
            className={`font-mono tabular-nums font-medium ${
              netMonth >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {netMonth >= 0 ? '+' : ''}
            {fmtUsdSmart(netMonth)}
          </dd>
          <dt className="text-neutral-500">Projeção anual</dt>
          <dd className="font-mono tabular-nums">
            {netYear >= 0 ? '+' : ''}
            {fmtUsdSmart(netYear)}
          </dd>
        </dl>
      </section>

      {/* Comparação de prompts lado a lado */}
      {refined && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-neutral-700">Prompts</h3>
            {reduction !== null && (
              <span className="text-xs text-neutral-500">
                {refined.originalInputTokens} → {refined.inputTokens} tokens
                {reduction > 0 && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                    −{reduction}%
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PromptCard
              title="Original"
              body={prompt}
              tokens={refined.originalInputTokens}
              tone="original"
            />
            <PromptCard
              title="Reescrito"
              body={refined.prompt}
              tokens={refined.inputTokens}
              tone="refined"
              action={<CopyButton text={refined.prompt} />}
            />
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-neutral-200 bg-white p-2">
              <dt className="text-neutral-500">Formato</dt>
              <dd className="mt-0.5 font-mono">{refined.outputFormat}</dd>
            </div>
            <div className="rounded border border-neutral-200 bg-white p-2">
              <dt className="text-neutral-500">max_tokens</dt>
              <dd className="mt-0.5 font-mono">{refined.maxTokens}</dd>
            </div>
            <div className="rounded border border-neutral-200 bg-white p-2">
              <dt className="text-neutral-500">Modelo sugerido</dt>
              <dd className="mt-0.5 font-mono">{selectedModel?.model}</dd>
            </div>
          </dl>
        </section>
      )}

      {!refined && !shortCircuit && (
        <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          Prompt já está enxuto e o modelo sugerido é o mesmo do declarado — pulando reescrita para
          não gastar otimizador à toa.
        </section>
      )}

      {shortCircuit && (
        <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          Curto-circuito: o classificador acredita que essa tarefa não precisa de LLM. As etapas de
          escolha de modelo e reescrita foram puladas.
        </section>
      )}

      {/* Diagnóstico */}
      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">Diagnóstico</h3>
          <span className="text-xs text-neutral-500">
            {classification.recommendation} · {(classification.confidence * 100).toFixed(0)}% confiança
          </span>
        </div>
        <p className="mt-3 text-sm text-neutral-600">{classification.reasoning}</p>
        {classification.alternative && (
          <p className="mt-2 text-sm text-neutral-700">
            <span className="font-medium">Alternativa:</span> {classification.alternative}
          </p>
        )}
        {selectedModel && (
          <p className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
            <span className="font-medium text-neutral-700">Por que {selectedModel.model}:</span>{' '}
            {selectedModel.reasoning}
          </p>
        )}
      </section>

      {/* Custo do otimizador */}
      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
            Custo deste otimizador: {fmtUsdSmart(savings.optimizerCost)}
          </summary>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-1">Step</th>
                <th>Modelo</th>
                <th className="text-right">In</th>
                <th className="text-right">Out</th>
                <th className="text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {state.optimizerCost.breakdown.map((b) => (
                <tr key={b.step} className="border-t border-neutral-100">
                  <td className="py-1 font-mono">{b.step}</td>
                  <td className="font-mono">{b.model}</td>
                  <td className="text-right tabular-nums">{b.inputTokens}</td>
                  <td className="text-right tabular-nums">{b.outputTokens}</td>
                  <td className="text-right font-mono tabular-nums">{fmtUsd(b.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
