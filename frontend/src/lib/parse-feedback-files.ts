/**
 * Extract feedback texts from any file type.
 * Text-based formats (JSON, JSONL, CSV, TSV, TXT, MD) are parsed client-side.
 * Binary formats (PDF, DOCX) are sent to the backend for extraction.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BINARY_EXTENSIONS = new Set(["pdf", "docx"]);

function getExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function parseViaBackend(file: File): Promise<string[]> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/feedback/parse-file`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to parse file");
  }
  const data = await res.json();
  return data.texts ?? [];
}

export async function extractTextsFromFile(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  const ext = getExt(name);

  // Binary formats — delegate to backend
  if (BINARY_EXTENSIONS.has(ext)) {
    return parseViaBackend(file);
  }

  const content = await file.text();

  // JSON — extract text from any common field name
  if (name.endsWith(".json") || name.endsWith(".jsonl")) {
    try {
      const textFields = [
        "feedback_text", "feedback", "text", "content", "message",
        "body", "comment", "review", "note", "description", "summary",
        "response", "input", "query", "question", "answer",
      ];

      // Handle JSONL (one JSON object per line)
      if (name.endsWith(".jsonl")) {
        return content
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const obj = JSON.parse(line);
            for (const field of textFields) {
              if (obj[field] && typeof obj[field] === "string" && obj[field].trim()) {
                return obj[field].trim();
              }
            }
            return JSON.stringify(obj);
          })
          .filter(Boolean);
      }

      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      return items
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (typeof item === "object" && item !== null) {
            for (const field of textFields) {
              if (item[field] && typeof item[field] === "string" && item[field].trim()) {
                return item[field].trim();
              }
            }
            // If no known field, stringify the whole object
            return JSON.stringify(item);
          }
          return String(item);
        })
        .filter((t) => t && t.length > 0);
    } catch {
      // If JSON parse fails, treat as plain text
      return content.split("\n").filter((l) => l.trim().length > 0);
    }
  }

  // CSV / TSV — extract from common column names or concatenate all columns per row
  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    const separator = name.endsWith(".tsv") ? "\t" : ",";
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return lines;

    const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const textColNames = [
      "feedback_text", "feedback", "text", "content", "message",
      "body", "comment", "review", "note", "description",
    ];
    const textColIdx = headers.findIndex((h) => textColNames.includes(h));

    return lines.slice(1).map((line) => {
      const cols = line.split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (textColIdx >= 0 && cols[textColIdx]) {
        return cols[textColIdx];
      }
      return cols.join(" | ");
    }).filter((t) => t.length > 0);
  }

  // TXT / MD — split by double newline or line
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const chunks = content.split(/\n\n+/).filter((c) => c.trim().length > 0);
    return chunks.length > 1 ? chunks : content.split("\n").filter((l) => l.trim().length > 0);
  }

  // Fallback — try backend first for unknown types, fall back to line splitting
  try {
    return await parseViaBackend(file);
  } catch {
    return content.split("\n").filter((l) => l.trim().length > 0);
  }
}
