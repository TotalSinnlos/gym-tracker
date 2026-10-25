// The app's line icons (24 × 24, drawn with the text colour), taken from the design.

const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  dash: <path d="M6 12h12" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  progress: <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" />,
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5h.01" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="3" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  upload: <path d="M12 15V4M7 9l5-5 5 5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />,
  table: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M4 9h16M4 15h16M10 3v18" />
    </>
  ),
};

/** Filled (not outlined) icons. */
const FILLED = {
  play: <path d="M8 5v14l11-7z" />,
};

export type IconName = keyof typeof PATHS | keyof typeof FILLED;

/** `size`: "s" (16 px, bold, for small badges), "l" (28 px) or the default 22 px. */
export function Icon({ name, size }: { name: IconName; size?: "s" | "l" }) {
  const filled = name in FILLED;
  const className = ["i", size, filled && "fill"].filter(Boolean).join(" ");
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {filled ? FILLED[name as keyof typeof FILLED] : PATHS[name as keyof typeof PATHS]}
    </svg>
  );
}
