/* Εικόνες της συλλογής για την «Κρυμμένη εικόνα». Πρωτότυπα σχέδια, 400×300. */
import { __ } from '../i18n.js';
const svg = (id, body) => `<svg class="hp-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body.replace(/§/g, id)}</svg>`;
const stars = (pts, fill = '#fff') => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r || 1.6}" fill="${fill}"/>`).join('');

export const PICTURES = [
  {
    id: 'volcano', name: __('Ηφαίστειο'),
    svg: svg('pv', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B2A5A"/><stop offset=".55" stop-color="#E9744B"/><stop offset="1" stop-color="#F7B267"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      <g fill="#6B6E7A"><circle cx="200" cy="74" r="30"/><circle cx="230" cy="54" r="26"/><circle cx="176" cy="46" r="23"/><circle cx="214" cy="24" r="21"/><circle cx="250" cy="30" r="17"/><circle cx="160" cy="20" r="14"/></g>
      <g fill="#80838F"><circle cx="190" cy="66" r="16"/><circle cx="222" cy="40" r="13"/></g>
      <path d="M-10 300 L148 116 Q200 102 252 116 L410 300Z" fill="#5A3A2E"/>
      <path d="M60 300 L160 150 L120 300Z" fill="#4A2F25"/><path d="M300 300 L250 170 L340 300Z" fill="#6A4536"/>
      <path d="M148 116 Q200 102 252 116 L232 140 Q200 128 168 140Z" fill="#3D261E"/>
      <path d="M168 116 Q200 100 234 116 L228 124 Q212 156 218 198 Q204 168 199 132 Q188 166 174 222 Q182 156 171 124Z" fill="#FF5A1F"/>
      <path d="M178 114 Q200 104 224 114 L217 120 Q204 113 186 120Z" fill="#FFC23C"/>
      <path d="M0 272 Q100 256 200 270 T400 262 V300 H0Z" fill="#2E1F1A"/>
      <g fill="#FF8A2A"><circle cx="146" cy="84" r="5"/><circle cx="266" cy="76" r="6"/><circle cx="126" cy="108" r="4"/><circle cx="284" cy="100" r="3.5"/></g>`)
  },
  {
    id: 'lighthouse', name: __('Φάρος'),
    svg: svg('pl', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14204A"/><stop offset=".7" stop-color="#5A4A8A"/><stop offset="1" stop-color="#E68A9A"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      ${stars([[30, 30], [80, 60, 1.2], [130, 22], [340, 26], [370, 70, 1.2], [60, 110, 1.2], [180, 40, 1.2], [360, 130, 1.3]])}
      <path d="M280 88 L-20 24 L-20 146Z" fill="#FFE27A" opacity=".42"/><path d="M280 88 L420 52 L420 118Z" fill="#FFE27A" opacity=".32"/>
      <rect y="206" width="400" height="94" fill="#1F4F7A"/>
      <g stroke="#7FB2D9" stroke-width="3" fill="none" stroke-linecap="round"><path d="M20 230 q12 -8 24 0 t24 0"/><path d="M120 256 q12 -8 24 0 t24 0"/><path d="M40 282 q12 -8 24 0 t24 0"/><path d="M330 270 q12 -8 24 0 t24 0"/></g>
      <path d="M200 300 L222 236 Q262 210 318 226 Q352 232 372 262 L392 300Z" fill="#3E3E4A"/><path d="M240 300 L262 250 L300 244 L330 300Z" fill="#55556A"/>
      <path d="M262 232 L298 232 L291 106 L269 106Z" fill="#F7F4EE"/>
      <path d="M264.4 196 L295.6 196 L294.2 172 L265.8 172Z M267 148 L293 148 L292 126 L268 126Z" fill="#D63A3A"/>
      <rect x="260" y="98" width="40" height="9" rx="2" fill="#142033"/>
      <rect x="268" y="74" width="24" height="24" fill="#FFE58A"/><rect x="268" y="74" width="24" height="24" fill="none" stroke="#142033" stroke-width="3"/>
      <path d="M264 75 L296 75 L280 56Z" fill="#D63A3A"/><circle cx="280" cy="54" r="3" fill="#142033"/>
      <rect x="276" y="210" width="8" height="22" rx="4" fill="#142033"/>`)
  },
  {
    id: 'windmill', name: __('Ανεμόμυλος'),
    svg: svg('pw', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FB6F0"/><stop offset="1" stop-color="#CDEBFF"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      <circle cx="338" cy="58" r="26" fill="#FFD25A"/>
      <g fill="#fff" opacity=".9"><ellipse cx="70" cy="60" rx="38" ry="12"/><ellipse cx="96" cy="50" rx="24" ry="12"/><ellipse cx="300" cy="120" rx="30" ry="9"/></g>
      <path d="M0 236 Q120 206 220 222 T400 214 V300 H0Z" fill="#C9A36B"/><path d="M0 262 Q140 244 260 258 T400 252 V300 H0Z" fill="#A9844F"/>
      <rect x="168" y="122" width="84" height="122" rx="8" fill="#FBFBF7"/><rect x="168" y="122" width="12" height="122" fill="#E6E6DC"/>
      <path d="M196 244 V214 Q210 198 224 214 V244Z" fill="#2F6FE4"/><rect x="226" y="150" width="14" height="18" rx="2" fill="#2F6FE4"/>
      <path d="M160 126 Q210 66 260 126Z" fill="#8B5A2B"/><path d="M178 112 Q210 80 242 112" stroke="#6E4520" stroke-width="3" fill="none"/>
      <g>${Array.from({ length: 8 }, (_, k) => `<g transform="rotate(${k * 45 + 12} 210 104)"><line x1="210" y1="104" x2="210" y2="12" stroke="#5A3A2E" stroke-width="3"/><path d="M211 98 L211 18 L240 30 Z" fill="#fff" stroke="#D9D4C7" stroke-width="1.5"/></g>`).join('')}</g>
      <circle cx="210" cy="104" r="9" fill="#5A3A2E"/>`)
  },
  {
    id: 'rocket', name: __('Πύραυλος'),
    svg: svg('pr', `<defs><linearGradient id="§s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1030"/><stop offset="1" stop-color="#2A3470"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      ${stars([[20, 40], [60, 160, 1.2], [120, 30], [150, 250, 1.3], [260, 30], [370, 40], [340, 200, 1.2], [380, 270], [30, 260], [200, 280, 1.2], [300, 90, 1.2]])}
      <circle cx="72" cy="78" r="36" fill="#E2445C"/><path d="M40 64 Q72 52 104 64" stroke="#B8324A" stroke-width="5" fill="none"/><ellipse cx="72" cy="80" rx="62" ry="12" fill="none" stroke="#FFC23C" stroke-width="4" transform="rotate(-14 72 80)"/>
      <circle cx="350" cy="250" r="70" fill="#3E7BD9"/><path d="M300 210 Q330 230 320 260 Q350 270 360 300" stroke="#2AA36B" stroke-width="16" fill="none" stroke-linecap="round"/>
      <g fill="#C9CDD8" opacity=".7"><circle cx="150" cy="232" r="14"/><circle cx="128" cy="252" r="11"/><circle cx="108" cy="268" r="9"/><circle cx="90" cy="282" r="7"/></g>
      <g transform="translate(220 140) rotate(38)">
        <path d="M-20 52 Q0 128 20 52Z" fill="#FF5A1F"/><path d="M-11 52 Q0 100 11 52Z" fill="#FFC23C"/>
        <path d="M0 -92 Q42 -40 31 52 L-31 52 Q-42 -40 0 -92Z" fill="#F3F5F2"/>
        <path d="M0 -92 Q24 -64 28 -40 L-28 -40 Q-24 -64 0 -92Z" fill="#E2445C"/>
        <circle cx="0" cy="-12" r="14" fill="#2F6FE4" stroke="#142033" stroke-width="5"/><circle cx="-4" cy="-16" r="4" fill="#9CC3FF"/>
        <path d="M-31 16 L-54 64 L-29 52Z M31 16 L54 64 L29 52Z" fill="#E2445C"/><rect x="-4" y="22" width="8" height="30" rx="3" fill="#E2445C"/>
      </g>`)
  },
  {
    id: 'balloon', name: __('Αερόστατο'),
    svg: svg('pb', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC8F7"/><stop offset="1" stop-color="#E4F5FF"/></linearGradient>
      <clipPath id="§c"><path d="M200 22 C276 22 296 96 262 144 L234 186 L166 186 L138 144 C104 96 124 22 200 22Z"/></clipPath></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      <g fill="#fff"><ellipse cx="66" cy="90" rx="40" ry="13"/><ellipse cx="92" cy="80" rx="24" ry="13"/><ellipse cx="330" cy="54" rx="36" ry="11"/><ellipse cx="352" cy="46" rx="20" ry="10"/></g>
      <path d="M0 250 Q80 226 160 246 T320 238 T400 242 V300 H0Z" fill="#6FBF6A"/><path d="M0 272 Q120 254 240 270 T400 264 V300 H0Z" fill="#4E9E52"/>
      <g stroke="#142033" stroke-width="2.4" fill="none"><path d="M70 150 q6 -6 12 0 q6 -6 12 0"/><path d="M96 168 q5 -5 10 0 q5 -5 10 0"/></g>
      <g clip-path="url(#§c)"><rect x="100" y="0" width="200" height="200" fill="#E2445C"/><rect x="146" y="0" width="22" height="200" fill="#FFC23C"/><rect x="190" y="0" width="22" height="200" fill="#2F6FE4"/><rect x="234" y="0" width="22" height="200" fill="#FFC23C"/><rect x="100" y="0" width="24" height="200" fill="#2F6FE4"/><rect x="276" y="0" width="24" height="200" fill="#2F6FE4"/></g>
      <path d="M200 22 C276 22 296 96 262 144 L234 186 L166 186 L138 144 C104 96 124 22 200 22Z" fill="none" stroke="#142033" stroke-width="3" opacity=".25"/>
      <g stroke="#5A3A2E" stroke-width="2.5"><line x1="170" y1="186" x2="184" y2="216"/><line x1="230" y1="186" x2="216" y2="216"/><line x1="200" y1="186" x2="200" y2="216"/></g>
      <rect x="180" y="214" width="40" height="28" rx="4" fill="#8B5A2B"/><path d="M180 224 H220 M180 233 H220" stroke="#6E4520" stroke-width="2"/>`)
  },
  {
    id: 'sailboat', name: __('Ιστιοφόρο'),
    svg: svg('ps', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB86B"/><stop offset="1" stop-color="#FFE2B8"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      <circle cx="320" cy="150" r="42" fill="#FF8A3D"/>
      <g stroke="#142033" stroke-width="2.4" fill="none"><path d="M60 60 q7 -7 14 0 q7 -7 14 0"/><path d="M100 84 q5 -5 10 0 q5 -5 10 0"/></g>
      <rect y="186" width="400" height="114" fill="#1F7FB8"/><rect y="186" width="400" height="8" fill="#FF9D5C" opacity=".6"/>
      <line x1="200" y1="36" x2="200" y2="204" stroke="#5A3A2E" stroke-width="5"/>
      <path d="M207 44 L207 192 L296 192Z" fill="#fff"/><path d="M207 96 L251 192" stroke="#E6E2D8" stroke-width="2"/>
      <path d="M193 58 L193 192 L118 192Z" fill="#F3EEE4"/>
      <path d="M200 34 L228 42 L200 50Z" fill="#2F6FE4"/>
      <path d="M104 200 L298 200 L268 238 L134 238Z" fill="#C2410C"/><rect x="104" y="196" width="194" height="8" rx="3" fill="#8A2E08"/>
      <g stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"><path d="M20 230 q12 -8 24 0 t24 0"/><path d="M300 256 q12 -8 24 0 t24 0"/><path d="M60 270 q12 -8 24 0 t24 0"/><path d="M180 262 q12 -8 24 0 t24 0"/></g>`)
  },
  {
    id: 'castle', name: __('Κάστρο'),
    svg: svg('pc', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8AD0FF"/><stop offset="1" stop-color="#EAF7FF"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      <g fill="#fff"><ellipse cx="320" cy="50" rx="40" ry="12"/><ellipse cx="60" cy="40" rx="30" ry="10"/></g>
      <path d="M0 262 Q100 238 200 248 T400 246 V300 H0Z" fill="#5DAA5A"/>
      <rect x="110" y="150" width="180" height="104" fill="#A3ACB8"/>
      <g fill="#A3ACB8">${Array.from({ length: 7 }, (_, k) => `<rect x="${112 + k * 26}" y="138" width="16" height="14"/>`).join('')}</g>
      <rect x="168" y="92" width="64" height="60" fill="#B7BFCA"/><g fill="#B7BFCA"><rect x="168" y="80" width="14" height="14"/><rect x="193" y="80" width="14" height="14"/><rect x="218" y="80" width="14" height="14"/></g>
      <path d="M192 128 V112 Q200 102 208 112 V128Z" fill="#3A3F4A"/>
      <rect x="78" y="112" width="52" height="144" fill="#8D97A5"/><rect x="270" y="112" width="52" height="144" fill="#8D97A5"/>
      <path d="M72 114 L104 66 L136 114Z M264 114 L296 66 L328 114Z" fill="#E2445C"/>
      <g stroke="#142033" stroke-width="2.5"><line x1="104" y1="66" x2="104" y2="40"/><line x1="296" y1="66" x2="296" y2="40"/></g>
      <path d="M104 40 L124 46 L104 52Z M296 40 L316 46 L296 52Z" fill="#FFC23C"/>
      <path d="M96 170 V156 Q104 146 112 156 V170Z M288 170 V156 Q296 146 304 156 V170Z" fill="#3A3F4A"/>
      <path d="M178 254 V212 Q200 186 222 212 V254Z" fill="#5A3A2E"/><path d="M200 196 V254" stroke="#3E2618" stroke-width="2"/>
      <g fill="#95A0AD"><rect x="126" y="178" width="22" height="10"/><rect x="250" y="200" width="22" height="10"/><rect x="140" y="222" width="22" height="10"/></g>`)
  },
  {
    id: 'parthenon', name: __('Παρθενώνας'),
    svg: svg('pp', `<defs><linearGradient id="§s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FA8E8"/><stop offset="1" stop-color="#D6EEFF"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#§s)"/>
      <circle cx="64" cy="56" r="24" fill="#FFD25A"/>
      <g fill="#fff" opacity=".9"><ellipse cx="300" cy="60" rx="44" ry="12"/><ellipse cx="326" cy="50" rx="24" ry="11"/></g>
      <path d="M-10 300 L-10 236 Q50 214 116 218 L292 212 Q356 214 410 234 V300Z" fill="#B08D6B"/>
      <path d="M-10 262 Q90 246 190 256 T410 252 V300 H-10Z" fill="#94734F"/><path d="M40 236 L120 232 M240 230 L330 234" stroke="#8A6A48" stroke-width="3"/>
      <rect x="82" y="206" width="236" height="9" fill="#D9CCB0"/><rect x="88" y="197" width="224" height="10" fill="#E8DCC4"/>
      <g fill="#F2EADA">${Array.from({ length: 8 }, (_, k) => `<rect x="${98 + k * 28}" y="136" width="13" height="61"/>`).join('')}</g>
      <g stroke="#D9CCB0" stroke-width="1.5">${Array.from({ length: 8 }, (_, k) => `<line x1="${104.5 + k * 28}" y1="138" x2="${104.5 + k * 28}" y2="196"/>`).join('')}</g>
      <rect x="92" y="122" width="216" height="15" fill="#E8DCC4"/><rect x="92" y="118" width="216" height="5" fill="#D9CCB0"/>
      <path d="M92 118 L200 88 L270 107 L262 113 L246 110 L240 118Z" fill="#EADFC8"/><path d="M286 112 L308 118 L292 118Z" fill="#EADFC8"/>
      <path d="M118 112 L200 92" stroke="#D9CCB0" stroke-width="2"/>
      <g fill="#E2D6BC"><rect x="320" y="203" width="14" height="6" transform="rotate(-8 327 206)"/><rect x="62" y="210" width="12" height="5"/></g>`)
  }
];

export const pictureById = (id) => PICTURES.find((p) => p.id === id) || PICTURES[0];
