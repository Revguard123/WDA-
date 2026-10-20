import Button from './Button.jsx';
import SupportCTA from './SupportCTA.jsx';

const screens = {
  link: {
    eyebrow: 'Access unavailable',
    description: 'This link may be outdated, or your browser may no longer have access. Request a private access link to get back to your workspace.',
    primary: { href: '/access', label: 'Get a fresh access link' },
    secondary: { href: '/portal', label: 'Open my portal' },
    note: 'Use the same email you enrolled with at War Dogs Academy.',
  },
  contract: {
    eyebrow: 'Opportunity unavailable',
    description: 'We could not open this contract for your account. Choose an opportunity from your archive, or restore access using your private email link.',
    primary: { href: '/contracts', label: 'Back to my contracts' },
    secondary: { href: '/access', label: 'Restore access' },
    note: 'Contract breakdowns are available only to the account they were delivered to.',
  },
  account: {
    eyebrow: 'Account not found',
    title: 'Let’s check your email.',
    description: 'We could not find an account for the email below. Check for a typo, or try the address you used to enroll at War Dogs Academy.',
    primary: { href: '/portal', label: 'Try another email' },
    secondary: { href: '/access', label: 'Email my access link' },
    note: 'Still having trouble? Contact support using the email on your enrollment.',
  },
  page: {
    eyebrow: '404 / Page not found',
    title: 'This page isn’t here.',
    description: 'The page may have moved, or the address may be incorrect. Open your portal to continue, or request your private access link.',
    primary: { href: '/portal', label: 'Open my portal' },
    secondary: { href: '/access', label: 'Get my access link' },
    note: 'Your portal is the starting point for Discovery, targeting, and your contracts.',
  },
};

// Native line artwork: deliberately technical, quiet and decorative. No remote
// animation dependency, attention loop or inaccessible status encoded in a mark.
function RecoveryMark({ page }) {
  return (
    <div className="wda-recovery-visual" aria-hidden="true">
      <svg viewBox="0 0 260 260" fill="none" focusable="false">
        <path d="M28 74h204M28 130h204M28 186h204M74 28v204M130 28v204M186 28v204" stroke="#EEE9E3" />
        <circle cx="130" cy="130" r="94" fill="#FFFEFC" stroke="#E5DFD8" />
        <circle cx="130" cy="130" r="75" stroke="#E5DFD8" strokeDasharray="3 7" />
        <path d="M130 25v22M130 213v22M25 130h22M213 130h22" stroke="#B9ACA2" strokeWidth="1.5" />
        {page ? (
          <text x="130" y="150" textAnchor="middle" className="wda-recovery-code" fill="#292522">404</text>
        ) : (
          <g strokeLinecap="round" strokeLinejoin="round">
            <path d="M96 76h51l24 25v75a9 9 0 0 1-9 9H96a9 9 0 0 1-9-9V85a9 9 0 0 1 9-9Z" fill="#FFF" stroke="#8A7E75" strokeWidth="1.7" />
            <path d="M147 76v25h24M106 118h44M106 130h28M106 142h19" stroke="#C6BDB5" strokeWidth="1.7" />
            <circle cx="160" cy="160" r="24" fill="#FFFCF7" stroke="#B67442" strokeWidth="1.7" />
            <path d="m177 177 16 16" stroke="#B67442" strokeWidth="3" />
            <path d="M152 160h16M160 152v16" stroke="#BC287F" strokeWidth="1.7" />
          </g>
        )}
        <path className="wda-recovery-route" d="M35 207h31l18-18" stroke="#C42A86" strokeWidth="1.7" />
        <circle cx="35" cy="207" r="4" fill="#C42A86" />
        <circle cx="208" cy="66" r="5" fill="#FF9F58" />
      </svg>
    </div>
  );
}

export default function RecoveryScreen({ variant = 'link', title, email = '', supportBar }) {
  const screen = screens[variant] || screens.link;
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';
  return (
    <div className={`wda-recovery-page is-${variant}`}>
      <a className="wda-recovery-skip" href="#recovery-message">Skip to message</a>
      {supportBar ?? <SupportCTA sticky pageContext="portal" initialEmail={email} supportEmail={supportEmail} />}
      <header className="wda-recovery-header">
        <a className="wda-recovery-brand" href="/portal" aria-label="War Dogs Academy portal">
          <img src="/brand/wda-logo.png" alt="War Dogs Academy" width="100" height="54" />
          <span>The Target Brief</span>
        </a>
        <div className="wda-recovery-utilities"><span className="wda-recovery-platform">Member platform</span><span data-theme-slot="" /></div>
      </header>
      <main id="recovery-message" className="wda-recovery-main" aria-labelledby="recovery-title" tabIndex={-1}>
        <div className="wda-recovery-layout">
          <RecoveryMark page={variant === 'page'} />
          <div className="wda-recovery-copy">
            <p className="wda-recovery-eyebrow">{screen.eyebrow}</p>
            <h1 id="recovery-title">{title || screen.title || 'This link is not valid'}</h1>
            <p className="wda-recovery-description">{screen.description}</p>
            {variant === 'account' && email ? <dl className="wda-recovery-reference"><dt>Email entered</dt><dd>{email}</dd></dl> : null}
            <div className="wda-recovery-actions">
              <Button href={screen.primary.href}>{screen.primary.label}</Button>
              <Button href={screen.secondary.href} variant="ghost" showArrow={false}>{screen.secondary.label}</Button>
            </div>
            <p className="wda-recovery-note">{screen.note}</p>
          </div>
        </div>
      </main>
      <footer className="wda-recovery-footer"><span>War Dogs Academy</span><span>Focused targeting. Stronger opportunities.</span></footer>
    </div>
  );
}
