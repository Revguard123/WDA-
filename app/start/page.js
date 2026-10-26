import StartPage from './[token]/page.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page() {
  return StartPage({ params: { token: 'me' } });
}
