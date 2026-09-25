import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode, viewBox = '0 0 24 24') {
  return function Icon({ size = 20, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const CartIcon = make(
  <>
    <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H6.5" />
    <circle cx="9.5" cy="20" r="1" />
    <circle cx="17.5" cy="20" r="1" />
  </>,
);
export const BellIcon = make(
  <>
    <path d="M6 9a6 6 0 1 1 12 0v4l2 3H4l2-3z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </>,
);
export const MenuIcon = make(
  <>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </>,
);
export const CloseIcon = make(
  <>
    <path d="m6 6 12 12M18 6 6 18" />
  </>,
);
export const DownloadIcon = make(
  <>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </>,
);
export const ShieldIcon = make(
  <>
    <path d="M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6z" />
    <path d="m9.5 12 1.8 1.8L15 10" />
  </>,
);
export const StarIcon = make(
  <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
);
export const CheckIcon = make(<path d="m5 12 4.5 4.5L19 7" />);
export const ArrowRightIcon = make(
  <>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </>,
);
export const HomeIcon = make(
  <>
    <path d="m3 11 9-7 9 7" />
    <path d="M5 10v10h5v-6h4v6h5V10" />
  </>,
);
export const BoxIcon = make(
  <>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </>,
);
export const ReceiptIcon = make(
  <>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </>,
);
export const WalletIcon = make(
  <>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14.5" r="1" />
  </>,
);
export const SettingsIcon = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
);
export const UsersIcon = make(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 15.5a5 5 0 0 1 5.5 4.5" />
  </>,
);
export const LayersIcon = make(
  <>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
  </>,
);
export const TagIcon = make(
  <>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.2" />
  </>,
);
export const CreditCardIcon = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </>,
);
export const ChartIcon = make(
  <>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </>,
);
export const StoreIcon = make(
  <>
    <path d="M4 9 5.5 4h13L20 9" />
    <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    <path d="M5 11v9h14v-9M10 20v-5h4v5" />
  </>,
);
export const HeartIcon = make(
  <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />,
);
export const FlameIcon = make(
  <path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-5.5-3.5-8-1 2-2 3-3 3.5 0-2.5-1-5-3.5-7.5C9 6.5 5 9 5 15c0 4.2 3 7 7 7z" />,
);
export const CrownIcon = make(
  <>
    <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  </>,
);
export const LogoutIcon = make(
  <>
    <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
    <path d="m15 8 5 4-5 4M20 12H9" />
  </>,
);
export const BadgeCheckIcon = make(
  <>
    <path d="m12 2 2.4 1.7 2.9-.4 1 2.8 2.5 1.5-.5 2.9L22 12l-1.7 2.5.5 2.9-2.5 1.5-1 2.8-2.9-.4L12 22l-2.4-1.7-2.9.4-1-2.8-2.5-1.5.5-2.9L2 12l1.7-2.5-.5-2.9 2.5-1.5 1-2.8 2.9.4z" />
    <path d="m8.5 12 2.3 2.3L15.5 9.5" />
  </>,
);
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

// Category icons
export const CodeIcon = make(
  <>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" />
  </>,
);
export const BookIcon = make(
  <>
    <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
    <path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
  </>,
);
export const CapIcon = make(
  <>
    <path d="m2 9 10-5 10 5-10 5z" />
    <path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5M22 9v6" />
  </>,
);
export const PenIcon = make(
  <>
    <path d="m3 21 4-1L20 7a2 2 0 0 0-3-3L4 17z" />
    <path d="m14 6 4 4" />
  </>,
);
export const MusicIcon = make(
  <>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </>,
);
export const ImageIcon = make(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="m21 16-5-5-8 8" />
  </>,
);
export const MonitorIcon = make(
  <>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </>,
);
export const MegaphoneIcon = make(
  <>
    <path d="M3 10v4a1 1 0 0 0 1 1h3l8 4V5L7 9H4a1 1 0 0 0-1 1z" />
    <path d="M18 9a4 4 0 0 1 0 6" />
  </>,
);
export const PuzzleIcon = make(
  <>
    <path d="M10 3a2 2 0 0 1 2 2v1h4a1 1 0 0 1 1 1v4h1a2 2 0 1 1 0 4h-1v4a1 1 0 0 1-1 1h-4v-1a2 2 0 1 0-4 0v1H4a1 1 0 0 1-1-1v-4h1a2 2 0 1 0 0-4H3V7a1 1 0 0 1 1-1h4V5a2 2 0 0 1 2-2z" />
  </>,
);
export const GridIcon = make(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);

/** Picks an icon for a category slug; falls back to a generic grid. */
export function categoryIcon(slug: string) {
  if (/software|tool|app/.test(slug)) return CodeIcon;
  if (/book|doc/.test(slug)) return BookIcon;
  if (/course|learn|class/.test(slug)) return CapIcon;
  if (/template|theme|website/.test(slug)) return MonitorIcon;
  if (/graphic|design|illustration/.test(slug)) return PenIcon;
  if (/audio|music|sound/.test(slug)) return MusicIcon;
  if (/photo|image|stock|video/.test(slug)) return ImageIcon;
  if (/marketing|seo/.test(slug)) return MegaphoneIcon;
  if (/plugin|addon|extension/.test(slug)) return PuzzleIcon;
  return GridIcon;
}

export const NAV_ICONS = {
  home: HomeIcon,
  box: BoxIcon,
  receipt: ReceiptIcon,
  wallet: WalletIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  layers: LayersIcon,
  tag: TagIcon,
  card: CreditCardIcon,
  chart: ChartIcon,
  store: StoreIcon,
  check: BadgeCheckIcon,
  download: DownloadIcon,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
