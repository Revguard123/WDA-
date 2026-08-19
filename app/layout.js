export const metadata = {
  title: 'War Dogs Academy | The Target Brief',
  description: 'Curated federal contract targets matched to your niche.',
  icons: {
    icon: '/brand/wda-favicon.png',
    shortcut: '/brand/wda-favicon.png',
    apple: '/brand/wda-favicon.png',
  },
};

// Zuume Rough is the War Dogs Academy display face (the logo font). We self-host
// the OTF from /public/fonts and expose it as the "Zuume Rough" family for
// display headings. Body copy stays on a system stack.
const fontFace = `
@font-face {
  font-family: 'Zuume Rough';
  src: url('/fonts/ZuumeRough-Bold.otf') format('opentype');
  font-weight: 700 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Zuume Rough';
  src: url('/fonts/ZuumeRough-Regular.otf') format('opentype');
  font-weight: 400 600;
  font-style: normal;
  font-display: swap;
}
*,*::before,*::after {
  box-sizing: border-box;
}
html,body {
  max-width: 100%;
  overflow-x: hidden;
}
img,svg,video,canvas {
  max-width: 100%;
}
a,button,input,textarea,select {
  font: inherit;
}
p,h1,h2,h3,h4,h5,h6,div,span,a {
  overflow-wrap: anywhere;
}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontFace }} />
      </head>
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, maxWidth: '100%', overflowX: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
