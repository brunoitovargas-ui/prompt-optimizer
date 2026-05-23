type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function ExpectedOutputInput({ value, onChange, disabled }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">
        Tokens de saída esperados <span className="text-neutral-400">(opcional, default 1024)</span>
      </span>
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white p-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:opacity-50"
        placeholder="Ex.: 100 se a resposta costuma ser curta"
      />
      <span className="mt-1 block text-xs text-neutral-500">
        Quanto a resposta da sua chamada real costuma ter. Afeta a estimativa de economia.
      </span>
    </label>
  );
}
