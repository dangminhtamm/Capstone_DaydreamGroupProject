import { useMemo, useState } from "react";
import {
  getDaysInMonth,
  getDaysInYear,
  toDateKey,
} from "@/lib/yearly-activity";

type YearlyEntry = {
  entryDate?: Date | string;
  createdAt: Date | string;
};

type YearlyActivityViewProps = {
  entries: YearlyEntry[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function getEntryDate(entry: YearlyEntry) {
  return new Date(entry.entryDate ?? entry.createdAt);
}

function getDateKey(date: Date) {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function YearlyActivityView({
  entries,
  selectedDate,
  onSelectDate,
}: YearlyActivityViewProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const entry of entries) {
      const date = getEntryDate(entry);
      if (Number.isFinite(date.getTime())) years.add(date.getFullYear());
    }
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((first, second) => second - first);
  }, [entries]);

  const [selectedYear, setSelectedYear] = useState(() => availableYears[0]);
  const activeYear = availableYears.includes(selectedYear)
    ? selectedYear
    : availableYears[0];

  const entryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const date = getEntryDate(entry);
      if (!Number.isFinite(date.getTime()) || date.getFullYear() !== activeYear)
        continue;
      const key = getDateKey(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [activeYear, entries]);

  const yearlyEntryCount = useMemo(
    () =>
      Array.from(entryCounts.values()).reduce(
        (total, count) => total + count,
        0,
      ),
    [entryCounts],
  );

  return (
    <section
      className="enterprise-card p-4 sm:p-5"
      aria-labelledby="yearly-activity-title"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="yearly-activity-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Yearly activity
            </h2>
            <span className="status-badge status-badge-success">
              {getDaysInYear(activeYear)} day nodes
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {yearlyEntryCount} entries across {entryCounts.size} active days.
            Select an active day to inspect it below.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Year
          <select
            value={activeYear}
            onChange={(event) => {
              setSelectedYear(Number(event.target.value));
              onSelectDate(null);
            }}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MONTHS.map((monthLabel, month) => {
          const firstDay = new Date(activeYear, month, 1).getDay();
          const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
          const daysInMonth = getDaysInMonth(activeYear, month);

          return (
            <div
              key={monthLabel}
              className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
            >
              <h3 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {monthLabel}
              </h3>
              <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
                {WEEKDAYS.map((weekday, index) => (
                  <span
                    key={`${weekday}-${index}`}
                    className="text-center text-[9px] font-semibold text-slate-400"
                  >
                    {weekday}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: mondayOffset }, (_, index) => (
                  <span
                    key={`empty-${index}`}
                    className="aspect-square"
                    aria-hidden="true"
                  />
                ))}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const dateKey = toDateKey(activeYear, month, day);
                  const count = entryCounts.get(dateKey) ?? 0;
                  const isSelected = selectedDate === dateKey;
                  const label = `${dateKey}: ${count} ${count === 1 ? "entry" : "entries"}`;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      title={label}
                      aria-label={label}
                      disabled={count === 0}
                      onClick={() => onSelectDate(isSelected ? null : dateKey)}
                      className={`aspect-square min-h-3 rounded-[3px] transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                        isSelected
                          ? "bg-indigo-700 ring-2 ring-indigo-300 dark:bg-indigo-300"
                          : count > 1
                            ? "cursor-pointer bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-400 dark:hover:bg-indigo-300"
                            : count === 1
                              ? "cursor-pointer bg-indigo-300 hover:bg-indigo-400 dark:bg-indigo-700 dark:hover:bg-indigo-600"
                              : "cursor-default bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      <span className="sr-only">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
