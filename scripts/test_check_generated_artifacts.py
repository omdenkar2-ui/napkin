from pathlib import Path
import contextlib
import io
import subprocess
import tempfile
import unittest

from check_generated_artifacts import check_index, is_generated


class ArtifactHygieneTests(unittest.TestCase):
    def test_generated_paths_at_any_depth(self):
        for path in [".next/cache/.rscinfo", "frontend/.next/server/app.js",
                     "frontend/node_modules/next/package.json", ".vercel/output/config.json",
                     "frontend/.vercel/output/functions/index", "cache/.previewinfo"]:
            with self.subTest(path=path):
                self.assertTrue(is_generated(path))
        for path in ["frontend/next.config.ts", "docs/next-key-exposure.md",
                     "frontend/scripts/fresh-next-build.mjs"]:
            with self.subTest(path=path):
                self.assertFalse(is_generated(path))

    def test_force_added_ignored_artifact_is_rejected_without_reading_it(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            (repo / ".gitignore").write_text(".next/\n")
            cache = repo / ".next" / "cache"
            cache.mkdir(parents=True)
            fixture = cache / ".rscinfo"
            fixture.write_text("synthetic-content-must-never-be-logged")
            subprocess.run(["git", "add", ".gitignore"], cwd=repo, check=True)
            output = io.StringIO()
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                self.assertEqual(check_index(repo), 0)
                subprocess.run(["git", "add", "-f", str(fixture)], cwd=repo, check=True)
                self.assertEqual(check_index(repo), 1)
                subprocess.run(["git", "rm", "--cached", "-q", str(fixture)], cwd=repo, check=True)
                self.assertEqual(check_index(repo), 0)
            self.assertNotIn("synthetic-content", output.getvalue())


if __name__ == "__main__":
    unittest.main()
