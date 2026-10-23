'use client';

import { useEffect, useRef } from 'react';
import { installBriefMotion } from '../../lib/briefMotion.js';

export default function DecisionBrief({ children }) {
  const root = useRef(null);
  useEffect(() => installBriefMotion(root.current, window), []);
  return <section ref={root} className="ctc-decision-brief" aria-labelledby="decision-brief-title">{children}</section>;
}
