type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function IntentInput({ value, onChange, disabled }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">
        Intenção <span className="text-neutral-400">(opcional)</span>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white p-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:opacity-50"
        placeholder="O que o prompt deve produzir? Ex.: extrair CNPJ de um e-mail."
      />
    </label>
  );
}
