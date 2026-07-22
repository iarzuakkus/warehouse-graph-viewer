import type { ReactNode } from "react";

export type AppIconName =
  | "active"
  | "add"
  | "aisle"
  | "analytics"
  | "arrow-left"
  | "arrow-right"
  | "capacity"
  | "check"
  | "close"
  | "cube"
  | "dashboard"
  | "distance"
  | "filter"
  | "location"
  | "map"
  | "play"
  | "refresh"
  | "reports"
  | "save"
  | "search"
  | "settings"
  | "simulation"
  | "sun"
  | "trash"
  | "user"
  | "warehouse"
  | "warning";

interface AppIconProps {
  readonly name: AppIconName;
  readonly className?: string;
}

export function AppIcon({ name, className }: AppIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<AppIconName, ReactNode> = {
  active: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <path d="m8.7 10 2.1 2.1 4.5-4.5" />
    </>
  ),
  add: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  aisle: (
    <>
      <path d="M4 20V7l5-3v16" />
      <path d="M15 20V4l5 3v13" />
      <path d="M2 20h20" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H2" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="m9 18 6-6-6-6" />
      <path d="M5 12h10" />
    </>
  ),
  capacity: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="m8 7 1-3h6l1 3" />
      <path d="M9 13h6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4.3 7.7 7.7 4.4 7.7-4.4" />
      <path d="M12 12v9" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  distance: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="m7.5 16.5 9-9" />
      <path d="M8 6H4v4" />
      <path d="M16 18h4v-4" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  location: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
      <path d="M16 18h.01" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7z" />,
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 8.5A7 7 0 0 1 18.7 7L20 12" />
      <path d="M17.9 15.5A7 7 0 0 1 5.3 17L4 12" />
    </>
  ),
  reports: (
    <>
      <path d="M6 2h9l4 4v16H6z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h12l2 2v16H5z" />
      <path d="M8 3v6h8V3" />
      <path d="M8 21v-7h8v7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.5h-4L10.5 6A7 7 0 0 0 9 7L6.6 6.1l-2 3.4L6.7 11a7 7 0 0 0 0 2l-2 1.5 2 3.4L9 17a7 7 0 0 0 1.5 1l.3 2.5h4L15 18a7 7 0 0 0 1.5-1l2.4.9 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
    </>
  ),
  simulation: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  warehouse: (
    <>
      <path d="m3 9 9-6 9 6v12H3z" />
      <path d="M7 13h10v8H7z" />
      <path d="M9 16h6" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.7 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
};
