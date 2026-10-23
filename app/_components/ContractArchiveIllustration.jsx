// Decorative contract portfolio; all counts and lifecycle information stay in text.
export default function ContractArchiveIllustration() {
  return (
    <div className="contracts-archive-art" aria-hidden="true">
      <svg viewBox="0 0 176 150" fill="none" focusable="false">
        <circle cx="88" cy="77" r="65" fill="#FCF0F7" />
        <path d="M21 139h136" stroke="#E9DBE3" strokeLinecap="round" />
        <g className="contracts-archive-sheets">
          <rect x="61" y="17" width="68" height="96" rx="7" transform="rotate(8 61 17)" fill="#FAF6F8" stroke="#DECBD5" />
          <rect x="46" y="14" width="69" height="97" rx="7" transform="rotate(-5 46 14)" fill="white" stroke="#D6BECF" />
          <rect x="59" y="28" width="28" height="5" rx="2.5" fill="#C62A86" />
          <path d="m59 43 39-3M60 52l39-3M61 61l26-2" stroke="#DDD1D8" strokeWidth="3" strokeLinecap="round" />
          <path d="m98 10 1 23 6-4 5 3-1-23" fill="#FFAE72" />
        </g>
        <g className="contracts-archive-folder" strokeLinejoin="round">
          <path d="M26 63a7 7 0 0 1 7-7h29l11 10h68a7 7 0 0 1 7 7v57a7 7 0 0 1-7 7H33a7 7 0 0 1-7-7V63Z" fill="#F4D7E8" stroke="#C9669E" strokeWidth="1.5" />
          <path d="M32 78h114a5 5 0 0 1 5 6l-6 47a7 7 0 0 1-7 6H36a7 7 0 0 1-7-6l-2-47a5 5 0 0 1 5-6Z" fill="#FFFCFE" stroke="#C9669E" strokeWidth="1.5" />
          <rect x="41" y="94" width="34" height="5" rx="2.5" fill="#CC6DA5" />
          <path d="M41 106h25M41 114h18" stroke="#E5D4DE" strokeWidth="3" strokeLinecap="round" />
          <circle cx="117" cy="108" r="17" fill="#FFF4E9" stroke="#ECA16A" />
          <circle cx="117" cy="108" r="9" stroke="#C7783D" strokeWidth="1.5" />
          <circle cx="117" cy="108" r="3" fill="#E99250" />
        </g>
        <circle cx="145" cy="40" r="3" fill="#FF9F58" />
      </svg>
    </div>
  );
}
