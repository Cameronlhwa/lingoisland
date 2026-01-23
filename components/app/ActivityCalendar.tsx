"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ActivityData {
  date: string; // YYYY-MM-DD format
  count: number; // Number of reviews/cards studied
}

export default function ActivityCalendar() {
  const { t } = useLanguage();
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  useEffect(() => {
    loadActivityData();
  }, [currentYear, currentMonth]);

  const loadActivityData = async () => {
    try {
      const month = currentMonth + 1;
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `/api/quiz-activity?year=${currentYear}&month=${month}&tzOffset=${tzOffset}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("Failed to load activity");
      }
      const data = await response.json();
      setActivityData(data.activity || []);
    } catch (error) {
      console.error("Error loading activity data:", error);
      setActivityData([]);
    }
  };

  const getActivityForDate = (date: Date): number => {
    const dateStr = date.toISOString().split("T")[0];
    const activity = activityData.find((a) => a.date === dateStr);
    return activity?.count || 0;
  };

  const getIntensityClass = (count: number): string => {
    if (count === 0) return "bg-gray-100";
    if (count < 25) return "bg-gray-300";
    if (count < 50) return "bg-gray-500";
    if (count < 100) return "bg-gray-700";
    return "bg-gray-900";
  };

  const getIntensityLabel = (count: number): string => {
    if (count === 0) return "No activity";
    if (count === 1) return "1 card";
    return `${count} cards`;
  };

  // Get all days in the current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const today = new Date();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  // Calculate total activity for the month
  const totalActivity = activityData.reduce((sum, a) => sum + a.count, 0);
  const activeDays = activityData.filter((a) => a.count > 0).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t("Activity Calendar")}</h3>
          <p className="mt-0.5 text-xs text-gray-600">
            {monthNames[currentMonth]} {currentYear}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigateMonth("prev")}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            ←
          </button>
          <button
            onClick={() => navigateMonth("next")}
            disabled={
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth()
            }
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="mb-3">
        {/* Day labels */}
        <div className="mb-1.5 grid grid-cols-7 gap-0.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div
              key={`${day}-${index}`}
              className="text-center text-[10px] font-medium text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="relative grid grid-cols-7 gap-0.5">
          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square"></div>
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = new Date(currentYear, currentMonth, day);
            const rawCount = getActivityForDate(date);
            const isToday =
              date.toDateString() === today.toDateString() &&
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth();
            const isFuture = date > today;
            const count = isFuture ? 0 : rawCount;

            const isLightBackground = count === 0 || count === 1;
            
            return (
              <div
                key={day}
                className={`relative aspect-square rounded ${getIntensityClass(
                  count
                )} ${isToday ? "ring-1 ring-gray-900" : ""} ${
                  isFuture ? "opacity-30" : ""
                } cursor-pointer transition-all hover:scale-110 hover:z-10 hover:shadow-md`}
                title={`${monthNames[currentMonth]} ${day}, ${currentYear}: ${getIntensityLabel(
                  count
                )}`}
              >
                <div className={`flex h-full items-center justify-center text-[10px] font-medium ${
                  isLightBackground ? "text-gray-700" : "text-white"
                }`}>
                  {day}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend and Stats */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-3">
        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <span>{t("Less")}</span>
          <div className="flex gap-0.5">
            <div className="h-2 w-2 rounded bg-gray-100"></div>
            <div className="h-2 w-2 rounded bg-gray-300"></div>
            <div className="h-2 w-2 rounded bg-gray-500"></div>
            <div className="h-2 w-2 rounded bg-gray-700"></div>
            <div className="h-2 w-2 rounded bg-gray-900"></div>
          </div>
          <span>{t("More")}</span>
        </div>
        <div className="text-xs text-gray-600">
          <span className="font-medium">{totalActivity}</span> {t("cards in")}{" "}
          <span className="font-medium">{activeDays}</span> {t("days")}
        </div>
      </div>
    </div>
  );
}

