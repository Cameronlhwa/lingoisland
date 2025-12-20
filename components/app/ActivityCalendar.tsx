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
    // Load activity from localStorage (mock data for now)
    loadActivityData();
  }, [currentYear, currentMonth]);

  const loadActivityData = () => {
    // Get activity from localStorage or generate mock data
    const stored = localStorage.getItem("activity_calendar");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActivityData(parsed);
        return;
      } catch (e) {
        console.error("Error parsing activity data:", e);
      }
    }

    // Generate some mock activity for the current month
    const mockData: ActivityData[] = [];
    const today = new Date();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      if (date <= today) {
        // Random activity for past days
        const count = Math.floor(Math.random() * 5); // 0-4 reviews
        if (count > 0) {
          mockData.push({
            date: date.toISOString().split("T")[0],
            count,
          });
        }
      }
    }

    setActivityData(mockData);
  };

  const getActivityForDate = (date: Date): number => {
    const dateStr = date.toISOString().split("T")[0];
    const activity = activityData.find((a) => a.date === dateStr);
    return activity?.count || 0;
  };

  const getIntensityClass = (count: number): string => {
    if (count === 0) return "bg-gray-100";
    if (count === 1) return "bg-gray-300";
    if (count === 2) return "bg-gray-500";
    if (count === 3) return "bg-gray-700";
    return "bg-gray-900";
  };

  const getIntensityLabel = (count: number): string => {
    if (count === 0) return "No activity";
    if (count === 1) return "1 review";
    return `${count} reviews`;
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
        <div className="grid grid-cols-7 gap-0.5">
          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square"></div>
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = new Date(currentYear, currentMonth, day);
            const count = getActivityForDate(date);
            const isToday =
              date.toDateString() === today.toDateString() &&
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth();
            const isFuture = date > today;

            return (
              <div
                key={day}
                className={`aspect-square rounded ${getIntensityClass(
                  count
                )} ${isToday ? "ring-1 ring-gray-900" : ""} ${
                  isFuture ? "opacity-30" : ""
                } transition-transform hover:scale-110`}
                title={`${monthNames[currentMonth]} ${day}, ${currentYear}: ${getIntensityLabel(
                  count
                )}`}
              >
                <div className="flex h-full items-center justify-center text-[10px] font-medium text-white">
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
          <span className="font-medium">{totalActivity}</span> {t("reviews in")}{" "}
          <span className="font-medium">{activeDays}</span> {t("days")}
        </div>
      </div>
    </div>
  );
}

