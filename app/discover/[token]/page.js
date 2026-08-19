import { redirect } from 'next/navigation';
import Shell, { NotFound } from '../../_components/Shell.jsx';
import DiscoveryForm from '../../_components/DiscoveryForm.jsx';
import SupportCTA from '../../_components/SupportCTA.jsx';
import { getBuyerByToken } from '../../../lib/buyers.js';
import { getDiscoverySessionForBuyer, publicDiscoverySession } from '../../../lib/discoverySessions.js';
import { discoverStateForBuyer } from '../../../lib/journey.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DiscoverPage({ params, searchParams }) {
  const { token } = params;
  const sp = (await searchParams) || {};
  const updateMode = sp.update === '1';
  const buyer = await getBuyerByToken(token);
  if (!buyer) return <NotFound what="discovery link" />;
  const state = discoverStateForBuyer(buyer, { updateMode });
  if (state.redirect) redirect(state.redirect);
  const session = await getDiscoverySessionForBuyer(buyer.id);

  return (
    <Shell maxWidth={1800} subtitle="Find the contracting lane that fits what you can actually deliver." locked>
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <DiscoveryForm token={token} initial={buyer} initialSession={publicDiscoverySession(session)} supportCta={<SupportCTA pageContext="discovery" compact />} updateMode={state.updateMode} />
      </div>
    </Shell>
  );
}
