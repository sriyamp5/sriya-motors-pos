import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button.jsx';

/**
 * Dialog rendered above the page. Escape closes it unless `busy` is set,
 * and focus moves into the dialog when it opens.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  busy = false,
  initialFocus = true,
}) {
  const dialogRef = useRef(null);
  // Latest close handler and busy flag, read by the key listener without re-subscribing.
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation();
        closeRef.current?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Move focus into the dialog only when it opens, never while the user is typing.
  useEffect(() => {
    if (!open || !initialFocus) return undefined;
    const timer = setTimeout(() => {
      const target = dialogRef.current?.querySelector(
        '[data-autofocus], input:not([disabled]), select, textarea, button.btn-primary',
      );
      target?.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, [open, initialFocus]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} disabled={busy} aria-label="Close" />
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation dialog for destructive or important actions.
 * `onConfirm` may be async; the dialog stays open and shows progress until it settles.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // The caller reports the error; keep the dialog open so the user can retry or cancel.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        {danger && (
          <div className="stat-icon danger">
            <AlertTriangle size={20} />
          </div>
        )}
        <div className="text-2">{message}</div>
      </div>
    </Modal>
  );
}
