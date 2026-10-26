'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { containDialog } from '../../lib/dialog.js';
import { UI } from '../../lib/ui.js';

// Precise, background-free marks that match the product's bold, clean voice.
export function ModalArtwork({ kind = 'restart' }) {
  return (
    <svg className="wda-popup-art" viewBox="0 0 64 64" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === 'success' ? (
        <><circle cx="32" cy="32" r="23" stroke={UI.orange} /><path d="m21 32 8 8 15-17" stroke={UI.pink} /></>
      ) : kind === 'feedback' ? (
        <><path d="M17 11h30a7 7 0 0 1 7 7v23a7 7 0 0 1-7 7H29L16 57v-9a7 7 0 0 1-7-7V18a7 7 0 0 1 8-7Z" stroke={UI.pink} /><path d="M21 24h22M21 35h14" stroke={UI.orange} /></>
      ) : (
        <><path d="M13 22a23 23 0 1 1-2 17" stroke={UI.pink} /><path d="M12 9v15h15" stroke={UI.orange} /></>
      )}
    </svg>
  );
}

export function ModalPanel({ title, description, titleId, descriptionId, kind = 'restart', form = false, busy = false, onClose, children, panelRef }) {
  return (
    <div className="wda-popup-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section ref={panelRef} className={`wda-popup${form ? ' wda-popup-form' : ''}`} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
        <button data-liquid="" className="wda-popup-close" type="button" onClick={onClose} disabled={busy} aria-label="Close dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg>
        </button>
        <div className="wda-popup-body">
          <ModalArtwork kind={kind} />
          <h2 className="wda-popup-title" id={titleId}>{title}</h2>
          <p className="wda-popup-description" id={descriptionId}>{description}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

export default function Modal({ open, onClose, busy = false, ...props }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const latest = useRef({ busy, onClose });
  latest.current = { busy, onClose };
  const id = useId();
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open || !mounted || !panelRef.current) return;
    return containDialog(panelRef.current, document, () => latest.current);
  }, [open, mounted]); // Typing or changing sending state must not reset focus.
  if (!open || !mounted) return null;
  return createPortal(<ModalPanel {...props} titleId={`${id}-title`} descriptionId={`${id}-description`}
    busy={busy} onClose={() => { if (!latest.current.busy) latest.current.onClose(); }} panelRef={panelRef} />, document.body);
}
