"""Reject generated Next.js material in the Git index without reading its contents."""

from pathlib import Path, PurePosixPath
import subprocess
import sys


def is_generated(path: str) -> bool:
    parts = PurePosixPath(path).parts
    return (
        ".next" in parts
        or "node_modules" in parts
        or any(parts[i:i + 2] == (".vercel", "output") for i in range(len(parts) - 1))
        or PurePosixPath(path).name in {".previewinfo", ".rscinfo"}
    )


def check_index(repo: Path) -> int:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "-z"], cwd=repo, capture_output=True
    )
    if result.returncode:
        print("Cannot inspect the Git index.", file=sys.stderr)
        return 2
    count = sum(is_generated(path.decode("utf-8", errors="surrogateescape"))
                for path in result.stdout.split(b"\0") if path)
    if count:
        print(f"Blocked: {count} generated artifact(s) are tracked. Remove them from the index.",
              file=sys.stderr)
        return 1
    print("Git index contains no generated Next.js artifacts or dependencies.")
    return 0


if __name__ == "__main__":
    sys.exit(check_index(Path(__file__).resolve().parents[1]))
