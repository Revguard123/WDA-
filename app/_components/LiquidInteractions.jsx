'use client';

import { useEffect } from 'react';
import { installLiquidHover } from '../../lib/liquid.js';
import { installAmbientMotion } from '../../lib/ambientMotion.js';
import { installThemeCursor } from '../../lib/cursor.js';

export default function LiquidInteractions() {
  useEffect(() => {
    const removeHover = installLiquidHover(document, window);
    const removeSidebarHover = installLiquidHover(document, window, { selector: '.is-workspace .wda-setup-rail' });
    const removeAmbient = installAmbientMotion(document, window);
    const removeCursor = installThemeCursor(document, window);
    return () => { removeHover(); removeSidebarHover(); removeAmbient(); removeCursor(); };
  }, []);
  return null;
}
