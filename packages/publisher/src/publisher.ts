import type { PublishRefs } from "@pdlc/workflow";

export interface PublishTarget {
  slug: string;
  markdown: string;
}

/** Pluggable publisher — extend to Wiki / Confluence later. */
export interface Publisher {
  readonly name: string;
  publish(target: PublishTarget): Promise<PublishRefs>;
}

const SECRET_HINTS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /aws_secret_access_key/i,
];

export function assertNoSecrets(markdown: string): void {
  for (const re of SECRET_HINTS) {
    if (re.test(markdown)) {
      throw new Error(
        `Publisher refused: content matched a secret pattern (${re.source})`,
      );
    }
  }
}
