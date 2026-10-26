// Keep focus and scroll inside an open popup, without touching form state.
export function containDialog(dialog, doc, getOptions) {
  const previousFocus = doc.activeElement;
  const previousOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';
  const focusable = () => [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
    .filter((element) => !element.disabled && element.tabIndex >= 0 && !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length);
  const focusFirst = () => (dialog.querySelector('[data-modal-autofocus]:not(:disabled)') || focusable()[0] || dialog).focus();
  const keydown = (event) => {
    if (event.key === 'Escape') {
      // An open combobox handles the first Escape; the next closes the dialog.
      const dropdown = event.target?.closest?.('[data-dropdown-open="true"]');
      if (dropdown && dialog.contains(dropdown)) return;
      event.preventDefault();
      event.stopPropagation();
      const { busy, onClose } = getOptions();
      if (!busy) onClose();
    }
    if (event.key !== 'Tab') return;
    const elements = focusable();
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) {
      event.preventDefault();
      dialog.focus();
    } else if (event.shiftKey && (doc.activeElement === first || doc.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (doc.activeElement === last || doc.activeElement === dialog)) {
      event.preventDefault();
      first.focus();
    }
  };
  const focusin = (event) => {
    if (!dialog.contains(event.target)) focusFirst();
  };
  focusFirst();
  doc.addEventListener('keydown', keydown, true);
  doc.addEventListener('focusin', focusin);
  return () => {
    doc.removeEventListener('keydown', keydown, true);
    doc.removeEventListener('focusin', focusin);
    doc.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus();
  };
}
