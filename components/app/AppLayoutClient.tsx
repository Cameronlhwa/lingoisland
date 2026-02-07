"use client";

import { useState, createContext, useContext, useMemo } from "react";
import Sidebar from "@/components/app/Sidebar";
import AppLogo from "@/components/app/AppLogo";

// Create a context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarContextValue = useMemo(
    () => ({ isOpen: sidebarOpen, setIsOpen: setSidebarOpen }),
    [sidebarOpen]
  );

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <div className="min-h-screen bg-white">
        {/* Mobile Header with Menu Button */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <AppLogo
            size="sm"
            textClassName="text-lg font-bold text-gray-900"
          />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex flex-col gap-1.5 p-2"
            aria-label="Toggle sidebar"
          >
            <span
              className={`h-0.5 w-6 bg-gray-900 transition-all ${sidebarOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`h-0.5 w-6 bg-gray-900 transition-all ${sidebarOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-6 bg-gray-900 transition-all ${sidebarOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar />
        <main className="pt-16 md:pt-0 md:ml-64">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
