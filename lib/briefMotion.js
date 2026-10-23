// Progressive enhancement: the server-rendered <details> remain usable before
// hydration, without JavaScript, and when motion/animation APIs are unavailable.
export function installBriefMotion(root, view) {
  if (!root) return () => {};
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const records = [];

  function settle(record) {
    const animation = record.animation;
    record.animation = null;
    if (animation) { animation.onfinish = null; animation.cancel(); }
    record.details.open = record.expanded;
    record.content.style.overflow = record.overflow;
    record.content.inert = record.inert;
    if (record.hidden === null) record.content.removeAttribute('aria-hidden');
    else record.content.setAttribute('aria-hidden', record.hidden);
    record.summary.removeAttribute('aria-expanded');
    delete record.details.dataset.briefExpanded;
  }

  function animate(record, expanded) {
    const { details, summary, content } = record;
    // Sample before cancelling, so reversing midway continues from the painted
    // height/opacity instead of snapping to the start of the previous toggle.
    const height = details.open ? content.getBoundingClientRect().height : 0;
    const opacity = details.open ? Number.parseFloat(view.getComputedStyle(content).opacity) : 0;
    const previous = record.animation;
    record.animation = null;
    if (previous) { previous.onfinish = null; previous.cancel(); }
    record.expanded = expanded;
    details.open = true; // Keep closing content painted until its exit finishes.
    details.dataset.briefExpanded = String(expanded);
    summary.setAttribute('aria-expanded', String(expanded));
    content.inert = !expanded;
    content.setAttribute('aria-hidden', String(!expanded));
    if (!expanded && content.contains(content.ownerDocument.activeElement)) summary.focus();
    content.style.overflow = 'hidden';
    const target = expanded ? content.scrollHeight : 0;
    const fraction = Math.min(1, Math.abs(target - height) / Math.max(content.scrollHeight, height, 1));
    try {
      const animation = content.animate([
        { height: `${height}px`, opacity: Number.isFinite(opacity) ? opacity : 1 },
        { height: `${target}px`, opacity: expanded ? 1 : 0 },
      ], {
        duration: Math.max(100, (expanded ? 320 : 240) * fraction),
        easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both',
      });
      record.animation = animation;
      animation.onfinish = () => { if (record.animation === animation) settle(record); };
    } catch {
      settle(record);
    }
  }

  for (const details of root.querySelectorAll('.ctc-brief-section')) {
    const summary = details.querySelector('summary');
    const content = details.querySelector('.ctc-brief-section-content');
    if (!summary || !content || typeof content.animate !== 'function') continue;
    const record = { details, summary, content, animation: null, expanded: details.open,
      overflow: content.style.overflow, inert: content.inert, hidden: content.getAttribute('aria-hidden') };
    record.click = (event) => {
      if (event.defaultPrevented || (event.button !== undefined && event.button !== 0) || reduced.matches) return;
      event.preventDefault(); // Native summary clicks also cover Enter/Space.
      animate(record, !(record.animation ? record.expanded : details.open));
    };
    summary.addEventListener('click', record.click);
    records.push(record);
  }

  // Text remains auto-height at rest, including after viewport/sidebar reflows.
  // If wrapping changes during an opening, retarget the current animation.
  const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver((entries) => {
    for (const record of records) {
      if (record.animation && record.expanded && entries.some((entry) => entry.target === record.content.firstElementChild)) animate(record, true);
    }
  }) : null;
  for (const record of records) if (record.content.firstElementChild) observer?.observe(record.content.firstElementChild);
  const motionChange = () => { if (reduced.matches) for (const record of records) if (record.animation) settle(record); };
  reduced.addEventListener('change', motionChange);
  return () => {
    reduced.removeEventListener('change', motionChange);
    observer?.disconnect();
    for (const record of records) {
      record.summary.removeEventListener('click', record.click);
      if (record.animation) settle(record);
    }
  };
}
