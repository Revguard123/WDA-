import CTCIcon from './CTCIcon.jsx';
import BetaNotice from './BetaNotice.jsx';
import SupportCTA from './SupportCTA.jsx';
import WorkspaceNavigation, { MobileAccountToggle, SidebarToggle } from './WorkspaceNavigation.jsx';
import { buyerPagePath } from '../../lib/buyerUrls.js';

// Reuse the portal's ambient motion inside the content pane only. Keeping this
// behind the scroll surface leaves navigation and page interactions untouched.
function WorkspaceAtmosphere() {
  return <div className="wda-workspace-atmosphere" aria-hidden="true"><span className="wda-portal-glow is-pink" /><span className="wda-portal-glow is-orange" /></div>;
}

function LogoutAction() {
  return <form className="wda-account-logout-form" action="/auth/logout" method="post">
    <button data-liquid="" className="wda-account-logout" type="submit" aria-label="Log out" data-sidebar-hint="Log out" data-sidebar-hint-detail="Sign out of this device" data-sidebar-hint-tone="danger"><CTCIcon name="logout" /><span className="wda-logout-label">Log out</span></button>
  </form>;
}

function MemberAvatar() {
  return <span className="wda-member-avatar" aria-hidden="true">
      <svg className="wda-member-avatar-figure" viewBox="0 0 40 40" fill="none" focusable="false" aria-hidden="true">
        <circle cx="20" cy="13.5" r="6" fill="currentColor" opacity=".88" />
        <path d="M8.5 32c.5-6.2 4.5-9.6 11.5-9.6S31 25.8 31.5 32c-6.9 3.2-16.1 3.2-23 0Z" fill="currentColor" opacity=".72" />
        <path d="M15.7 12.4c.3-2 1.8-3.4 4.2-3.6-1.2 1.1-1.9 2.5-2.1 4.2-.1.9-2.3.5-2.1-.6ZM12.9 28.6c1.8-2.8 4.3-4.1 7.7-4.1-2.5.8-4.5 2.4-6 4.7-.5.8-2.3.2-1.7-.6Z" fill="#FFF" opacity=".32" />
      </svg>
    </span>;
}

function MemberAccount({ name, email }) {
  const savedName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  const address = typeof email === 'string' ? email.trim() : '';
  const displayName = savedName || address.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Member';
  return <div className="wda-member-account" role="group" aria-label="Your account" tabIndex={0} data-sidebar-hint="Your account" data-sidebar-hint-detail={`${displayName}${address ? ` · ${address}` : ''}`}>
    <MemberAvatar />
    <div className="wda-member-copy"><strong title={displayName}>{displayName}</strong><span title={address || undefined}>{address || 'WDA member'}</span></div>
  </div>;
}

