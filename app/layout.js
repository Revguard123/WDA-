export const metadata = {
  title: 'Curated Target Contracts',
  description: 'Monthly AI-curated federal contract briefs from SAM.gov.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
