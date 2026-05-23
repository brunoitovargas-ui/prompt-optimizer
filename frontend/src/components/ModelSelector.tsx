import type { ModelId } from '../lib/api';

type Props = {
  value: ModelId;
  onChange: (v: ModelId) => void;
  disabled?: boolean;
};

const OPTIONS: { id: ModelId; label: string; price: string }[] = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', price: '$0.80 / $4.00' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', price: '$3.00 / $15.00' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7', price: '$15.00 / $75.00' },
];

export function ModelSelector({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="block">
      <legend className="text-sm font-medium text-neutral-700">Modelo que você usa hoje</legend>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm shadow-sm transition ${
              value === opt.id
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white hover:border-neutral-500'
            } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input
              type="radio"
              name="model"
              value={opt.id}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
              disabled={disabled}
              className="sr-only"
            />
            <span className="font-medium">{opt.label}</span>
            <span className={`text-xs ${value === opt.id ? 'text-neutral-300' : 'text-neutral-500'}`}>
              {opt.price} / 1M
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
