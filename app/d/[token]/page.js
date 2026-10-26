import { NotFound } from '../../_components/Shell.jsx';
import DiveDeeperPage from './[notice_id]/page.js';
import { noticeIdFromSlug } from '../../../lib/buyerUrls.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page({ params }) {
  const slug = params.token;
  const noticeId = noticeIdFromSlug(slug);
  if (!noticeId) return <NotFound what="contract" />;
  return DiveDeeperPage({ params: { token: 'me', notice_id: noticeId }, canonicalSlug: slug });
}
