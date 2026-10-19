import { useState, useRef } from 'react';
import { Tag, Plus, X } from 'lucide-react';

interface Props {
  labels: string[];
  onChange: (labels: string[]) => void;
  availableLabels?: string[];
  placeholder?: string;
  helperText?: string;
  autoFocus?: boolean;
}

export default function LabelInput({
  labels,
  onChange,
  availableLabels = [],
  placeholder = 'הקלד תגית ולחץ Enter...',
  helperText,
  autoFocus
}: Props) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addLabel = (label: string) => {
    const trimmed = label.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!labels.includes(trimmed)) {
      onChange([...labels, trimmed]);
    }
    setInputVal('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const removeLabel = (labelToRemove: string) => {
    onChange(labels.filter(l => l !== labelToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addLabel(inputVal);
    }
  };

  // Suggestions that aren't already selected
  const suggestions = availableLabels.filter(l => !labels.includes(l));

  return (
    <div className="space-y-2 text-right">
      {/* Existing Labels Pills */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
        {labels.map(label => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-lg animate-in zoom-in-95 duration-150 shadow-xs"
          >
            <Tag size={11} className="text-indigo-500" />
            <span>{label}</span>
            <button
              type="button"
              onClick={() => removeLabel(label)}
              className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-100 transition-colors"
              title={`הסר תגית "${label}"`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {labels.length === 0 && (
          <span className="text-xs text-gray-400 italic">טרם הוגדרו תגיות</span>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right"
          />
          <Tag size={13} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={() => addLabel(inputVal)}
          disabled={!inputVal.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs p-2 rounded-xl transition-all shadow-sm flex items-center gap-1"
          title="הוסף תגית (Enter)"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Suggestions if available */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-gray-500 font-bold">הצעות מהאירוע:</span>
          {suggestions.slice(0, 10).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => addLabel(s)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors shadow-2xs"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {helperText && <p className="text-[11px] text-gray-400">{helperText}</p>}
    </div>
  );
}
