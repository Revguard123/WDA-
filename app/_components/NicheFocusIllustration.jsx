// Decorative, code-native artwork: no animation player, downloads or provider calls.
export default function NicheFocusIllustration() {
  return (
    <div className="niche-focus-visual" aria-hidden="true">
      <svg className="niche-focus-art" viewBox="0 0 240 140" fill="none" focusable="false">
        <path d="M29 120h179" stroke="#EDE3E8" strokeLinecap="round" />
        <g className="niche-focus-brief">
          <rect x="128" y="17" width="73" height="99" rx="9" fill="#FAF6F8" stroke="#E4D5DE" />
          <rect x="119" y="12" width="73" height="99" rx="9" fill="white" stroke="#DCC9D4" />
          <rect x="132" y="27" width="28" height="5" rx="2.5" fill="#DDB4CB" />
          <path d="M132 45h46M132 53h34M132 69h46M132 77h38" stroke="#DDD5D9" strokeWidth="3" strokeLinecap="round" />
          <rect x="132" y="91" width="15" height="5" rx="2.5" fill="#FF9F58" />
          <path d="m172 92 3 3 6-7" stroke="#B8247B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <circle cx="86" cy="76" r="43" fill="#FFF7FB" stroke="#EAD2DF" />
        <circle className="niche-focus-ring" cx="86" cy="76" r="32" stroke="#C82584" strokeOpacity=".65" strokeWidth="1.5" />
        <circle cx="86" cy="76" r="20" stroke="#C82584" strokeOpacity=".85" strokeWidth="1.5" />
        <circle cx="86" cy="76" r="8" fill="#F8DBEC" stroke="#C82584" strokeWidth="1.5" />
        <path d="M40 76h7M125 76h7M86 30v7M86 115v7" stroke="#CCB5C2" strokeLinecap="round" />
        <g className="niche-focus-arrow" stroke="#E9843C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m86 76 48-47M86 76l3-12M86 76l12-3" />
          <path d="m129 34-1-11 9-9 1 11 11 1-9 9-11-1Z" fill="#FFF0E4" />
        </g>
        <circle cx="43" cy="34" r="3" fill="#FF9F58" />
        <path d="M27 52h7M30.5 48.5v7" stroke="#D9BCCB" strokeLinecap="round" />
      </svg>
    </div>
  );
}
