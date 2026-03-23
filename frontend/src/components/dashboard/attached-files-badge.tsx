interface AttachedFilesBadgeProps {
  count: number;
}

export function AttachedFilesBadge({ count }: AttachedFilesBadgeProps) {
  if (count === 0) return null;

  return (
    <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2 text-sm text-foreground">
      <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
      </svg>
      {count} feedback file{count !== 1 ? "s" : ""} attached
    </div>
  );
}
