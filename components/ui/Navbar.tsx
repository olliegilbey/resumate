"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Briefcase, Eye } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Monogram } from "./Monogram";
import resumeData from "@/data/resume-data.json";

/**
 * Top navigation bar.
 *
 * Visual: backdrop-blurred chrome strip (`.glass-light`) over the page
 * backdrop. The active link reads as a small clear glass pill so the
 * selection is felt as a *surface*, not a colour shift.
 *
 * @module components/ui/Navbar
 */
export function Navbar() {
  const pathname = usePathname();
  const fullName = resumeData.personal.name;

  // Generate initials from name (e.g., "Oliver Gilbey" → "OG"). Max 2 letters.
  const initials = fullName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/resume", label: "Resume", icon: Briefcase },
    { href: "/resume/view", label: "Experience", icon: Eye },
  ];

  return (
    <nav className="glass-light sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand — Kanagawa-tinted glass orb + name */}
          <Link href="/" className="flex items-center space-x-3 group">
            <Monogram initials={initials} className="transition-transform group-hover:scale-105" />
            <span className="font-medium tracking-tight text-slate-900 dark:text-slate-100 hidden sm:block">
              {fullName}
            </span>
          </Link>

          {/* Navigation Links + Theme Toggle */}
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              if (isActive) {
                // Active link reads as a small clear glass pill — same recipe
                // as the primary Button, hand-rolled here for sm size.
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-label={link.label}
                    aria-current="page"
                    className={cn(
                      "relative isolate inline-flex items-center justify-center gap-1.5 rounded-full",
                      "h-8 px-3 text-[13px] font-medium tracking-tight outline-none",
                      "text-slate-900 dark:text-slate-100",
                      "shadow-[0_4px_10px_-6px_oklch(0.30_0.04_240/0.16),0_1px_1px_oklch(0.30_0.04_240/0.08)]",
                      "dark:shadow-[0_4px_10px_-6px_oklch(0_0_0/0.30),0_1px_1px_oklch(0_0_0/0.20)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 overflow-hidden rounded-full",
                        "[backdrop-filter:blur(8px)_saturate(140%)] [-webkit-backdrop-filter:blur(8px)_saturate(140%)]",
                      )}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-full",
                        "bg-[linear-gradient(180deg,oklch(1_0_0/0.30),oklch(0.96_0.005_240/0.22))]",
                        "dark:bg-[linear-gradient(180deg,oklch(0.42_0.012_250/0.28),oklch(0.30_0.010_250/0.32))]",
                      )}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-full",
                        "shadow-[inset_0_1px_0_0_oklch(1_0_0/0.55),inset_0_0_0_1px_oklch(1_0_0/0.22),inset_0_-1px_0_0_oklch(0.30_0.04_240/0.10)]",
                        "dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18),inset_0_0_0_1px_oklch(1_0_0/0.06),inset_0_-1px_0_0_oklch(0_0_0/0.18)]",
                      )}
                    />
                    <Icon className="relative z-[1] h-3.5 w-3.5" aria-hidden="true" />
                    <span className="relative z-[1] hidden sm:inline">{link.label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
                    "text-[13px] font-medium tracking-tight outline-none",
                    "focus-visible:ring-2 focus-visible:ring-[oklch(0.54_0.14_240)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    "transition-colors duration-200",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}
            <div className="ml-2 pl-2 border-l border-slate-200/70 dark:border-slate-700/70">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
