"use client";

import {
  Home,
  Map,
  Layers,
  BookOpen,
  ClipboardList,
  Compass,
  Library,
  ClipboardCheck,
} from "lucide-react";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";

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

export const hskSidebarItems: SidebarItem[] = [
  {
    href: "/app",
    label: HSK_APP_LABELS.home.nav,
    icon: (className = iconClass) => (
      <Home className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/journey",
    label: HSK_APP_LABELS.journey.nav,
    icon: (className = iconClass) => (
      <Map className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/hsk-words",
    label: HSK_APP_LABELS.vocabulary.nav,
    icon: (className = iconClass) => (
      <Library className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/hsk-tests",
    label: HSK_APP_LABELS.tests.nav,
    icon: (className = iconClass) => (
      <ClipboardCheck className={className} aria-hidden strokeWidth={2} />
    ),
  },
  {
    href: "/app/hsk-flashcards",
    label: HSK_APP_LABELS.flashcards.nav,
    icon: (className = iconClass) => (
      <Layers className={className} aria-hidden strokeWidth={2} />
    ),
  },
];
