import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import DiscoveryForm from '../../_components/DiscoveryForm.jsx';
import SetupWorkspace from '../../_components/SetupWorkspace.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer, publicDiscoverySession } from '../../../lib/discoverySessions.js';
import { discoverStateForBuyer } from '../../../lib/journey.js';
import { buyerPagePath, publicBuyerProfile } from '../../../lib/buyerUrls.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DiscoverPage({ params, searchParams }) {
  const { token } = params;
  const sp = (await searchParams) || {};
  const updateMode = sp.update === '1';
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="discovery link" />;
  const state = discoverStateForBuyer({ ...buyer, access_token: token }, { updateMode });
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);
  const supportEmail = process.env.SUPPORT_TO_EMAIL || '';

  return (
    <Shell maxWidth="100%" hideHeader locked>
      <SetupWorkspace token={token} buyerName={buyer.name} buyerEmail={buyer.email} supportEmail={supportEmail} pageContext="discovery" activePage="discovery" discoveryHref={buyerPagePath('discover', token)} contentClassName="wda-discovery-workspace" mainLabel="Niche Discovery workspace">
        <DiscoveryForm
          embedded
          token={token}
          initial={publicBuyerProfile(buyer)}
          initialSession={publicDiscoverySession(session)}
          updateMode={state.updateMode}
          supportEmail={supportEmail}
        />
      </SetupWorkspace>
    </Shell>
  );
}
