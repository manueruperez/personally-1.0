import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type FieldType = 'number' | 'text';

interface Props {
  value: string | number | null;
  placeholder?: string;
  fieldType?: FieldType;
  className?: string;
  disabled?: boolean;
  onCommit: (next: string | number | null) => Promise<void> | void;
  /** Width cap so a 3-char cell doesn't explode. Default: 'w-16'. */
  widthClass?: string;
  /** Suffix shown after the value (e.g., "s" for seconds). */
  suffix?: string;
}

/**
 * Cell read-only hasta que se clickea → input inline. Enter/blur commit,
 * Escape cancela. Valor vacio → null.
 */
export function EditableCell({
  value,
  placeholder = '—',
  fieldType = 'text',
  className,
  disabled,
  onCommit,
  widthClass = 'w-16',
  suffix,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const displayValue = value == null || value === '' ? placeholder : String(value);

  function begin() {
    if (disabled) return;
    setDraft(value == null ? '' : String(value));
    setEditing(true);
  }

  async function commit() {
    if (saving) return;
    const trimmed = draft.trim();
    let next: string | number | null;
    if (trimmed === '') {
      next = null;
    } else if (fieldType === 'number') {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        setEditing(false);
        return;
      }
      next = n;
    } else {
      next = trimmed;
    }
    const original = value == null ? '' : String(value);
    if ((next === null && original === '') || String(next) === original) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type={fieldType === 'number' ? 'number' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
          if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
        disabled={saving}
        className={cn(
          'rounded border border-input bg-background px-1.5 py-0.5 text-sm font-mono',
          widthClass,
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      disabled={disabled}
      className={cn(
        'rounded px-1.5 py-0.5 text-sm font-mono text-left hover:bg-muted/70 transition-colors',
        widthClass,
        value == null && 'text-muted-foreground italic',
        disabled && 'cursor-default hover:bg-transparent',
        className,
      )}
      title={disabled ? 'No editable' : 'Click para editar'}
    >
      {displayValue}
      {suffix && value != null && <span className="text-muted-foreground ml-0.5">{suffix}</span>}
    </button>
  );
}
