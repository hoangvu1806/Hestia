import type { SVGProps } from "react";

type IconName =
  | "add"
  | "arrow"
  | "bookmark"
  | "camera"
  | "chat"
  | "chemistry"
  | "clock"
  | "ingredients"
  | "moon"
  | "paperclip"
  | "settings"
  | "shield"
  | "sun";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

const paths: Record<IconName, React.ReactNode> = {
  add: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h13m-5-5 5 5-5 5" />,
  bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.7L6 21Z" />,
  camera: <><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3A2 2 0 0 1 22 9.5v8A2 2 0 0 1 20 19H4a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
  chat: <path d="M20 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
  chemistry: <><path d="M9 3h6m-5 0v5l-5.5 9.2A2.5 2.5 0 0 0 6.7 21h10.6a2.5 2.5 0 0 0 2.2-3.8L14 8V3" /><path d="M7 16h10" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  ingredients: <><path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10" /><path d="M17 3v18m0-18c3 2 3 8 0 10" /></>,
  moon: <path d="M20.4 14.5A8 8 0 0 1 9.5 3.6 9 9 0 1 0 20.4 14.5Z" />,
  paperclip: <path d="m20.5 11.5-8.7 8.7a5 5 0 0 1-7.1-7.1l9.1-9.1a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.3-8.3" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21h-4v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.9-2.9.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3v-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1 2.9-2.9.1.1A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.5V3h4v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.9 2.9-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.1v4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>,
  shield: <><path d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
