export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1.5rem', lineHeight: 1.6 }}>
      <h1>Curated Target Contracts</h1>
      <p>
        War Dogs Academy. Each month we pull live federal contract opportunities from SAM.gov,
        match them to your niche, curate the best five with an AI disqualification pass, and email
        you a branded brief. Buyers never log in: delivery is email, and every deeper view is a
        private tokenized link.
      </p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Slice 1 (the SAM.gov engine) is live in this build. Buyer-facing pages arrive in later slices.
      </p>
    </main>
  );
}
