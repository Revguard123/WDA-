import CTCIcon from './CTCIcon.jsx';
import SupportCTA from './SupportCTA.jsx';

// The public member entry and email-link recovery share one visual frame.
// Only the card content changes; navigation, atmosphere and themes stay aligned.
export default function PortalFrame({ children, cardTitle = 'Access your portal', cardDescription = 'Enter the email you enrolled with to continue.', email = '', supportEmail = '', pageContext = 'portal' }) {
  return (
    <div className="wda-portal-page">
      <a className="wda-portal-skip" href="#portal-access">Skip to portal access</a>
      <div className="wda-portal-atmosphere" aria-hidden="true"><span className="wda-portal-glow is-pink" /><span className="wda-portal-glow is-orange" /></div>
      <header className="wda-portal-header">
        <span className="wda-portal-header-balance" aria-hidden="true" />
        <a href="/" aria-label="War Dogs Academy home"><img src="/brand/wda-logo-horizontal.png" alt="War Dogs Academy" width="238" height="32" /></a>
        <span data-theme-slot="" />
      </header>
      <main className="wda-portal-main" aria-labelledby="portal-title">
        <div className="wda-portal-intro">
          <p className="wda-portal-eyebrow"><span aria-hidden="true" />The Target Brief <span className="wda-portal-beta">Beta</span></p>
          <h1 id="portal-title">Your contract<br />
            <span className="wda-portal-title-accent"><span>workspace.</span>
              <svg className="wda-portal-underline" viewBox="0 0 600 18" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
                <defs><linearGradient id="portal-underline-gradient" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#C81E86" /><stop offset="1" stopColor="#E79255" /></linearGradient></defs>
                <path d="M5 10C145 3 350 3 592 7M35 16c172-6 359-5 535-1" pathLength="1" stroke="url(#portal-underline-gradient)" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="wda-portal-description">Discover your niche, refine your targeting, and review opportunities selected for your business.</p>
          <ul className="wda-portal-capabilities" aria-label="Inside your portal">
            <li><CTCIcon name="discovery" />Discover your niche</li>
            <li><CTCIcon name="target" />Refine your targeting</li>
            <li><CTCIcon name="briefcase" />Review your contracts</li>
          </ul>
        </div>
        <section id="portal-access" className="wda-portal-access-card" aria-labelledby="portal-access-title" tabIndex={-1}>
          <div className="wda-portal-card-kicker"><CTCIcon name="briefcase" />Member access</div>
          <h2 id="portal-access-title">{cardTitle}</h2>
          <p className="wda-portal-card-description">{cardDescription}</p>
          {children}
        </section>
        <p className="wda-portal-access-note">Your profile. Your contract search. One place to move forward.</p>
      </main>
      <footer className="wda-portal-footer">
        <span>War Dogs Academy <span aria-hidden="true">/</span> The Target Brief</span>
        <div className="wda-portal-help"><SupportCTA sidebar pageContext={pageContext} initialEmail={email} supportEmail={supportEmail} /></div>
      </footer>
    </div>
  );
}
