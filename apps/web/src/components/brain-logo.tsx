"use client";

import Link from "next/link";
import React from "react";

type BrainLogoProps = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "badge" | "transparent";
  showText?: boolean;
  textClassName?: string;
  subText?: string;
  href?: string;
};

export function BrainLogo({
  size = "md",
  variant = "badge",
  showText = false,
  textClassName = "",
  subText,
  href,
}: BrainLogoProps) {
  // Map sizing options to tailwind classes
  const sizeMap = {
    xs: { box: "h-6 w-6", svgSize: 24 },
    sm: { box: "h-9 w-9", svgSize: 36 },
    md: { box: "h-12 w-12", svgSize: 48 },
    lg: { box: "h-16 w-16", svgSize: 64 },
    xl: { box: "h-28 w-28", svgSize: 112 },
  };

  const currentSize = sizeMap[size];

  // Raw SVG representing the glowing digital brain
  const BrainSvg = () => (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full select-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="comp-brain-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="35%" stopColor="#0072FF" />
          <stop offset="65%" stopColor="#7B2CBF" />
          <stop offset="100%" stopColor="#FF007F" />
        </linearGradient>

        <filter id="comp-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        <filter id="comp-glow-deep" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
        </filter>

        <radialGradient id="comp-halo-cyan" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#00F0FF" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#00F0FF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="comp-halo-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0072FF" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#0072FF" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#0072FF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="comp-halo-purple" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7B2CBF" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#7B2CBF" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#7B2CBF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="comp-halo-pink" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF007F" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#FF007F" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#FF007F" stopOpacity={0} />
        </radialGradient>
      </defs>

      <g filter="url(#comp-glow-deep)" className="opacity-25" style={{ transformOrigin: "50% 50%" }}>
        <path d="M 46,60 L 37,60 L 23,49 L 32,33 L 49,31 L 66,33 L 77,49 L 61,60 L 54,60 Z" fill="url(#comp-brain-gradient)" />
      </g>

      <g fill="none">
        <g stroke="url(#comp-brain-gradient)" strokeLinecap="round" strokeLinejoin="round" opacity={0.25} filter="url(#comp-glow-blur)">
          <path d="M 46,60 L 41,60 L 41,64 L 37,64 L 37,60 L 25,60 L 23,49 L 26,38 L 32,33 L 43,28 L 49,31 L 58,28 L 66,33 L 74,38 L 77,49 L 74,60 L 61,60 L 54,60" strokeWidth={6} />
          <path d="M 48,60 L 48,74 A 2,2 0 0,0 52,74 L 52,60" strokeWidth={6} />
          <path d="M 23,49 L 44,48 M 23,49 L 32,33 M 37,60 L 44,48 M 32,33 L 44,48 M 49,31 L 44,48 M 44,48 L 47,60" strokeWidth={4} />
          <path d="M 49,31 L 60,45 M 60,45 L 66,33 M 60,45 L 77,49 M 60,45 L 61,60 M 60,45 L 53,60" strokeWidth={4} />
          <path d="M 44,48 L 60,45" strokeWidth={5} />
        </g>

        <g stroke="url(#comp-brain-gradient)" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} filter="url(#comp-glow-blur)">
          <path d="M 46,60 L 41,60 L 41,64 L 37,64 L 37,60 L 25,60 L 23,49 L 26,38 L 32,33 L 43,28 L 49,31 L 58,28 L 66,33 L 74,38 L 77,49 L 74,60 L 61,60 L 54,60" strokeWidth={3} />
          <path d="M 48,60 L 48,74 A 2,2 0 0,0 52,74 L 52,60" strokeWidth={3} />
          <path d="M 23,49 L 44,48 M 23,49 L 32,33 M 37,60 L 44,48 M 32,33 L 44,48 M 49,31 L 44,48 M 44,48 L 47,60" strokeWidth={2} />
          <path d="M 49,31 L 60,45 M 60,45 L 66,33 M 60,45 L 77,49 M 60,45 L 61,60 M 60,45 L 53,60" strokeWidth={2} />
          <path d="M 44,48 L 60,45" strokeWidth={2.5} />
        </g>

        <g stroke="url(#comp-brain-gradient)" strokeLinecap="round" strokeLinejoin="round" opacity={0.95}>
          <path d="M 46,60 L 41,60 L 41,64 L 37,64 L 37,60 L 25,60 L 23,49 L 26,38 L 32,33 L 43,28 L 49,31 L 58,28 L 66,33 L 74,38 L 77,49 L 74,60 L 61,60 L 54,60" strokeWidth={1.5} />
          <path d="M 48,60 L 48,74 A 2,2 0 0,0 52,74 L 52,60" strokeWidth={1.5} />
          <path d="M 23,49 L 44,48 M 23,49 L 32,33 M 37,60 L 44,48 M 32,33 L 44,48 M 49,31 L 44,48 M 44,48 L 47,60" strokeWidth={1} />
          <path d="M 49,31 L 60,45 M 60,45 L 66,33 M 60,45 L 77,49 M 60,45 L 61,60 M 60,45 L 53,60" strokeWidth={1} />
          <path d="M 44,48 L 60,45" strokeWidth={1.25} />
        </g>
      </g>

      <g style={{ transformOrigin: "50% 50%" }} className="transition-transform duration-500 ease-out">
        <circle cx="23" cy="49" r="6" fill="url(#comp-halo-cyan)" />
        <circle cx="23" cy="49" r="2.5" fill="#00F0FF" />
        <circle cx="23" cy="49" r="1" fill="#FFFFFF" />

        <circle cx="37" cy="60" r="5" fill="url(#comp-halo-cyan)" />
        <circle cx="37" cy="60" r="2" fill="#00F0FF" />
        <circle cx="37" cy="60" r="0.8" fill="#FFFFFF" />

        <circle cx="32" cy="33" r="5.5" fill="url(#comp-halo-cyan)" />
        <circle cx="32" cy="33" r="2.2" fill="#00D2FF" />
        <circle cx="32" cy="33" r="0.8" fill="#FFFFFF" />

        <circle cx="44" cy="48" r="6" fill="url(#comp-halo-blue)" />
        <circle cx="44" cy="48" r="2.5" fill="#0072FF" />
        <circle cx="44" cy="48" r="1" fill="#FFFFFF" />

        <circle cx="49" cy="31" r="5.5" fill="url(#comp-halo-purple)" />
        <circle cx="49" cy="31" r="2.2" fill="#7B2CBF" />
        <circle cx="49" cy="31" r="0.8" fill="#FFFFFF" />

        <circle cx="66" cy="33" r="5.5" fill="url(#comp-halo-pink)" />
        <circle cx="66" cy="33" r="2.2" fill="#C447FF" />
        <circle cx="66" cy="33" r="0.8" fill="#FFFFFF" />

        <circle cx="60" cy="45" r="5.5" fill="url(#comp-halo-purple)" />
        <circle cx="60" cy="45" r="2.2" fill="#E033FF" />
        <circle cx="60" cy="45" r="0.8" fill="#FFFFFF" />

        <circle cx="77" cy="49" r="6" fill="url(#comp-halo-pink)" />
        <circle cx="77" cy="49" r="2.5" fill="#FF007F" />
        <circle cx="77" cy="49" r="1" fill="#FFFFFF" />

        <circle cx="61" cy="60" r="5" fill="url(#comp-halo-pink)" />
        <circle cx="61" cy="60" r="2" fill="#FF007F" />
        <circle cx="61" cy="60" r="0.8" fill="#FFFFFF" />
      </g>
    </svg>
  );

  // Logo content wrapped based on variant
  const logoContent = (
    <div
      className={`group flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
        variant === "badge"
          ? "rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-[#02020e] border border-slate-800/80 shadow-[0_0_15px_-3px_rgba(123,44,191,0.2)] hover:shadow-[0_0_20px_0_rgba(0,240,255,0.25)] hover:border-slate-700/80 p-1.5"
          : "hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]"
      } ${currentSize.box}`}
    >
      <BrainSvg />
    </div>
  );

  // If href is provided, wrap in Next Link, otherwise return static layout
  const renderedLogo = href ? (
    <Link
      href={href}
      className="flex items-center gap-3 select-none outline-none"
      aria-label={showText ? undefined : "DayDreamer"}
    >
      {logoContent}
      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-center">
            <span className={`text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-50 transition-colors duration-300 ${textClassName}`}>
              Day<span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-indigo-400">Dreamer</span>
            </span>
          </div>
          {subText && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 -mt-1 select-none">
              {subText}
            </span>
          )}
        </div>
      )}
    </Link>
  ) : (
    <div className="flex items-center gap-3 select-none">
      {logoContent}
      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-center">
            <span className={`text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-50 transition-colors duration-300 ${textClassName}`}>
              Day<span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-indigo-400">Dreamer</span>
            </span>
          </div>
          {subText && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 -mt-1 select-none">
              {subText}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return renderedLogo;
}
