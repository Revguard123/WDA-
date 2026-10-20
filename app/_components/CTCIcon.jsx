const paths = {
  discovery: <><path d="M14.2 4.2A7.5 7.5 0 0 0 3.7 14L2.4 18l4.1-1.5" /><path d="M21.5 12.5a7.5 7.5 0 1 0-4.4 6.8L22 21l-1.6-4.9a7.5 7.5 0 0 0 1.1-3.6Z" /><circle cx="11" cy="12.5" r=".65" fill="currentColor" stroke="none" /><circle cx="14" cy="12.5" r=".65" fill="currentColor" stroke="none" /><circle cx="17" cy="12.5" r=".65" fill="currentColor" stroke="none" /></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 8h8M8 12h5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  target: <><path d="M12.2 19.3a9 9 0 1 1 7.1-7.1" /><path d="M10.7 16.1a5.6 5.6 0 1 1 5.4-5.4" /><path d="M9.7 12.9a2.5 2.5 0 1 1 3.2-3.2" /><path d="m11 11 3.2 10.3 2.1-3.1 3.2 3.2 2-2-3.2-3.2 3.1-2.1L11 11Z" /></>,
  briefcase: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6V4h8v2M3 12h18" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  externalLink: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m8 12 3 3 5-6" /></>,
  edit: <><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M9 12h12m-4-4 4 4-4 4" /></>,
  sidebarCollapse: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16m7-11-3 3 3 3" /></>,
  sidebarExpand: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16m4-11 3 3-3 3" /></>,
};

export default function CTCIcon({ name, className = '' }) {
  return <svg className={`ctc-icon ${className}`.trim()} width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.target}</svg>;
}
