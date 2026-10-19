import DiscoverPage from './[token]/page.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page({ searchParams }) {
  return DiscoverPage({ params: { token: 'me' }, searchParams });
}
