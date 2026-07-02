import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import type { NormalizedTranscript } from "@pdlc/workflow";
import { parseVtt } from "./vtt.js";

export interface GraphAuth {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

function makeClient(auth: GraphAuth): Client {
  const credential = new ClientSecretCredential(auth.tenantId, auth.clientId, auth.clientSecret);
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        if (!token) throw new Error("Failed to acquire Graph token");
        return token.token;
      },
    },
  });
}

export interface GraphTranscriptRef {
  userId: string;
  onlineMeetingId: string;
  transcriptId?: string;
}

/**
 * Fetch a Teams online-meeting transcript (VTT) via Microsoft Graph.
 * Requires OnlineMeetingTranscript.Read.All application permission.
 */
export async function fetchGraphTranscript(
  auth: GraphAuth,
  ref: GraphTranscriptRef,
): Promise<NormalizedTranscript> {
  const client = makeClient(auth);
  const base = `/users/${ref.userId}/onlineMeetings/${ref.onlineMeetingId}/transcripts`;

  let transcriptId = ref.transcriptId;
  if (!transcriptId) {
    const list = await client.api(base).get();
    const first = list?.value?.[0];
    if (!first) throw new Error("No transcripts found for meeting");
    transcriptId = first.id as string;
  }

  const vtt = (await client
    .api(`${base}/${transcriptId}/content?$format=text/vtt`)
    .responseType("text" as never)
    .get()) as string;

  return parseVtt(vtt, {
    source: "graph",
    meetingId: ref.onlineMeetingId,
  });
}
