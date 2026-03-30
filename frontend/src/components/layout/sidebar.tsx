"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/settings")
      return pathname === href || pathname.startsWith(href + "/");
    return pathname === href;
  };

  return (
    <aside className="fixed left-0 top-0 w-[68px] h-screen bg-sidebar-bg border-r border-[rgba(255,255,255,0.06)] flex flex-col items-center py-4 px-0 z-40">
      {/* Logo */}
      <Link href="/" className="w-10 h-10 mb-6 flex items-center justify-center">
        <img
          src="/logo_clean_final.png"
          className="w-8 h-8 object-contain"
          alt="Napkin"
        />
      </Link>

      {/* New session button */}
      <Link
        href="/"
        aria-label="New session"
        className="w-10 h-10 mb-6 rounded-full bg-white flex items-center justify-center hover:opacity-80 transition-opacity"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000000"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col items-center w-full px-2">
        {/* Sessions */}
        <Link
          href="/sessions"
          className={cn(
            "group flex flex-col items-center gap-1 py-2.5 w-full rounded-lg transition-colors",
            isActive("/sessions")
              ? "bg-[rgba(255,255,255,0.06)]"
              : "hover:bg-[rgba(255,255,255,0.03)]",
          )}
        >
          <svg
            className={cn(
              "w-5 h-5",
              isActive("/sessions")
                ? "text-[rgba(255,255,255,0.95)]"
                : "text-[rgba(255,255,255,0.45)] group-hover:text-[rgba(255,255,255,0.8)]",
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={cn(
              "text-[10px] font-medium tracking-wide",
              isActive("/sessions")
                ? "text-[rgba(255,255,255,0.85)]"
                : "text-[rgba(255,255,255,0.35)] group-hover:text-[rgba(255,255,255,0.7)]",
            )}
          >
            Sessions
          </span>
        </Link>

        {/* Decisions */}
        <Link
          href="/decisions"
          className={cn(
            "group flex flex-col items-center gap-1 py-2.5 w-full rounded-lg transition-colors",
            isActive("/decisions")
              ? "bg-[rgba(255,255,255,0.06)]"
              : "hover:bg-[rgba(255,255,255,0.03)]",
          )}
        >
          <svg
            className={cn(
              "w-5 h-5",
              isActive("/decisions")
                ? "text-[rgba(255,255,255,0.95)]"
                : "text-[rgba(255,255,255,0.45)] group-hover:text-[rgba(255,255,255,0.8)]",
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={cn(
              "text-[10px] font-medium tracking-wide",
              isActive("/decisions")
                ? "text-[rgba(255,255,255,0.85)]"
                : "text-[rgba(255,255,255,0.35)] group-hover:text-[rgba(255,255,255,0.7)]",
            )}
          >
            Decisions
          </span>
        </Link>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: Settings */}
      <div className="border-t border-[rgba(255,255,255,0.06)] pt-4 flex flex-col items-center w-full px-2">
        <Link
          href="/settings"
          className={cn(
            "group flex flex-col items-center gap-1 py-2.5 w-full rounded-lg transition-colors",
            isActive("/settings")
              ? "bg-[rgba(255,255,255,0.06)]"
              : "hover:bg-[rgba(255,255,255,0.03)]",
          )}
        >
          <svg
            className={cn(
              "w-5 h-5",
              isActive("/settings")
                ? "text-[rgba(255,255,255,0.95)]"
                : "text-[rgba(255,255,255,0.45)] group-hover:text-[rgba(255,255,255,0.8)]",
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={cn(
              "text-[10px] font-medium tracking-wide",
              isActive("/settings")
                ? "text-[rgba(255,255,255,0.85)]"
                : "text-[rgba(255,255,255,0.35)] group-hover:text-[rgba(255,255,255,0.7)]",
            )}
          >
            Settings
          </span>
        </Link>
      </div>
    </aside>
  );
}