// Shared CTC chrome for targeting and the delivered-contract archive.
export default function SetupWorkspace({ token, discoveryHref, updateMode = false, readOnly = false, choice = false, activePage = 'targeting', header = null, setupStep = 1, contentClassName = '', mainLabel, reader = false, contextBar = null, sidebarFooter = null, buyerName = '', buyerEmail = '', supportEmail = '', pageContext, children }) {
  // Choosing a path is a focused entry screen, not the editing workspace.
  // Omit navigation from the DOM on both desktop and mobile.
  if (choice) return (
    <div className="wda-setup-app is-path-choice">
      <main className="wda-choice-main" aria-label="Choose your targeting path">
        <WorkspaceAtmosphere />
        <div className="wda-choice-scroll">
          <div className="wda-setup-content is-choice"><div className="wda-choice-context"><span>Getting started</span><div className="wda-choice-utilities"><BetaNotice /><span data-theme-slot="" /><LogoutAction /></div></div>{children}
            <div className="wda-choice-help"><SupportCTA sidebar liquid pageContext="targeting_setup" initialEmail={buyerEmail} supportEmail={supportEmail} /></div>
          </div>
        </div>
      </main>
    </div>
  );
  const pages = [
    { id: 'discovery', label: 'Discovery', icon: 'discovery', href: discoveryHref },
    { id: 'targeting', label: 'Targeting', icon: 'target', href: `${buyerPagePath('setup', token)}?review=1` },
    { id: 'contracts', label: 'Contracts', icon: 'briefcase', href: buyerPagePath('contracts', token) },
  ];
  const crumbs = setupStep === 2 && activePage === 'targeting'
    ? [{ label: 'Targeting', href: buyerPagePath('setup', token) }, { label: 'Start contracts' }]
    : [];
  const hasBreadcrumb = crumbs.length > 1;
  const context = pageContext || (setupStep === 2 ? 'start' : activePage === 'discovery' ? 'discovery' : activePage === 'contracts' ? 'contracts' : readOnly ? 'targeting_review' : 'targeting_setup');
  return (
    <WorkspaceNavigation className={`wda-setup-app is-workspace${reader ? ' is-reader' : ''}`}>
      <div className="wda-setup-mobile">
        <img src="/brand/wda-logo.png" alt="War Dogs Academy" width="110" />
        <nav aria-label="Mobile navigation">
          {pages.map((page) => page.id === activePage
            ? reader ? <a key={page.id} href={page.href} aria-current="location" title={page.label} aria-label={page.label}><CTCIcon name={page.icon} /></a>
              : <span key={page.id} aria-current="page" title={page.label}><CTCIcon name={page.icon} /><span className="sr-only">{page.label}</span></span>
            : <a data-liquid="" key={page.id} href={page.href} title={page.label} aria-label={page.label}><CTCIcon name={page.icon} /></a>)}
        </nav>
        <span data-theme-slot-mobile="" />
        <MobileAccountToggle><MemberAvatar /></MobileAccountToggle>
      </div>
      <div className="wda-setup-layout">
        <aside className="wda-setup-rail" id="workspace-navigation" aria-label="CTC navigation">
          <div className="wda-rail-light" aria-hidden="true" />
          <div className="wda-rail-heading">
          <a href={buyerPagePath('contracts', token)} className="wda-reader-brand" aria-label="War Dogs Academy contracts"><img className="wda-rail-wordmark" src="/brand/wda-logo-horizontal.png" alt="War Dogs Academy" width="238" height="32" /><img className="wda-rail-brand-mark" src="/brand/wda-favicon.png" alt="" width="32" height="32" /></a>
          <SidebarToggle />
          </div>
          <p className="wda-workspace-label"><span aria-hidden="true" />Contract workspace</p>
          <nav>
            {pages.map((page) => page.id === activePage
              ? reader ? <a key={page.id} href={page.href} data-sidebar-hint={page.label} aria-current="location"><CTCIcon name={page.icon} /><span className="wda-nav-label">{page.label}</span></a>
                : <span key={page.id} data-sidebar-hint={page.label} aria-current="page"><CTCIcon name={page.icon} /><span className="wda-nav-label">{page.label}</span></span>
              : <a data-liquid="" key={page.id} href={page.href} data-sidebar-hint={page.label}><CTCIcon name={page.icon} /><span className="wda-nav-label">{page.label}</span></a>)}
          </nav>
          <footer className="wda-workspace-support" id="workspace-account-panel" aria-label="Account and support">
            <MemberAccount name={buyerName} email={buyerEmail} />
            <div className="wda-workspace-appearance" data-sidebar-hint="Appearance"><span>Appearance</span><span data-theme-slot="" /></div>
            {sidebarFooter || <SupportCTA sidebar liquid pageContext={context} initialEmail={buyerEmail} supportEmail={supportEmail} />}
            <a data-liquid="" className="wda-workspace-products" aria-label="Back to my products" data-sidebar-hint="Back to my products" href={process.env.KAJABI_LIBRARY_URL || 'https://www.wardogsacademy.co/library'}><CTCIcon name="externalLink" />Back to my products</a>
            <LogoutAction />
          </footer>
        </aside>
        <main id="workspace-content" tabIndex={-1} className="wda-setup-main" aria-label={mainLabel || (activePage === 'contracts' ? 'Your delivered contracts' : 'Contract targeting')}>
          <WorkspaceAtmosphere />
          <div className="wda-setup-scroll">
            <div className={`wda-setup-content${activePage === 'contracts' ? ' is-contracts' : ''}${contentClassName ? ' ' + contentClassName : ''}`}>
              {contextBar || <div className={`ctc-reader-context${hasBreadcrumb ? '' : ' is-beta-only'}`}>
                {hasBreadcrumb ? <nav className="ctc-reader-breadcrumb" aria-label="Breadcrumb"><ol>{crumbs.map((crumb, index) => <li key={crumb.label}>
                  {index ? <span className="ctc-reader-breadcrumb-divider" aria-hidden="true">/</span> : null}
                  {crumb.href ? <a id={index === 0 ? 'workspace-breadcrumb' : undefined} href={crumb.href}>{crumb.label}</a>
                    : <span id={index === 0 ? 'workspace-breadcrumb' : undefined} tabIndex={-1} aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}
                </li>)}</ol></nav> : null}
                <BetaNotice focusAfterDismissId={hasBreadcrumb ? 'workspace-breadcrumb' : 'workspace-content'} />
              </div>}
              {header ? <div className="wda-workspace-page-actions">{header}</div> : null}
              {activePage === 'targeting' && !readOnly && !updateMode ? (
                <ol className="wda-setup-steps" aria-label="Setup progress">
                  {['Find your focus', 'Review targeting', 'Start contracts'].map((label, index) => (
                    <li key={label} className={index === setupStep ? 'is-current' : index < setupStep ? 'is-done' : ''}
                      aria-current={index === setupStep ? 'step' : undefined}>
                      <span>{index < setupStep ? <CTCIcon name="check" /> : `0${index + 1}`}</span>{label}
                    </li>
                  ))}
                </ol>
              ) : null}
              {children}
            </div>
          </div>
        </main>
      </div>
    </WorkspaceNavigation>
  );
}

