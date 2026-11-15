import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const DURATION = { success: 3500, info: 4500, warning: 6000, error: 7000 };

/** Short-lived notifications shown at the bottom right of the screen. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, title, message) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, type, title, message }]);
      setTimeout(() => dismiss(id), DURATION[type]);
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (title, message) => show('success', title, message),
      error: (title, message) => show('error', title, message),
      warning: (title, message) => show('warning', title, message),
      info: (title, message) => show('info', title, message),
      /** Shows an API or unexpected error with a sensible title. */
      fromError: (error, title = 'Something went wrong') => show('error', title, error?.message ?? String(error)),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={19} className="toast-icon" />
              <div className="grow">
                <div className="toast-title">{t.title}</div>
                {t.message && <div className="toast-message">{t.message}</div>}
              </div>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
