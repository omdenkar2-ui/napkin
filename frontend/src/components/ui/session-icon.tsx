"use client";

import { SESSION_ICONS } from "@/components/ui/icon-picker";

interface SessionIconProps {
  value: string;
  size?: number;
  className?: string;
}

export function SessionIcon({ value, size = 36, className }: SessionIconProps) {
  const found = SESSION_ICONS.find(i => i.name === value);

  if (found) {
    const Icon = found.icon;
    return (
      <span
        className={className}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size }}
      >
        <Icon size={Math.round(size * 0.65)} strokeWidth={1.5} color="var(--text-secondary)" />
      </span>
    );
  }

  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1 }}>
      {value}
    </span>
  );
}
