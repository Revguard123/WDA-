'use client';

import { useEffect, useId, useRef, useState } from 'react';

// Select-only combobox: exploring the list does not change the saved value.
// Focus stays on the trigger so this also works inside a trapped-focus dialog.
export default function Select({ id, name, value, onChange, options, disabled = false, placeholder = 'Choose an option', ...ariaProps }) {
  const generatedId = useId();
  const controlId = id || `wda-select-${generatedId}`;
  const listId = `${controlId}-options`;
  const items = options.map((option) => typeof option === 'string' ? { value: option, label: option } : option);
  const selected = items.findIndex((option) => option.value === value);
  const available = items.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef(null);
  const menu = useRef(null);
  const trigger = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const enabled = !disabled && available.length > 0;
  const expanded = open && enabled;
  const activeId = expanded && available.includes(active) ? `${listId}-${active}` : undefined;

  function close() {
    setOpen(false);
    search.current = { text: '', time: 0 };
  }

  function show(index = available.includes(selected) ? selected : available[0]) {
    if (!enabled) return;
    setActive(index);
    setOpen(true);
  }

  function commit(index) {
    if (available.includes(index) && items[index].value !== value) onChange(items[index].value);
    close();
  }

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!expanded) return undefined;
    const panel = menu.current;
    const button = trigger.current;
    const doc = button.ownerDocument;
    const view = doc.defaultView;
    let topLayer = false;

    // The top layer escapes modal overflow without portalling the list outside
    // its dialog. Older browsers use an in-flow list, which cannot be clipped.
    function position() {
      const rect = button.getBoundingClientRect();
      const viewport = view.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 12;
      const topEdge = (viewport?.offsetTop || 0) + 12;
      const rightEdge = leftEdge + (viewport?.width || view.innerWidth) - 24;
      const bottomEdge = topEdge + (viewport?.height || view.innerHeight) - 24;
      const below = bottomEdge - rect.bottom - 8;
      const above = rect.top - topEdge - 8;
      const upwards = below < 180 && above > below;
      const height = Math.max(44, Math.min(320, upwards ? above : below));
      panel.style.width = `${Math.max(0, Math.min(rect.width, rightEdge - leftEdge))}px`;
      panel.style.maxHeight = `${height}px`;
      const actualHeight = Math.min(panel.scrollHeight, height);
      panel.style.left = `${Math.max(leftEdge, Math.min(rect.left, rightEdge - panel.offsetWidth))}px`;
      panel.style.top = `${Math.max(topEdge, upwards ? rect.top - actualHeight - 8 : rect.bottom + 8)}px`;
      panel.dataset.placement = upwards ? 'above' : 'below';
    }

    if (typeof panel.showPopover === 'function') {
      try {
        panel.setAttribute('popover', 'manual');
        panel.dataset.topLayer = 'true';
        panel.showPopover();
        position();
        topLayer = true;
      } catch {
        panel.removeAttribute('popover');
        delete panel.dataset.topLayer;
      }
    }
    const outside = (event) => { if (!root.current?.contains(event.target)) close(); };
    const reposition = (event) => {
      if (event?.target === panel) return;
      position();
    };
    const observer = topLayer && typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(position) : null;
    observer?.observe(button);
    if (topLayer) {
      view.addEventListener('resize', reposition);
      doc.addEventListener('scroll', reposition, true);
      view.visualViewport?.addEventListener('resize', reposition);
      view.visualViewport?.addEventListener('scroll', reposition);
    }
    doc.addEventListener('pointerdown', outside);
    return () => {
      doc.removeEventListener('pointerdown', outside);
      doc.removeEventListener('scroll', reposition, true);
      view.removeEventListener('resize', reposition);
      view.visualViewport?.removeEventListener('resize', reposition);
      view.visualViewport?.removeEventListener('scroll', reposition);
      observer?.disconnect();
      if (topLayer && panel.matches(':popover-open')) panel.hidePopover();
    };
  }, [expanded]);

  useEffect(() => {
    if (activeId) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId, active]);

  function keyDown(event) {
    if (!enabled) return;
    const { key } = event;
    if (key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (key === 'Tab' && expanded) {
      commit(active); // Let the browser/dialog move focus normally.
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      const last = available.length - 1;
      const next = key === 'Home' ? available[0] : key === 'End' ? available[last]
        : expanded ? available[Math.max(0, Math.min(last, available.indexOf(active) + (key === 'ArrowDown' ? 1 : -1)))]
          : available.includes(selected) ? selected : available[key === 'ArrowUp' ? last : 0];
      show(next);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault(); // Never submit the surrounding form.
      if (expanded) commit(active);
      else show();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : '') + key.toLocaleLowerCase();
      search.current = { text, time: now };
      const prefix = [...text].every((character) => character === text[0]) ? text[0] : text;
      const start = expanded ? active : selected;
      const sequence = [...available.filter((index) => index > start), ...available.filter((index) => index <= start)];
      const match = sequence.find((index) => String(items[index].label).toLocaleLowerCase().startsWith(prefix));
      show(match ?? (expanded ? active : available.includes(selected) ? selected : available[0]));
    }
  }

  return (
    <div className="wda-select" ref={root} data-dropdown-open={expanded || undefined}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { if (expanded) commit(active); else close(); } }}>
      {name ? <input type="hidden" name={name} value={value ?? ''} disabled={disabled} /> : null}
      <button {...ariaProps} ref={trigger} id={controlId} type="button" className="wda-select-trigger"
        role="combobox" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={activeId} disabled={!enabled} onKeyDown={keyDown}
        onClick={() => expanded ? close() : show()}>
        <span>{selected >= 0 ? items[selected].label : placeholder}</span>
        <svg className="wda-select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
      {expanded ? <div ref={menu} id={listId} role="listbox" aria-labelledby={controlId} className="wda-select-menu">
        {items.map((item, index) => <div key={item.value} id={`${listId}-${index}`} data-index={index}
          role="option" aria-selected={index === selected} aria-disabled={item.disabled || undefined}
          className={`wda-select-option${index === active ? ' is-active' : ''}`}
          onPointerDown={(event) => event.preventDefault()}
          onPointerMove={() => { if (!item.disabled && active !== index) setActive(index); }}
          onClick={() => { if (!item.disabled) { commit(index); trigger.current?.focus(); } }}>
          <span>{item.label}</span>
          {index === selected ? <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="m4 10 4 4 8-8" /></svg> : null}
        </div>)}
      </div> : null}
    </div>
  );
}
