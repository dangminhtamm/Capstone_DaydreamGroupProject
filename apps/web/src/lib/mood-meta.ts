import { CloudRain, Scale, Sparkles, Waves, type LucideIcon } from "lucide-react";
import type { DiaryMood } from "@/lib/api-client";

export type MoodMeta = {
  value: DiaryMood;
  label: string;
  description: string;
  icon: LucideIcon;
  className: string;
};

export const MOOD_OPTIONS: MoodMeta[] = [
  {
    value: "great",
    label: "Energized",
    description: "Bright and motivated",
    icon: Sparkles,
    className: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/70 dark:bg-cyan-950/35 dark:text-cyan-200",
  },
  {
    value: "good",
    label: "Calm",
    description: "Grounded and steady",
    icon: Waves,
    className: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/70 dark:bg-indigo-950/35 dark:text-indigo-200",
  },
  {
    value: "neutral",
    label: "Balanced",
    description: "Even and reflective",
    icon: Scale,
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
  },
  {
    value: "bad",
    label: "Heavy",
    description: "Low or difficult",
    icon: CloudRain,
    className: "border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-900/70 dark:bg-pink-950/35 dark:text-pink-200",
  },
];

export const MOOD_META = Object.fromEntries(
  MOOD_OPTIONS.map((option) => [option.value, option]),
) as Record<DiaryMood, MoodMeta>;
