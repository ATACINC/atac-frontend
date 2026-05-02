import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, F } from '../theme';
import { ToastContext } from './toastContext';

const tones = {
  success: {
    color: C.teal2,
    bg: '#0A1A12',
    border: 'rgba(34,181,137,0.4)',
  },
  error: {
    color: '#E05C52',
    bg: '#1A0A0A',
    border: 'rgba(224,92,82,0.4)',
  },
  warning: {
    color: C.amber,
    bg: '#241707',
    border: 'rgba(212,133,26,0.42)',
  },
  info: {
    color: C.gold,
    bg: '#171308',
    border: 'rgba(201,168,76,0.36)',
  },
};

function normalizeOptions(options) {
  if (typeof options === 'boolean') return { type: options ? 'error' : 'success' };
  return options || {};
}

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 'min(420px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const tone = tones[toast.type] || tones.info;
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 12,
              overflow: 'hidden',
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderRadius: 4,
              boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
              color: tone.color,
              fontFamily: F.body,
              pointerEvents: 'auto',
              animation: 'toast-in 0.24s ease both',
            }}
          >
            <div style={{ width: 3, background: tone.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, padding: '12px 0' }}>
              {toast.title && (
                <div
                  style={{
                    marginBottom: 4,
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {toast.title}
                </div>
              )}
              <div
                style={{
                  color: tone.color,
                  fontSize: 12,
                  lineHeight: 1.5,
                  letterSpacing: '0.03em',
                  wordBreak: 'break-word',
                }}
              >
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
              style={{
                alignSelf: 'flex-start',
                margin: '8px 8px 0 0',
                width: 24,
                height: 24,
                border: 'none',
                background: 'transparent',
                color: C.muted,
                cursor: 'pointer',
                fontFamily: F.body,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    if (document.getElementById('agcx-toast-kf')) return;
    const style = document.createElement('style');
    style.id = 'agcx-toast-kf';
    style.textContent = '@keyframes toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, options) => {
    if (!message) return null;

    const opts = normalizeOptions(options);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = opts.duration ?? 4200;
    const nextToast = {
      id,
      message,
      title: opts.title || '',
      type: opts.type || 'success',
    };

    setToasts((current) => [...current.slice(-3), nextToast]);

    if (duration > 0) {
      const timer = setTimeout(() => dismissToast(id), duration);
      timers.current.set(id, timer);
    }

    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({
    showToast,
    dismissToast,
    success: (message, options) => showToast(message, { ...options, type: 'success' }),
    error: (message, options) => showToast(message, { ...options, type: 'error' }),
    warning: (message, options) => showToast(message, { ...options, type: 'warning' }),
    info: (message, options) => showToast(message, { ...options, type: 'info' }),
  }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
