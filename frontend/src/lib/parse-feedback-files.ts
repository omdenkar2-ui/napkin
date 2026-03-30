/**
 * Extract feedback texts from any file type.
 * Handles: JSON (array of objects with feedback_text/text/content/message/body),
 * CSV, TSV, TXT, and falls back to raw text for anything else.
 */
export async function extractTextsFromFile(file: File): Promise<string[]> {
  const content = await file.text();
  const name = file.name.toLowerCase();

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

  // TXT / MD / any other text — split by double newline or line
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const chunks = content.split(/\n\n+/).filter((c) => c.trim().length > 0);
    return chunks.length > 1 ? chunks : content.split("\n").filter((l) => l.trim().length > 0);
  }

  // Fallback — split by lines
  return content.split("\n").filter((l) => l.trim().length > 0);
}