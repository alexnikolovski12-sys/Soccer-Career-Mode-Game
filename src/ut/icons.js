// Line icons and simple national flags for the career hub (inline SVG, no emoji).
const svg = (body, size = 20, extra = '') =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const ICON = {
  mail: (s) => svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', s),
  phone: (s) => svg('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>', s),
  target: (s) => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>', s),
  globe: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>', s),
  clipboard: (s) => svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 11h7M8.5 15h5"/>', s),
  briefcase: (s) => svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18"/>', s),
  deal: (s) => svg('<path d="M3 11l4-4 4 2 3-2 7 5-6 6-4-3-3 2z"/><path d="M11 9l-3 3"/>', s),
  shield: (s) => svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', s),
  check: (s) => svg('<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" stroke="none" opacity=".18"/><path d="M7 12.5l3.2 3L17 8.5"/>', s),
  box: (s) => svg('<rect x="4" y="4" width="16" height="16" rx="4"/>', s),
  cross: (s) => svg('<path d="M6 6l12 12M18 6L6 18"/>', s),
  play: (s) => svg('<path d="M7 4.5v15L19.5 12z" fill="currentColor"/>', s),
  ffwd: (s) => svg('<path d="M3.5 5.5v13L12 12zM12 5.5v13L20.5 12z" fill="currentColor"/>', s),
  chevron: (s) => svg('<path d="M9 5l7 7-7 7"/>', s),
  fire: (s) => svg('<path d="M12 21c4 0 7-2.8 7-6.7 0-3.3-2.3-5.3-3.8-7.3-.4 2-1.6 3.2-2.8 3.6.2-2.9-.9-5.8-3.4-7.6.1 3.3-1.7 5.2-3.2 7C4.6 11.5 5 13 5 14.3 5 18.2 8 21 12 21z"/>', s),
  heart: (s) => svg('<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-2.6A4.8 4.8 0 0 1 21 11c-2 4.6-9 9-9 9z"/>', s),
  bolt: (s) => svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', s),
  fist: (s) => svg('<path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V11M10 10V6.5a1.5 1.5 0 0 1 3 0V10M13 10V7a1.5 1.5 0 0 1 3 0v4M16 11V9a1.5 1.5 0 0 1 3 0v4.5C19 18 16 21 12 21s-6-2.5-6-6v-2a2 2 0 0 1 4 0"/>', s),
  mute: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/>', s),
  gear: (s) => svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>', s),
  news: (s) => svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 8h10M7 12h4M7 16h4M14 12h3v4h-3z"/>', s),
  gift: (s) => svg('<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12M12 9c-1.5-4-6-4-5.5-1.5S12 9 12 9zM12 9c1.5-4 6-4 5.5-1.5S12 9 12 9z"/>', s),
  star: (s) => svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', s),
  quest: (s) => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l7-7M16 4h3v3"/>', s),
  shieldStar: (s) => svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8l1.2 2.5 2.7.4-2 1.9.5 2.7L12 14.2l-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="currentColor"/>', s),
  signing: (s) => svg('<circle cx="10" cy="8" r="3.5"/><path d="M3 20c.8-3.8 3.6-5.6 7-5.6 1.6 0 3 .4 4.1 1.2"/><path d="M17 13v7M13.5 16.5h7"/>', s),
  exchange: (s) => svg('<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>', s),
  cart: (s) => svg('<path d="M3 4h2.5l2.2 11h10.6l2-8H7"/><circle cx="9.5" cy="19" r="1.6" fill="currentColor"/><circle cx="17" cy="19" r="1.6" fill="currentColor"/>', s),
  people: (s) => svg('<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.6"/><path d="M2.5 20c.8-4 3.4-6 6.5-6s5.7 2 6.5 6M15 14.4c2.8-.4 5.4 1.2 6.3 4.6"/>', s),
  ball: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.2 2.3-1.2 3.8h-4l-1.2-3.8z" fill="currentColor"/><path d="M12 3v4.5M15.2 9.8l4.4-1.6M14 13.6l2.6 3.8M10 13.6l-2.6 3.8M8.8 9.8L4.4 8.2"/>', s),
  user: (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5"/>', s),
};

// ---------------------------------------------------------------- flags (simplified)
const H3 = (a, b, c) => `<rect width="30" height="7" fill="${a}"/><rect y="7" width="30" height="6" fill="${b}"/><rect y="13" width="30" height="7" fill="${c}"/>`;
const V3 = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
const star = (cx, cy, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r, a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};
const FLAGS = {
  ENG: '<rect width="30" height="20" fill="#fff"/><rect x="13" width="4" height="20" fill="#ce1124"/><rect y="8" width="30" height="4" fill="#ce1124"/>',
  SCO: '<rect width="30" height="20" fill="#005eb8"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="3.2"/>',
  ESP: '<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>',
  GER: H3('#000', '#dd0000', '#ffce00'),
  ITA: V3('#009246', '#fff', '#ce2b37'),
  FRA: V3('#0055a4', '#fff', '#ef4135'),
  POR: '<rect width="12" height="20" fill="#006600"/><rect x="12" width="18" height="20" fill="#ff0000"/><circle cx="12" cy="10" r="3.6" fill="#ffcc00"/>',
  NED: H3('#ae1c28', '#fff', '#21468b'),
  BEL: V3('#000', '#fdda24', '#ef3340'),
  CRO: H3('#ff0000', '#fff', '#171796') + '<rect x="12" y="6" width="6" height="7" fill="#ff0000"/><rect x="12" y="6" width="3" height="3.5" fill="#fff"/><rect x="15" y="9.5" width="3" height="3.5" fill="#fff"/>',
  IRL: V3('#169b62', '#fff', '#ff883e'),
  BRA: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/>',
  ARG: H3('#74acdf', '#fff', '#74acdf') + '<circle cx="15" cy="10" r="2" fill="#f6b40e"/>',
  URU: '<rect width="30" height="20" fill="#fff"/>' + [2.2, 6.6, 11, 15.4].map((y) => `<rect y="${y}" width="30" height="2.2" fill="#0038a8"/>`).join('') + '<rect width="11" height="11" fill="#fff"/><circle cx="5.5" cy="5.5" r="2.6" fill="#fcd116"/>',
  COL: '<rect width="30" height="10" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/>',
  USA: '<rect width="30" height="20" fill="#fff"/>' + [0, 3, 6, 9, 12, 15, 18].map((y) => `<rect y="${y}" width="30" height="1.6" fill="#b22234"/>`).join('') + '<rect width="13" height="10.5" fill="#3c3b6e"/>',
  MEX: V3('#006847', '#fff', '#ce1126') + '<circle cx="15" cy="10" r="2" fill="#8c6b3f"/>',
  AUS: '<rect width="30" height="20" fill="#012169"/><rect width="13" height="9" fill="#012169"/><path d="M0 0L13 9M13 0L0 9" stroke="#fff" stroke-width="1.6"/><path d="M6.5 0v9M0 4.5h13" stroke="#fff" stroke-width="2.4"/><path d="M6.5 0v9M0 4.5h13" stroke="#c8102e" stroke-width="1.2"/>' + star(6.5, 15, 2.2, '#fff') + star(22, 5, 1.2, '#fff') + star(25, 10, 1.2, '#fff') + star(22, 16, 1.2, '#fff') + star(19, 10, 1, '#fff'),
  JPN: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.6" fill="#bc002d"/>',
  KOR: '<rect width="30" height="20" fill="#fff"/><path d="M10 10a5 5 0 0 1 10 0z" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0z" fill="#0047a0"/>',
  MAR: '<rect width="30" height="20" fill="#c1272d"/>' + star(15, 10.5, 5, 'none').replace('fill="none"', 'fill="none" stroke="#006233" stroke-width="1.2"'),
  SEN: V3('#00853f', '#fdef42', '#e31b23') + star(15, 10.3, 3, '#00853f'),
  NGA: V3('#008751', '#fff', '#008751'),
  GHA: H3('#ce1126', '#fcd116', '#006b3f') + star(15, 10.2, 3, '#000'),
  CIV: V3('#f77f00', '#fff', '#009e60'),
  CAN: '<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d80621"/><rect x="22.5" width="7.5" height="20" fill="#d80621"/><path d="M15 4l1.4 3 2-1-.8 4 2.2-.6-.6 2.2L15 14.8 10.8 11.6l-.6-2.2 2.2.6-.8-4 2 1z" fill="#d80621"/><rect x="14.4" y="13" width="1.2" height="3.4" fill="#d80621"/>',
  POL: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/>',
  SUI: '<rect width="30" height="20" fill="#da291c"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>',
  DEN: '<rect width="30" height="20" fill="#c8102e"/><rect x="9" width="3.6" height="20" fill="#fff"/><rect y="8.2" width="30" height="3.6" fill="#fff"/>',
  NOR: '<rect width="30" height="20" fill="#ba0c2f"/><rect x="8" width="6" height="20" fill="#fff"/><rect y="7" width="30" height="6" fill="#fff"/><rect x="9.5" width="3" height="20" fill="#00205b"/><rect y="8.5" width="30" height="3" fill="#00205b"/>',
  SWE: '<rect width="30" height="20" fill="#006aa7"/><rect x="9" width="3.6" height="20" fill="#fecc00"/><rect y="8.2" width="30" height="3.6" fill="#fecc00"/>',
  FIN: '<rect width="30" height="20" fill="#fff"/><rect x="8.5" width="4.5" height="20" fill="#002f6c"/><rect y="7.75" width="30" height="4.5" fill="#002f6c"/>',
  ISL: '<rect width="30" height="20" fill="#02529c"/><rect x="8" width="6" height="20" fill="#fff"/><rect y="7" width="30" height="6" fill="#fff"/><rect x="9.5" width="3" height="20" fill="#dc1e35"/><rect y="8.5" width="30" height="3" fill="#dc1e35"/>',
  ECU: '<rect width="30" height="10" fill="#ffdd00"/><rect y="10" width="30" height="5" fill="#034ea2"/><rect y="15" width="30" height="5" fill="#ed1c24"/><circle cx="15" cy="10" r="2.4" fill="#8a6d3b"/>',
  VEN: H3('#ffcc00', '#00247d', '#cf142b') + [9, 11.5, 14, 16.5, 19, 21].map((x, i) => `<circle cx="${x}" cy="${9.4 - Math.sin((i + 0.5) / 6 * Math.PI) * 2}" r="0.55" fill="#fff"/>`).join(''),
  HUN: H3('#ce2939', '#fff', '#477050'),
  GEO: '<rect width="30" height="20" fill="#fff"/><rect x="13" width="4" height="20" fill="#ff0000"/><rect y="8" width="30" height="4" fill="#ff0000"/>' + [[6.5, 4], [23.5, 4], [6.5, 16], [23.5, 16]].map(([x, y]) => `<rect x="${x - 1.6}" y="${y - 0.5}" width="3.2" height="1" fill="#ff0000"/><rect x="${x - 0.5}" y="${y - 1.6}" width="1" height="3.2" fill="#ff0000"/>`).join(''),
  UKR: '<rect width="30" height="10" fill="#0057b7"/><rect y="10" width="30" height="10" fill="#ffd700"/>',
  RUS: H3('#fff', '#0039a6', '#d52b1e'),
  EGY: H3('#ce1126', '#fff', '#000') + '<circle cx="15" cy="10" r="1.6" fill="#c09300"/>',
  ALG: '<rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.2" fill="#d21034"/><circle cx="16.3" cy="10" r="3.5" fill="#fff"/><rect x="15" y="0" width="0" height="0"/>' + star(17.6, 10, 1.8, '#d21034'),
  TUR: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/>' + star(17.2, 10, 2.2, '#fff'),
  TUN: '<rect width="30" height="20" fill="#e70013"/><circle cx="15" cy="10" r="5" fill="#fff"/><circle cx="15" cy="10" r="3.6" fill="#e70013"/><circle cx="16" cy="10" r="3" fill="#fff"/>' + star(16.4, 10, 1.9, '#e70013'),
  CMR: V3('#007a5e', '#ce1126', '#fcd116') + star(15, 10.3, 2.6, '#fcd116'),
  MLI: V3('#14b53a', '#fcd116', '#ce1126'),
  GUI: V3('#ce1126', '#fcd116', '#009460'),
  BFA: '<rect width="30" height="10" fill="#ef2b2d"/><rect y="10" width="30" height="10" fill="#009e49"/>' + star(15, 10.3, 3, '#fcd116'),
  GAB: H3('#009e60', '#fcd116', '#3a75c4'),
  COD: '<rect width="30" height="20" fill="#007fff"/><path d="M-1 18L28 -1" stroke="#f7d618" stroke-width="6"/><path d="M-1 18L28 -1" stroke="#ce1021" stroke-width="3.6"/>' + star(5.5, 4.5, 2.6, '#f7d618'),
  JAM: '<rect width="30" height="20" fill="#009b3a"/><path d="M0 0L15 10 0 20zM30 0L15 10 30 20z" fill="#000"/><path d="M0 0L30 20M30 0L0 20" stroke="#fed100" stroke-width="2.6"/>',
  WAL: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#00b140"/><path d="M8 13l3-5 3 1 2-3 4 1 3-2 1 3-3 2 2 3-4 0-1 3-3-2-3 2z" fill="#d30731"/>',
  AUT: H3('#ed2939', '#fff', '#ed2939'),
  SVN: H3('#fff', '#005da4', '#ed1c24') + '<path d="M6 4h5v4q0 3-2.5 4Q6 11 6 8z" fill="#005da4" stroke="#ed1c24" stroke-width=".6"/>',
  SVK: H3('#fff', '#0b4ea2', '#ee1c25') + '<path d="M6 4.5h7v5.5q0 3.5-3.5 5Q6 13.5 6 10z" fill="#ee1c25" stroke="#fff" stroke-width=".7"/><rect x="8.9" y="6" width="1.2" height="6" fill="#fff"/><rect x="7.6" y="7.6" width="3.8" height="1" fill="#fff"/>',
  CZE: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0L15 10 0 20z" fill="#11457e"/>',
  SRB: H3('#c6363c', '#0c4076', '#fff') + '<rect x="7" y="5" width="4" height="7" rx="1.6" fill="#c6363c" stroke="#edb92e" stroke-width=".6"/>',
  ARM: H3('#d90012', '#0033a0', '#f2a800'),
  ROU: V3('#002b7f', '#fcd116', '#ce1126'),
  KOS: '<rect width="30" height="20" fill="#244aa5"/><path d="M11 9l4-2 4 1 2 3-3 4-4 0-3-2z" fill="#d0a650"/>' + [10, 13, 16, 19, 22].map((x, i) => star(x - 1, 5.2 - (i === 2 ? 0.6 : i % 2 ? 0.3 : 0), 0.9, '#fff')).join(''),
  ALB: '<rect width="30" height="20" fill="#e41e20"/><path d="M15 4l2 2 3-1-1 3 2 1-3 1 1 3-3-1-1 4-1-4-3 1 1-3-3-1 2-1-1-3 3 1z" fill="#000"/>',
  BIH: '<rect width="30" height="20" fill="#002395"/><path d="M8 0h14v20z" fill="#fecb00"/>' + [0, 1, 2, 3, 4, 5, 6].map((i) => star(6 + i * 2.2, 1.6 + i * 2.9, 0.9, '#fff')).join(''),
  MNE: '<rect width="30" height="20" fill="#c40308"/><rect x="1" y="1" width="28" height="18" fill="none" stroke="#d4af3a" stroke-width="1.4"/><path d="M15 6l2 2 2-1-1 3 1 2-4 2-4-2 1-2-1-3 2 1z" fill="#d4af3a"/>',
  GRE: '<rect width="30" height="20" fill="#0d5eaf"/>' + [2.22, 6.66, 11.1, 15.54].map((y) => `<rect y="${y}" width="30" height="2.22" fill="#fff"/>`).join('') + '<rect width="11.1" height="11.1" fill="#0d5eaf"/><rect x="4.44" width="2.22" height="11.1" fill="#fff"/><rect y="4.44" width="11.1" height="2.22" fill="#fff"/>',
  ISR: '<rect width="30" height="20" fill="#fff"/><rect y="2" width="30" height="3" fill="#0038b8"/><rect y="15" width="30" height="3" fill="#0038b8"/><path d="M15 6.4l3.2 5.5h-6.4zM15 13.6l-3.2-5.5h6.4z" fill="none" stroke="#0038b8" stroke-width=".9"/>',
  PAN: '<rect width="30" height="20" fill="#fff"/><rect x="15" width="15" height="10" fill="#d21034"/><rect y="10" width="15" height="10" fill="#005293"/>' + star(7.5, 5, 2.2, '#005293') + star(22.5, 15, 2.2, '#d21034'),
};

/** Small flag for a nation id (falls back to the 3-letter code). */
export function flag(id, w = 24) {
  const body = FLAGS[id];
  const h = Math.round(w * 2 / 3);
  if (!body) return `<span class="flag-code">${id}</span>`;
  return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 30 20" preserveAspectRatio="none"><g>${body}</g><rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/></svg>`;
}
