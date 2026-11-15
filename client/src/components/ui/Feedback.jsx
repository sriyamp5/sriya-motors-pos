import { Loader2, Inbox, Info, AlertTriangle, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function Badge({ tone = 'default', children, icon: Icon }) {
  return (
    <span className={`badge ${tone !== 'default' ? `badge-${tone}` : ''}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

export function Loader({ label = 'Loading...' }) {
  return (
    <div className="loader">
      <Loader2 size={20} className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={24} />
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Inline error with a retry button, used when a list or page fails to load. */
export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        <XCircle size={24} />
      </div>
      <h3>Could not load data</h3>
      <p>{error?.message ?? 'Unexpected error'}</p>
      {onRetry && (
        <Button className="mt-2" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const ALERT_ICONS = { info: Info, warning: AlertTriangle, danger: XCircle, success: CheckCircle2 };

export function Alert({ tone = 'info', title, children }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert ${tone !== 'info' ? `alert-${tone}` : ''}`}>
      <Icon size={18} />
      <div>
        {title && <div className="strong">{title}</div>}
        {children && <div className="text-2 small">{children}</div>}
      </div>
    </div>
  );
}
