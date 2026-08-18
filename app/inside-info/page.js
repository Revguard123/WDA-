import AssetViewer from '../_components/AssetViewer.jsx';

// Unlisted sales one-pager. Nothing links here; reachable only by the direct
// URL. noindex keeps it out of search.
export const metadata = {
  title: 'War Dogs Academy',
  robots: { index: false, follow: false },
};

export default function InsideInfoPage() {
  return (
    <AssetViewer
      src="/vault/inside-info.png"
      downloadName="War-Dogs-Academy-GovCon-Ecosystem.png"
      eyebrow="War Dogs Academy"
      title="The GovCon Ecosystem"
    />
  );
}
