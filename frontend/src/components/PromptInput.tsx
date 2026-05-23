type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function PromptInput({ value, onChange, disabled }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">Prompt original</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={10}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:opacity-50"
        placeholder="Cole aqui o prompt que você usa hoje..."
      />
    </label>
  );
}
