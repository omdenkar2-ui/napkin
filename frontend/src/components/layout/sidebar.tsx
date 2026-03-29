"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Sessions", href: "/sessions" },
  { label: "Decisions", href: "/decisions" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const hasGitHub = !!(user?.user_metadata?.provider_token || user?.app_metadata?.providers?.includes("github"));

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 220,
        height: "100vh",
        background: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        zIndex: 40,
        boxSizing: "border-box",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: 18,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            textDecoration: "none",
            display: "block",
          }}
        >
          napkin
        </Link>
      </div>

      {/* CTA */}
      <Link
        href="/new"
        style={{
          display: "block",
          width: "100%",
          padding: "7px 0",
          background: "#fff",
          color: "#000",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "var(--font-inter)",
          textAlign: "center",
          textDecoration: "none",
          marginBottom: 16,
          boxSizing: "border-box",
        }}
      >
        + New Session
      </Link>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "block",
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 400,
              fontFamily: "var(--font-inter)",
              textDecoration: "none",
              marginBottom: 2,
              color: isActive(item.href) ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)",
              background: isActive(item.href) ? "rgba(255,255,255,0.05)" : "transparent",
              transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isActive(item.href)) {
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.href)) {
                (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)";
              }
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.06)",
          margin: "12px 0",
        }}
      />

      {/* Settings */}
      <Link
        href="/settings"
        style={{
          display: "block",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 400,
          fontFamily: "var(--font-inter)",
          textDecoration: "none",
          marginBottom: hasGitHub ? 10 : 0,
          color: isActive("/settings") ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)",
          background: isActive("/settings") ? "rgba(255,255,255,0.05)" : "transparent",
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isActive("/settings")) {
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive("/settings")) {
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)";
          }
        }}
      >
        Settings
      </Link>

      {/* GitHub indicator */}
      {hasGitHub && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.28)",
              fontFamily: "var(--font-inter)",
            }}
          >
            connected
          </span>
        </div>
      )}
    </aside>
  );
}
