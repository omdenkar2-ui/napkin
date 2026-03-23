"use client";

interface FindingsActionBarProps {
  selectedCount: number;
  onContinue: () => void;
}

export function FindingsActionBar({
  selectedCount,
  onContinue,
}: FindingsActionBarProps) {
  return (
    <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border py-4 px-6 -mx-8">
      <div className="max-w-3xl mx-auto flex items-center justify-end">
        {selectedCount === 0 ? (
          <p className="text-sm text-muted">
            Select findings to action on &rarr;
          </p>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-colors w-full"
            style={{
              backgroundColor: "var(--accent-action)",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--accent-action-hover)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--accent-action)")
            }
          >
            Continue with {selectedCount} finding
            {selectedCount !== 1 ? "s" : ""} &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
