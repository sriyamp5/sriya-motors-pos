import { Loader2 } from 'lucide-react';

/**
 * @param {'default'|'primary'|'accent'|'danger'|'ghost'|'soft'|'soft-danger'} variant
 * @param {'sm'|'md'|'lg'|'xl'} size
 */
export function Button({
  variant = 'default',
  size = 'md',
  icon: Icon,
  loading = false,
  block = false,
  iconOnly = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = [
    'btn',
    variant !== 'default' && `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    block && 'btn-block',
    iconOnly && 'btn-icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 15 : size === 'lg' || size === 'xl' ? 20 : 17;

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={iconSize} className="spin" /> : Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
}
