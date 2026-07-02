import { promises as fs } from "node:fs";
import path from "node:path";
import type { PublishRefs } from "@pdlc/workflow";
import { assertNoSecrets, type Publisher, type PublishTarget } from "./publisher.js";

export class LocalPublisher implements Publisher {
  readonly name = "local";
  constructor(private readonly outDir: string) {}

  async publish(target: PublishTarget): Promise<PublishRefs> {
    assertNoSecrets(target.markdown);
    await fs.mkdir(this.outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `BRD-${target.slug}-${stamp}.md`;
    const localPath = path.join(this.outDir, filename);
    await fs.writeFile(localPath, target.markdown, "utf8");
    return { localPath };
  }
}
