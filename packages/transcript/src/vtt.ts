import type { NormalizedTranscript, TranscriptSegment } from "@pdlc/workflow";

const CUE_RE = /^(\d{2}:\d{2}:\d{2})\.\d{3} --> (\d{2}:\d{2}:\d{2})\.\d{3}/;

function toSeconds(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
}

/** Parse a WEBVTT transcript (Teams-exported) into normalized segments. */
export function parseVtt(vtt: string, meta: Partial<NormalizedTranscript> = {}): NormalizedTranscript {
  const segments: TranscriptSegment[] = [];
  const lines = vtt.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const cue = CUE_RE.exec(line);
    if (cue) {
      const startedAtSec = toSeconds(cue[1]!);
      i++;
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.trim() !== "") {
        buf.push(lines[i]!.trim());
        i++;
      }
      const joined = buf.join(" ");
      // Teams cues look like "<v Speaker Name>text</v>"
      const speakerMatch = /^<v ([^>]+)>(.*?)<\/v>$/.exec(joined);
      const speaker = speakerMatch ? speakerMatch[1]!.trim() : "Unknown";
      const text = (speakerMatch ? speakerMatch[2]! : joined).trim();
      if (text) segments.push({ speaker, text, startedAtSec });
    }
    i++;
  }
  const rawText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
  return {
    source: "manual",
    ...meta,
    segments,
    rawText,
  };
}
