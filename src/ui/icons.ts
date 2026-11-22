// Authored 24px line icons, one stroke weight (2), round caps.
const p = (d: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const icon = {
  home: p('<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>'),
  live: p('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="m8 2 4 4 4-4"/><path d="M10 10v5l4-2.5z" fill="currentColor"/>'),
  star: p('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  starFill: p('<path fill="currentColor" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  clock: p('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  list: p('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
  search: p('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  play: p('<path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/>'),
  pause: p('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  prev: p('<path d="m15 6-6 6 6 6"/>'),
  next: p('<path d="m9 6 6 6-6 6"/>'),
  up: p('<path d="m6 15 6-6 6 6"/>'),
  down: p('<path d="m6 9 6 6 6-6"/>'),
  volume: p('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  mute: p('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>'),
  pip: p('<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="11.5" width="6" height="4.5" rx="1" fill="currentColor"/>'),
  sun: p('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  back: p('<path d="M15 5 8 12l7 7"/>'),
  full: p('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: p('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: p('<path d="M12 5v14M5 12h14"/>'),
  refresh: p('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  trash: p('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  file: p('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
  link: p('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  check: p('<path d="m5 12 5 5 9-10"/>'),
  alert: p('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>'),
};
