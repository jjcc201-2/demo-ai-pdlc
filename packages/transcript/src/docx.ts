import mammoth from "mammoth";
import type { NormalizedTranscript } from "@pdlc/workflow";

/** Parse a Teams-exported .docx transcript into a normalized transcript. */
export async function parseDocxBuffer(
  buffer: Buffer,
  meta: Partial<NormalizedTranscript> = {},
): Promise<NormalizedTranscript> {
  const { value } = await mammoth.extractRawText({ buffer });
  const lines = value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments = lines.map((line) => {
    const m = /^([^:]{2,60}):\s*(.+)$/.exec(line);
    if (m) return { speaker: m[1]!.trim(), text: m[2]!.trim() };
    return { speaker: "Unknown", text: line };
  });

  return {
    source: "manual",
    ...meta,
    segments,
    rawText: segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
  };
}
