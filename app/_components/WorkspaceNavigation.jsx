'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CTCIcon from './CTCIcon.jsx';

export const SIDEBAR_STORAGE_KEY = 'wda:sidebar-collapsed';
const NavigationContext = createContext(null);

// Only chrome state is client-side; page content and authenticated identity
// remain server-rendered children. Preferences contain no account credentials.
export default function WorkspaceNavigation({ className, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarHint, setSidebarHint] = useState(null);
  const rootRef = useRef(null);
  const accountTriggerRef = useRef(null);
  const hintDelay = useRef(null);
  const describedControl = useRef(null);

  function unlinkHint() {
    const node = describedControl.current;
    const remaining = node?.getAttribute?.('aria-describedby')?.split(/\s+/).filter((id) => id && id !== 'workspace-sidebar-hint').join(' ');
    if (remaining) node.setAttribute('aria-describedby', remaining);
    else node?.removeAttribute?.('aria-describedby');
    describedControl.current = null;
  }

  function hideSidebarHint(immediate = false) {
    window.clearTimeout(hintDelay.current);
    const hide = () => {
      unlinkHint();
      setSidebarHint((current) => current?.visible ? { ...current, visible: false } : current);
    };
    if (immediate) hide();
    else hintDelay.current = window.setTimeout(hide, 120);
  }

  function showSidebarHint(button, { label = 'Toggle sidebar', shortcut = 'Ctrl+Shift+S', detail = '', tone, kind = 'toggle', focusTarget = button } = {}) {
    if (window.matchMedia('(max-width: 600px)').matches) return;
    window.clearTimeout(hintDelay.current);
    unlinkHint();
    const descriptions = new Set((focusTarget.getAttribute?.('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.add('workspace-sidebar-hint');
    focusTarget.setAttribute?.('aria-describedby', [...descriptions].join(' '));
    describedControl.current = focusTarget;
    const rect = button.getBoundingClientRect();
    const railRight = rootRef.current?.querySelector('#workspace-navigation')?.getBoundingClientRect?.().right || 0;
    setSidebarHint({
      visible: true, label, shortcut, detail, tone, kind,
      left: Math.max(12, Math.min(Math.max(rect.right, railRight) + 10, window.innerWidth - 280)),
      top: Math.max(36, Math.min(rect.top + rect.height / 2, window.innerHeight - 36)),
    });
  }

  useEffect(() => () => { window.clearTimeout(hintDelay.current); unlinkHint(); }, []);

  useEffect(() => {
    hideSidebarHint(true);
    if (!collapsed) return undefined;
    const root = rootRef.current;
    const rail = root?.querySelector('#workspace-navigation');
    if (!rail) return undefined;
    const controlFor = (event) => {
      const control = event.target?.closest?.('[data-sidebar-hint]');
      return control && rail.contains(control) ? control : null;
    };
    const show = (event) => {
      if (event.pointerType === 'touch' || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const control = controlFor(event);
      if (!control || (event.type === 'pointerover' && control.contains(event.relatedTarget))) return;
      const theme = control.querySelector('input[role="switch"]');
      showSidebarHint(control, {
        kind: 'control', label: control.getAttribute('data-sidebar-hint'), shortcut: '',
        detail: theme ? `Switch to ${theme.checked ? 'light' : 'dark'} mode` : control.getAttribute('data-sidebar-hint-detail') || '',
        tone: control.getAttribute('data-sidebar-hint-tone'),
        focusTarget: event.type === 'focusin' ? event.target : theme || control,
      });
    };
    const leave = (event) => {
      const control = controlFor(event);
      if (control && !control.contains(event.relatedTarget)) hideSidebarHint(event.type === 'focusout');
    };
    const click = () => hideSidebarHint(true);
    // Native delegation also catches the global theme switch, portalled into
    // this rail by a different React tree. No duplicated menus or handlers.
    root.addEventListener('pointerover', show);
    root.addEventListener('pointerout', leave);
    root.addEventListener('focusin', show);
    root.addEventListener('focusout', leave);
    root.addEventListener('change', show);
    root.addEventListener('click', click);
    return () => {
      root.removeEventListener('pointerover', show);
      root.removeEventListener('pointerout', leave);
      root.removeEventListener('focusin', show);
      root.removeEventListener('focusout', leave);
      root.removeEventListener('change', show);
      root.removeEventListener('click', click);
    };
  }, [collapsed]);

  useEffect(() => {
    const shortcut = (event) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') hideSidebarHint(true);
      if (event.repeat || event.isComposing || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.key?.toLowerCase() !== 's') return;
      if (window.matchMedia('(max-width: 600px)').matches || document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) return;
      if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      event.preventDefault();
      hideSidebarHint(true);
      toggleSidebar();
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [collapsed]);

  useEffect(() => {
    if (!sidebarHint?.visible) return undefined;
    const hide = () => hideSidebarHint(true);
    window.addEventListener('resize', hide);
    document.addEventListener('scroll', hide, true);
    return () => { window.removeEventListener('resize', hide); document.removeEventListener('scroll', hide, true); };
  }, [sidebarHint?.visible]);

  useEffect(() => {
    const restore = () => {
      try { setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'); } catch {}
    };
    restore();
    const sync = (event) => { if (event.key === SIDEBAR_STORAGE_KEY || event.key === null) restore(); };
    window.addEventListener('storage', sync);
    const mobile = window.matchMedia('(max-width: 600px)');
    const resize = () => { if (!mobile.matches) setAccountOpen(false); };
    mobile.addEventListener('change', resize);
    return () => { window.removeEventListener('storage', sync); mobile.removeEventListener('change', resize); };
  }, []);

  useEffect(() => {
    const rail = rootRef.current?.querySelector('#workspace-navigation');
    if (!rail) return undefined;
    const mobile = window.matchMedia('(max-width: 600px)');
    const sync = () => {
      // The closing panel stays painted for its exit transition, but must stop
      // accepting focus/clicks immediately. Desktop navigation stays available.
      const hidden = mobile.matches && !accountOpen;
      rail.inert = hidden;
      if (hidden) rail.setAttribute('aria-hidden', 'true');
      else rail.removeAttribute('aria-hidden');
    };
    sync();
    mobile.addEventListener('change', sync);
    return () => {
      mobile.removeEventListener('change', sync);
      rail.inert = false;
      rail.removeAttribute('aria-hidden');
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const panel = rootRef.current?.querySelector('#workspace-account-panel');
    const inAccount = (target) => accountTriggerRef.current?.contains(target) || panel?.contains(target);
    const hasDialog = () => document.querySelector('[role="dialog"][aria-modal="true"]');
    const outside = (event) => { if (!hasDialog() && !inAccount(event.target)) setAccountOpen(false); };
    const escape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || hasDialog()) return;
      event.preventDefault();
      event.stopPropagation();
      setAccountOpen(false);
      accountTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0'); } catch {}
  };

  return <NavigationContext.Provider value={{ collapsed, toggleSidebar, accountOpen, setAccountOpen, accountTriggerRef, showSidebarHint, hideSidebarHint, sidebarHintOpen: !!sidebarHint?.visible && sidebarHint.kind === 'toggle' }}>
    <div ref={rootRef} className={className} data-sidebar-collapsed={collapsed || undefined} data-account-open={accountOpen || undefined}
      onClick={(event) => { if (accountOpen && event.target.closest?.('a[href]')) setAccountOpen(false); }}>
      {children}
      {sidebarHint ? createPortal(<div id="workspace-sidebar-hint" role="tooltip" className="wda-sidebar-hint"
        data-open={sidebarHint.visible || undefined} data-tone={sidebarHint.tone || undefined} aria-hidden={!sidebarHint.visible}
        style={{ left: sidebarHint.left, top: sidebarHint.top }}
        onPointerEnter={() => { window.clearTimeout(hintDelay.current); setSidebarHint((current) => ({ ...current, visible: true })); }}
        onPointerLeave={() => hideSidebarHint()}>
        <div className="wda-sidebar-hint-copy"><span>{sidebarHint.label}</span>{sidebarHint.detail ? <small>{sidebarHint.detail}</small> : null}</div>
        {sidebarHint.shortcut ? <kbd>{sidebarHint.shortcut}</kbd> : null}
      </div>, document.body) : null}
    </div>
  </NavigationContext.Provider>;
}

export function SidebarToggle() {
  const { collapsed, toggleSidebar, showSidebarHint, hideSidebarHint, sidebarHintOpen } = useContext(NavigationContext);
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return <button data-liquid="" className="wda-sidebar-toggle" type="button" onClick={() => { hideSidebarHint(true); toggleSidebar(); }}
    onPointerEnter={(event) => { if (event.pointerType !== 'touch') showSidebarHint(event.currentTarget); }}
    onPointerLeave={() => hideSidebarHint()} onFocus={(event) => showSidebarHint(event.currentTarget)} onBlur={() => hideSidebarHint(true)}
    aria-label={label} aria-keyshortcuts="Control+Shift+S" aria-describedby={sidebarHintOpen ? 'workspace-sidebar-hint' : undefined}
    aria-expanded={!collapsed} aria-controls="workspace-navigation">
    <CTCIcon name={collapsed ? 'sidebarExpand' : 'sidebarCollapse'} />
  </button>;
}

export function MobileAccountToggle({ children }) {
  const { accountOpen, setAccountOpen, accountTriggerRef } = useContext(NavigationContext);
  return <button ref={accountTriggerRef} data-liquid="" className="wda-mobile-account-toggle" type="button"
    aria-label="Account options" title="Account options" aria-expanded={accountOpen} aria-controls="workspace-account-panel"
    onClick={() => setAccountOpen((open) => !open)}>{children}</button>;
}
