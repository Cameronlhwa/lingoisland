"use client";

export type SidebarItem = {
  href: string;
  label: string;
  icon: (className?: string) => JSX.Element;
};

const iconClass = "h-5 w-5 text-gray-700";

export const sidebarItems: SidebarItem[] = [
  {
    href: "/app",
    label: "Home",
    icon: (className = iconClass) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm.75 4.5a.75.75 0 00-1.5 0V12c0 .414.336.75.75.75h3a.75.75 0 000-1.5h-2.25V8.5z" />
      </svg>
    ),
  },
  {
    href: "/app/topic-islands",
    label: "Topic Islands",
    icon: (className = iconClass) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25V6.75zm4.5 2.25h9a.75.75 0 000-1.5h-9a.75.75 0 000 1.5zm0 3h6a.75.75 0 000-1.5h-6a.75.75 0 000 1.5z" />
      </svg>
    ),
  },
  {
    href: "/app/stories",
    label: "Stories",
    icon: (className = iconClass) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M4.5 4.5A1.5 1.5 0 016 3h10.5A1.5 1.5 0 0118 4.5V6h-2V4.5H6V18h10v-1.5h2V18A1.5 1.5 0 0116.5 19.5H6A1.5 1.5 0 014.5 18z" />
        <path d="M10 8h9v10.5a1.5 1.5 0 01-1.5 1.5H10a1.5 1.5 0 01-1.5-1.5V9.5A1.5 1.5 0 0110 8zm1.5 3h5a.75.75 0 000-1.5h-5a.75.75 0 000 1.5zm0 3h5a.75.75 0 000-1.5h-5a.75.75 0 000 1.5zm0 3h3a.75.75 0 000-1.5h-3a.75.75 0 000 1.5z" />
      </svg>
    ),
  },
  {
    href: "/app/quiz",
    label: "Quiz",
    icon: (className = iconClass) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M6 4.5A1.5 1.5 0 017.5 3h9A1.5 1.5 0 0118 4.5v15A1.5 1.5 0 0116.5 21h-9A1.5 1.5 0 016 19.5v-15zM9 8.25a.75.75 0 000 1.5h6a.75.75 0 000-1.5H9zm0 4a.75.75 0 000 1.5h6a.75.75 0 000-1.5H9z" />
      </svg>
    ),
  },
  {
    href: "/app/chat",
    label: "Chat",
    icon: (className = iconClass) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M4.804 21.644A1.5 1.5 0 003 20.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v8.5A2.25 2.25 0 0118.75 17.5H9.664l-3.47 3.47a1.5 1.5 0 01-1.39.674z" />
      </svg>
    ),
  },
];
