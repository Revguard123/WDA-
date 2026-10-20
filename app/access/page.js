import PortalFrame from '../_components/PortalFrame.jsx';
import AccessForm from '../_components/AccessForm.jsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email My Access Link | War Dogs Academy' };

// Magic-link re-entry page. Linked from the Kajabi product so members can reach
// their contracts without a login: they enter their email, we send the link.
export default function AccessPage() {
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';
  return (
    <PortalFrame cardTitle="Email my access link" cardDescription="Enter your enrollment email and we will send a private link straight to your inbox." supportEmail={supportEmail} pageContext="portal">
      <AccessForm />
      <div className="wda-portal-alternative"><span>Prefer to open it here?</span><a href="/portal">Open my portal</a></div>
    </PortalFrame>
  );
}