function SetupPathVisual({ direct = false }) {
  return (
    <div className="wda-path-visual" aria-hidden="true">
      <svg viewBox="0 0 280 104" fill="none" focusable="false">
        {direct ? <>
          <path d="M174 20h81M174 42h81M174 64h81M174 86h81" stroke="#ECE5DF" />
          <circle cx="71" cy="52" r="35" stroke="#E7D8CC" />
          <circle cx="71" cy="52" r="23" stroke="#DCA97F" />
          <circle cx="71" cy="52" r="10" fill="#FFF5EB" stroke="#CF8B55" />
          <g className="wda-path-align-left" stroke="#C9824D" strokeWidth="1.5" strokeLinecap="round"><path d="M25 41v-9h9M25 63v9h9M43 52h10" /></g>
          <g className="wda-path-align-right" stroke="#C9824D" strokeWidth="1.5" strokeLinecap="round"><path d="M117 41v-9h-9M117 63v9h-9M89 52h10" /></g>
          <circle className="wda-path-lock" cx="71" cy="52" r="3" fill="#C82584" />
          <g className="wda-path-align-rows">
            <rect x="174" y="26" width="55" height="6" rx="3" fill="#D9C8BD" />
            <rect x="174" y="48" width="69" height="6" rx="3" fill="#D9C8BD" />
            <rect x="174" y="70" width="42" height="6" rx="3" fill="#D9C8BD" />
            <circle cx="253" cy="29" r="3" fill="#FF9F58" /><circle cx="253" cy="51" r="3" fill="#FF9F58" /><circle cx="253" cy="73" r="3" fill="#FF9F58" />
          </g>
          <path className="wda-path-lock-line" d="M130 52h28" pathLength="1" stroke="#C82584" strokeWidth="1.5" strokeDasharray="1" />
        </> : <>
          <path d="M23 73C63 73 59 29 102 29s42 44 80 44 42-44 75-44" stroke="#EADCE4" strokeWidth="1.5" />
          <path className="wda-path-explore-trace" d="M23 73C63 73 59 29 102 29s42 44 80 44 42-44 75-44" pathLength="1" stroke="#C82584" strokeWidth="1.7" strokeDasharray="1" />
          <g className="wda-path-explore-nodes"><circle cx="23" cy="73" r="4" fill="#DAABC5" /><circle cx="102" cy="29" r="4" fill="#C82584" /><circle cx="182" cy="73" r="4" fill="#FF9F58" /><circle cx="257" cy="29" r="4" fill="#C82584" /></g>
          <g className="wda-path-explore-brief">
            <rect x="54" y="52" width="46" height="31" rx="6" fill="white" stroke="#DAC6D2" />
            <path d="M64 63h25M64 70h16" stroke="#D8B3C9" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <g className="wda-path-explore-brief is-second">
            <rect x="166" y="18" width="46" height="31" rx="6" fill="white" stroke="#DAC6D2" />
            <path d="M176 29h25M176 36h16" stroke="#D8B3C9" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </>}
      </svg>
    </div>
  );
}

export function SetupChoice({ discoveryHref, directHref }) {
  return (
    <>
      <header className="wda-setup-intro wda-choice-intro">
        <p className="wda-setup-eyebrow">Curated Target Contracts</p>
        <h1>Start with a clear target.</h1>
        <p>Choose how you’d like to build your targeting profile.</p>
      </header>
      <div className="wda-setup-paths">
        <a href={discoveryHref} className="wda-setup-path" aria-labelledby="setup-path-discovery-title" aria-describedby="setup-path-discovery-description">
          <SetupPathVisual />
          <span className="wda-setup-path-label">Explore your options</span>
          <h2 id="setup-path-discovery-title">Help me discover my niche</h2>
          <p id="setup-path-discovery-description">Work through your capabilities with the Niche Advisor and find a starting lane that fits.</p>
          <span className="wda-setup-path-action">Start with Discovery<CTCIcon name="arrow" /></span>
        </a>
        <a href={directHref} className="wda-setup-path is-direct" aria-labelledby="setup-path-direct-title" aria-describedby="setup-path-direct-description">
          <SetupPathVisual direct />
          <span className="wda-setup-path-label">Set your own direction</span>
          <h2 id="setup-path-direct-title">I already know my niche</h2>
          <p id="setup-path-direct-description">Build your profile directly with industry codes, capabilities, service area, and contract preferences.</p>
          <span className="wda-setup-path-action">Build your targeting<CTCIcon name="arrow" /></span>
        </a>
      </div>
      <p className="wda-setup-choice-note">Two paths. One targeting profile. You’ll review it before choosing when to start your contracts.</p>
    </>
  );
}

export function SetupGuide({ readOnly = false, updateMode = false }) {
  return (
    <aside className="wda-setup-guide" aria-label="About your targeting">
      <span className="wda-setup-guide-icon"><CTCIcon name="shield" /></span>
      <div><h2>{readOnly ? 'Your saved profile' : 'What happens next'}</h2>
      <p className="wda-setup-guide-note">{readOnly
        ? 'This is your saved profile. Returning to contracts does not change it.'
        : updateMode
        ? 'Changes apply to future batches only. Your existing contract archive stays unchanged.'
        : 'Saving your profile does not generate contracts or use a batch. You’ll start separately.'}</p></div>
    </aside>
  );
}
