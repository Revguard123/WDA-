import SetupPage from './[token]/page.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page({ searchParams }) {
  return SetupPage({ params: { token: 'me' }, searchParams });
}
