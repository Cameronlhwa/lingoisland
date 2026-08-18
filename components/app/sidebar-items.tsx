"use client";

import {
  Home,
  Map,
  Layers,
  BookOpen,
  ClipboardList,
  Compass,
} from "lucide-react";

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
      <Home className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/journey",
    label: "Journey",
    icon: (className = iconClass) => (
      <Map className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/topic-islands",
    label: "My Islands",
    icon: (className = iconClass) => (
      <Layers className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/browse-topics",
    label: "Browse Topics",
    icon: (className = iconClass) => (
      <Compass className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/stories",
    label: "Stories",
    icon: (className = iconClass) => (
      <BookOpen className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/quiz",
    label: "Quiz",
    icon: (className = iconClass) => (
      <ClipboardList className={className} aria-hidden strokeWidth={2} />
    ),
  },
];
