import PortalPage from './portal/page.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Your Contract Workspace | War Dogs Academy',
  description: 'Discover your niche, refine your targeting, and review opportunities selected for your business.',
};

// One member entry experience, not a second landing page. Email access keeps
// its existing explicit /portal endpoint; the homepage resumes only a session.
export default function Home() {
  return PortalPage({ searchParams: {} });
}
