import { forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';

/** Label, control, hint and error message laid out consistently. */
export function Field({ label, required, hint, error, className = '', children, htmlFor }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput(
  { label, required, hint, error, className = '', size, prefix, ...props },
  ref,
) {
  const id = useId();
  const input = (
    <input
      id={id}
      ref={ref}
      className={`input ${size === 'lg' ? 'input-lg' : ''} ${prefix ? 'with-prefix' : ''}`}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className} htmlFor={id}>
      {prefix ? (
        <div className="input-group">
          <span className="input-prefix-text">{prefix}</span>
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  );
});

/** Numeric input for rupee amounts, right aligned with an "Rs." prefix. */
export const MoneyInput = forwardRef(function MoneyInput(props, ref) {
  return (
    <TextInput
      ref={ref}
      prefix="Rs."
      inputMode="decimal"
      autoComplete="off"
      {...props}
      className={`${props.className ?? ''}`}
      onFocus={(e) => {
        e.target.select();
        props.onFocus?.(e);
      }}
    />
  );
});

export function SelectInput({ label, required, hint, error, className = '', options = [], placeholder, ...props }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className} htmlFor={id}>
      <select id={id} className="select" aria-invalid={Boolean(error)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextArea({ label, required, hint, error, className = '', ...props }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className} htmlFor={id}>
      <textarea id={id} className="textarea" aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="switch-track" />
      <span>
        <span className="strong">{label}</span>
        {description && (
          <span className="field-hint" style={{ display: 'block' }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export const SearchInput = forwardRef(function SearchInput(
  { value, onChange, placeholder = 'Search...', className = '', ...props },
  ref,
) {
  return (
    <div className={`input-group ${className}`}>
      <Search size={16} />
      <input
        ref={ref}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...props}
      />
      {value && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon input-suffix"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});

/** Small segmented control for mutually exclusive options. */
export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className={value === optionValue ? 'active' : ''}
          onClick={() => onChange(optionValue)}
        >
          {Icon && <Icon size={15} />}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Converts a label map such as PART_TYPE_LABELS to select options. */
export const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
