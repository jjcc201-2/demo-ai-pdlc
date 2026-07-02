import { Octokit } from "@octokit/rest";
import type { PublishRefs } from "@pdlc/workflow";
import { assertNoSecrets, type Publisher, type PublishTarget } from "./publisher.js";

export interface GitHubPublisherConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string;
}

export class GitHubPublisher implements Publisher {
  readonly name = "github";
  private readonly octokit: Octokit;

  constructor(private readonly cfg: GitHubPublisherConfig) {
    this.octokit = new Octokit({ auth: cfg.token });
  }

  async publish(target: PublishTarget): Promise<PublishRefs> {
    assertNoSecrets(target.markdown);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = `${this.cfg.pathPrefix.replace(/\/$/, "")}/BRD-${target.slug}-${stamp}.md`;
    const content = Buffer.from(target.markdown, "utf8").toString("base64");

    const message = `docs(brd): add ${target.slug}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`;

    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.cfg.owner,
      repo: this.cfg.repo,
      branch: this.cfg.branch,
      path: filePath,
      message,
      content,
    });

    return {
      github: {
        owner: this.cfg.owner,
        repo: this.cfg.repo,
        branch: this.cfg.branch,
        path: filePath,
        commitSha: data.commit.sha ?? "",
      },
    };
  }
}
