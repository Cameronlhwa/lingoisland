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
        <path d="M4.5 10.5L12 4l7.5 6.5v8.25A1.25 1.25 0 0118.25 20h-4.5v-4.5h-3V20h-4.5A1.25 1.25 0 014.5 18.75V10.5z" />
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
        <path
          fillRule="evenodd"
          d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
          clipRule="evenodd"
        />
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
];
