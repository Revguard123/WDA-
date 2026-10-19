import ContractsPage from './[token]/page.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page() {
  return ContractsPage({ params: { token: 'me' } });
}
