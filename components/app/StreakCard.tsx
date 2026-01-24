"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  buttonIconClass,
  buttonSecondaryClass,
  cardBaseClass,
  cardHoverClass,
} from "@/components/app/ui/styles";

interface ActivityData {
  date: string;
  count: number;
}

export default function StreakCard() {
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const { t } = useLanguage();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tzOffset = new Date().getTimezoneOffset();
        const month = currentMonth + 1;
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
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentYear, currentMonth]);

  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    activityData.forEach((entry) => {
      map.set(entry.date, entry.count);
    });
    return map;
  }, [activityData]);

  const today = useMemo(() => new Date(), []);
  const daysInMonth = useMemo(
    () => new Date(currentYear, currentMonth + 1, 0).getDate(),
    [currentYear, currentMonth]
  );
  const firstDayOfMonth = useMemo(
    () => new Date(currentYear, currentMonth, 1).getDay(),
    [currentYear, currentMonth]
  );

  const monthLabel = useMemo(() => {
    const monthNames = [
      t("January"),
      t("February"),
      t("March"),
      t("April"),
      t("May"),
      t("June"),
      t("July"),
      t("August"),
      t("September"),
      t("October"),
      t("November"),
      t("December"),
    ];
    return `${monthNames[currentMonth]} ${currentYear}`;
  }, [currentMonth, currentYear, t]);

  const dayLabels = useMemo(
    () => [t("Sun"), t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat")],
    [t]
  );

  const daysStudied = useMemo(
    () => activityData.filter((entry) => entry.count > 0).length,
    [activityData]
  );

  const currentStreak = useMemo(() => {
    const lastDay =
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth()
        ? today.getDate()
        : daysInMonth;
    let streak = 0;
    for (let day = lastDay; day >= 1; day -= 1) {
      const date = new Date(currentYear, currentMonth, day);
      const key = date.toISOString().slice(0, 10);
      const count = activityMap.get(key) || 0;
      if (count > 0) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [activityMap, currentMonth, currentYear, daysInMonth, today]);

  const bestStreak = useMemo(() => {
    let best = 0;
    let current = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(currentYear, currentMonth, day);
      const key = date.toISOString().slice(0, 10);
      const count = activityMap.get(key) || 0;
      if (count > 0) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    return best;
  }, [activityMap, currentMonth, currentYear, daysInMonth]);

  const getIntensityClass = (count: number): string => {
    if (count === 0) return "bg-gray-100";
    if (count < 25) return "bg-gray-300";
    if (count < 50) return "bg-gray-500";
    if (count < 100) return "bg-gray-700";
    return "bg-gray-900";
  };

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else if (
      currentYear < today.getFullYear() ||
      currentMonth < today.getMonth()
    ) {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  return (
    <div className={`${cardBaseClass} ${cardHoverClass} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("Activity")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t("Keep a steady learning rhythm.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth("prev")}
            className={buttonIconClass}
            aria-label={t("Previous month")}
          >
            ←
          </button>
          <button
            onClick={() => navigateMonth("next")}
            disabled={
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth()
            }
            className={`${buttonIconClass} disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label={t("Next month")}
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold text-gray-900">
          {monthLabel}
        </div>
        <div className="mb-1.5 grid grid-cols-7 gap-1 text-[10px] font-medium text-gray-500">
          {dayLabels.map((day, index) => (
            <div
              key={`${day}-${index}`}
              className="flex h-5 w-5 items-center justify-center"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${index}`} className="h-5 w-5" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = new Date(currentYear, currentMonth, day);
            const key = date.toISOString().slice(0, 10);
            const count = activityMap.get(key) || 0;
            const isToday =
              date.toDateString() === today.toDateString() &&
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth();
            const isFuture =
              date > today &&
              currentYear === today.getFullYear() &&
              currentMonth === today.getMonth();
            const tooltip = `${monthLabel} ${day}: ${
              count > 0 ? `${count} ${t("cards")}` : t("No activity")
            }`;

            return (
              <div
                key={key}
                title={tooltip}
                className={`flex h-5 w-5 items-center justify-center rounded ${getIntensityClass(
                  count
                )} ${isToday ? "ring-1 ring-gray-900" : ""} ${
                  isFuture ? "opacity-40" : ""
                }`}
                aria-label={tooltip}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("Days studied")}
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {daysStudied}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("Current streak")}
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {currentStreak}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("Best streak")}
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {bestStreak}
          </div>
        </div>
      </div>

    </div>
  );
}

