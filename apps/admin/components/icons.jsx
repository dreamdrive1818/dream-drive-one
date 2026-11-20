const SIZE = 18;

function Svg({ children, size = SIZE, className = "ico", ...rest }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const PATHS = {
  layout: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  car: (
    <>
      <path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16" />
      <path d="M5 16h14v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2z" />
      <circle cx="7.5" cy="16" r="1.2" />
      <circle cx="16.5" cy="16" r="1.2" />
      <path d="M7 9l1-3h8l1 3" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18M9 16l2 2 4-4" />
    </>
  ),
  steering: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 5v4.5M7.2 17.5l3-3.2M16.8 17.5l-3-3.2" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L4 17l3 3 5.1-5.1a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.5-2.5 2.5-2.5z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="5" width="12" height="16" rx="2" />
      <path d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1M9 12h6M9 16h4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6l8-3z" />
      <path d="M9.5 12.5l1.8 1.8 3.7-3.8" />
    </>
  ),
  fileCheck: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5M9 14l2 2 4-4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4 4 0 0 1 6.5-3.1" />
    </>
  ),
  badge: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M12 11.5V14" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21h16M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </>
  ),
  handshake: (
    <>
      <path d="M8 13l-3-3a2 2 0 0 1 0-2.8l1.4-1.4a2 2 0 0 1 2.8 0L12 8.6" />
      <path d="M16 13l3-3a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L12 8.6" />
      <path d="M8.5 14.5L11 17l2-2 2 2 2.5-2.5" />
      <path d="M11 17v4M15 17v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 9a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0 0-4V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2z" />
      <path d="M12 7v10" />
    </>
  ),
  star: (
    <>
      <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8 6.7 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 17h12l-1.2-1.2a6.5 6.5 0 0 1-1.3-4V9a5.5 5.5 0 0 0-11 0v2.8c0 1.5-.5 2.9-1.3 4L6 17z" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </>
  ),
  creditCard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M4 18h16M12 4l9 6H3l9-6z" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 4v6h-6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 11v2a2 2 0 0 0 2 2h2l5 4V5L8 9H6a2 2 0 0 0-2 2z" />
      <path d="M18 8.5a4.5 4.5 0 0 1 0 7" />
      <path d="M8 15v3a2 2 0 0 0 2 2" />
    </>
  ),
  tag: (
    <>
      <path d="M20 12l-8 8-9-9V4h7l10 8z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  percent: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="16" cy="16" r="2.5" />
      <path d="M7 17L17 7" />
    </>
  ),
  map: (
    <>
      <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" />
      <path d="M9 4v13M15 7v13" />
    </>
  ),
  fileText: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12" />
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M3 16l5-4 4 3 3-2 6 4" />
    </>
  ),
  plane: (
    <>
      <path d="M10 18l-2 3h2l3-3 7 1-1-3-5-2V6.5A1.5 1.5 0 0 0 12.5 5 1.5 1.5 0 0 0 11 6.5V14l-5 2 1 3 3-1z" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l-1 0a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h1" />
      <path d="M15 12H8M15 12l-2.5-2.5M15 12L12.5 14.5" />
      <path d="M14 5h2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-2" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M10.5 12.5L20 3M17 4l2.5 2.5M15 6l2 2" />
    </>
  ),
  rupee: (
    <>
      <path d="M7 6h10M7 10h10M7 6c4 0 6 2 6 5s-2 5-6 5H9l6 5" />
    </>
  ),
  garage: (
    <>
      <path d="M3 10l9-6 9 6v10H3V10z" />
      <path d="M7 20v-7h10v7" />
    </>
  ),
  handoff: (
    <>
      <path d="M8 12V7a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v8" />
      <path d="M12 13V9a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v6" />
      <path d="M16 15v-2a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-3a2 2 0 0 1 2-2h1" />
    </>
  ),
};

export function Icon({ name, size = SIZE, className = "ico" }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <Svg size={size} className={className}>
      {body}
    </Svg>
  );
}

export const NAV_ICONS = {
  "/": "layout",
  "/bookings": "calendar",
  "/fleet": "car",
  "/availability": "calendarCheck",
  "/drivers": "steering",
  "/maintenance": "wrench",
  "/inspections": "clipboard",
  "/kyc": "shield",
  "/agreements": "fileCheck",
  "/customers": "users",
  "/staff": "badge",
  "/cities": "mapPin",
  "/branches": "building",
  "/partners": "handshake",
  "/tickets": "ticket",
  "/reviews": "star",
  "/notifications": "bell",
  "/payments": "creditCard",
  "/settlements": "bank",
  "/subscriptions": "refresh",
  "/reports": "chart",
  "/leads": "megaphone",
  "/offers": "tag",
  "/coupons": "percent",
  "/packages": "map",
  "/cms": "fileText",
  "/theme": "palette",
  "/banners": "image",
  "/getaways": "plane",
  "/blogs": "pen",
  "/media": "folder",
  "/audit": "activity",
};

export const GROUP_ICONS = {
  "": "layout",
  Operations: "calendar",
  Fleet: "car",
  People: "users",
  Network: "building",
  Support: "ticket",
  Finance: "creditCard",
  Growth: "megaphone",
  Content: "image",
  System: "activity",
};

export const DASH_ICONS = {
  handoversToday: "handoff",
  overdueReturns: "alert",
  pendingKyc: "shield",
  pendingSignatures: "key",
  failedPayments: "creditCard",
  workshop: "wrench",
  vehiclesAvailable: "car",
  bookings: "calendar",
  revenue: "rupee",
};
