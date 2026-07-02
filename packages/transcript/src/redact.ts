import type { NormalizedTranscript } from "@pdlc/workflow";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

/** Replace obvious PII (emails, phone numbers, speaker names) with placeholders. */
export function redactPii(t: NormalizedTranscript): NormalizedTranscript {
  const speakerMap = new Map<string, string>();
  let counter = 1;
  const nextAlias = (name: string) => {
    if (!speakerMap.has(name)) speakerMap.set(name, `Speaker ${counter++}`);
    return speakerMap.get(name)!;
  };

  const redactText = (s: string) =>
    s.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");

  const segments = t.segments.map((s) => ({
    ...s,
    speaker: nextAlias(s.speaker),
    text: redactText(s.text),
  }));

  return {
    ...t,
    segments,
    rawText: segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
  };
}
