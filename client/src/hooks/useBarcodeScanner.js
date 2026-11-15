import { useEffect, useRef } from 'react';

/**
 * Detects input from a USB barcode scanner.
 *
 * Scanners behave like a keyboard that types very fast and ends with Enter.
 * Keystrokes arriving less than MAX_KEY_GAP_MS apart are collected; when
 * Enter arrives and at least MIN_LENGTH characters were typed quickly, the
 * code is reported. Normal human typing is ignored, so the screen works the
 * same with or without a scanner, and a faulty scanner cannot block it.
 *
 * Scans are captured even while another input has focus (for example the
 * quantity box), except in inputs marked with data-scanner="ignore".
 */
const MAX_KEY_GAP_MS = 40;
const MIN_LENGTH = 4;

export function useBarcodeScanner(onScan, { enabled = true } = {}) {
  const buffer = useRef('');
  const lastTime = useRef(0);
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.target?.dataset?.scanner === 'ignore') return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const now = performance.now();
      const gap = now - lastTime.current;
      lastTime.current = now;

      if (event.key === 'Enter') {
        const code = buffer.current;
        buffer.current = '';
        if (code.length >= MIN_LENGTH && gap < MAX_KEY_GAP_MS * 3) {
          event.preventDefault();
          event.stopPropagation();
          // Remove the characters the scanner typed into a focused input.
          const target = event.target;
          if (target instanceof HTMLInputElement && target.value.endsWith(code)) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(target, target.value.slice(0, -code.length));
            target.dispatchEvent(new Event('input', { bubbles: true }));
          }
          handler.current(code);
        }
        return;
      }

      if (event.key.length !== 1) return;
      buffer.current = gap > MAX_KEY_GAP_MS ? event.key : buffer.current + event.key;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}
