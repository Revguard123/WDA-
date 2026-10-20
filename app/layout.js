import { Inter } from 'next/font/google';
import { UI, DISPLAY_FONT, BODY_FONT } from '../lib/ui.js';
import LiquidInteractions from './_components/LiquidInteractions.jsx';
import AccessExperience from './_components/AccessExperience.jsx';
import ThemeSwitch from './_components/ThemeSwitch.jsx';
import { THEME_INIT_SCRIPT } from '../lib/theme.js';
import './liquid.css';
import './popups.css';
import './setup.css';
import './contracts.css';
import './contract-flow.css';
import './recovery.css';
import './portal.css';
import './workspace.css';
import './access-motion.css';
import './theme.css';
import './glass.css';
import './workspace-navigation.css';
import './dropdowns.css';
import './scrollbars.css';
import './cursor.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: 'variable',
});

export const metadata = {
  title: 'War Dogs Academy | The Target Brief',
  description: 'Curated federal contract targets matched to your niche.',
  icons: {
    icon: '/brand/wda-favicon.png',
    shortcut: '/brand/wda-favicon.png',
    apple: '/brand/wda-favicon.png',
  },
};

// Use the actual self-hosted Zuume Rough weights for brand headings.
// There is no semibold asset; body copy and form controls use Inter.
const fontFace = `
:root {
  --wda-brand-pink: ${UI.pink};
  --wda-brand-orange: ${UI.orange};
  --wda-brand-pink-ink: ${UI.pinkDeep};
  --wda-brand-orange-ink: ${UI.orangeDeep};
}
@font-face {
  font-family: 'Zuume Rough';
  src: url('/fonts/ZuumeRough-Bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Zuume Rough';
  src: url('/fonts/ZuumeRough-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
*,*::before,*::after {
  box-sizing: border-box;
}
html,body {
  max-width: 100%;
  overflow-x: hidden;
  font-family: ${BODY_FONT};
}
h1,h2,h3,h4,h5,h6 {
  font-family: ${DISPLAY_FONT};
  font-weight: 700;
  font-synthesis: none;
  letter-spacing: .02em;
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
/* Native text selection: an opaque blush stays readable on light and dark UI. */
::selection {
  background-color: #FBD1EC;
  color: #75104E;
  text-shadow: none;
}
@media (forced-colors: active) {
  ::selection {
    background-color: Highlight;
    color: HighlightText;
  }
}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: fontFace }} />
      </head>
      <body className={inter.className} style={{ fontFamily: BODY_FONT, margin: 0, maxWidth: '100%', overflowX: 'hidden' }}>
        <LiquidInteractions />
        <AccessExperience />
        <ThemeSwitch />
        {children}
      </body>
    </html>
  );
}
