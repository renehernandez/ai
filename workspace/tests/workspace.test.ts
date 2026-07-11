import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { authorize } from "../src/auth.ts";
import worker from "../src/index.ts";

const headers = {
  "content-type": "application/json",
  "x-ax-dev-token": "test-token",
};
const base = "https://workspace.test/v1/workspaces/rene";

describe("agent workspace", () => {
  it("validates a signed Cloudflare Access JWT", async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const publicKey = (await crypto.subtle.exportKey(
      "jwk",
      pair.publicKey,
    )) as JsonWebKey & { kid: string };
    publicKey.kid = "test-key";
    const now = Math.floor(Date.now() / 1000);
    const encodedHeader = base64Url(
      JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }),
    );
    const encodedClaims = base64Url(
      JSON.stringify({
        aud: ["workspace-audience"],
        exp: now + 300,
        iss: "https://team.cloudflareaccess.com/cdn-cgi/access",
        nbf: now - 10,
        sub: "service-token",
      }),
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    );
    const token = `${encodedHeader}.${encodedClaims}.${base64Url(signature)}`;
    await expect(
      authorize(
        new Request("https://workspace.test", {
          headers: { "cf-access-jwt-assertion": token },
        }),
        {
          AX_ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
          AX_ACCESS_AUD: "workspace-audience",
        } as never,
        async () => Response.json({ keys: [publicKey] }),
      ),
    ).resolves.toBeUndefined();
  });

  it("fails closed without Access or an explicit development token", async () => {
    const response = await SELF.fetch(`${base}/status`);
    expect(response.status).toBe(503);

    const otherWorkspace = await SELF.fetch(
      "https://workspace.test/v1/workspaces/other/status",
      { headers },
    );
    expect(otherWorkspace.status).toBe(404);

    const malformed = await worker.fetch(
      new Request(`${base}/status`, {
        headers: { "cf-access-jwt-assertion": "not-json.x.y" },
      }),
      {
        AX_ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
        AX_ACCESS_AUD: "workspace-audience",
      } as never,
    );
    expect(await malformed.json()).toEqual({ error: "access_denied" });
  });

  it("bootstraps, routes work, and exports durable results", async () => {
    const oversized = await SELF.fetch(`${base}/bootstrap`, {
      method: "POST",
      headers,
      body: JSON.stringify({ records: [], padding: "x".repeat(1_000_000) }),
    });
    expect(oversized.status).toBe(413);

    const incompleteBootstrap = await SELF.fetch(`${base}/bootstrap`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        records: [
          {
            record_type: "decision",
            id: "INCOMPLETE",
            created_at: "2026-07-11T20:00:00Z",
            classification: "internal",
            summary: "Missing decision contract fields",
          },
        ],
      }),
    });
    expect(incompleteBootstrap.status).toBe(400);

    const root = {
      record_type: "root",
      id: "rene:delivery-ea",
      created_at: "2026-07-11T20:00:00Z",
      classification: "internal",
      summary: "Delivery Executive Assistant",
      agent_key: "delivery-ea",
      agent_role: "delivery-ea",
      reports_to: "rene",
      owned_scope: "delivery-portfolio",
      workspace_generation: 1,
      activation_state: "active",
      prompt_contract_version: "3.0.0",
      rendered_prompt_sha256: "a".repeat(64),
      model_profile: "pinned-delivery-standard",
      runtime_backend: "cloudflare-flue-v1",
      workspace_key: "rene",
      runtime_agent_id: "rene:delivery-ea",
      codex_task_id: null,
      memory_epoch_id: "rene:delivery-ea:memory:1",
    };
    const memory = {
      record_type: "memory",
      id: "rene:delivery-ea:memory:1",
      created_at: "2026-07-11T20:00:00Z",
      classification: "internal",
      summary: "Initial Delivery Executive Assistant memory.",
      epoch: 1,
      current: true,
      prompt_contract_version: "3.0.0",
      charter_summary: "Coordinate the delivery portfolio.",
      constraints: ["Cloudflare owns operational state."],
      decisions: ["Linear is readable context and durable output."],
      workstream_ids: ["rene:delivery-ea:bootstrap"],
      prior_epoch_id: null,
    };
    const workstream = {
      record_type: "workstream",
      id: "rene:delivery-ea:bootstrap",
      created_at: "2026-07-11T20:00:00Z",
      classification: "internal",
      summary: "Bootstrap the Cloudflare-native delivery workspace.",
      outcome: "Delivery Executive Assistant is ready for new intake.",
      status: "complete",
      owner: "delivery-ea",
      scope: "Create fresh workspace state.",
      acceptance: ["Root and memory are authoritative."],
      dependencies: [],
      risks: [],
      next_action: "Accept delivery intake.",
    };
    const bootstrapped = await SELF.fetch(`${base}/bootstrap`, {
      method: "POST",
      headers,
      body: JSON.stringify({ records: [root, memory, workstream] }),
    });
    expect(bootstrapped.status).toBe(201);
    expect(await bootstrapped.json()).toMatchObject({
      active: true,
      agents: 1,
      records: 3,
    });

    const storedRoot = await SELF.fetch(`${base}/records/rene:delivery-ea`, {
      headers,
    });
    expect(await storedRoot.json()).toMatchObject({
      runtime_backend: "cloudflare-flue-v1",
      workspace_generation: 1,
      workspace_key: "rene",
      runtime_agent_id: "rene:delivery-ea",
      codex_task_id: null,
    });

    const sent = await SELF.fetch(`${base}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        objective: "Summarize the delivery portfolio.",
        idempotency_id: "portfolio-summary-1",
        sandbox_mode: "workspace-write",
      }),
    });
    expect(sent.status).toBe(202);
    const receipt = (await sent.json()) as { operation_id: string };

    const duplicate = await SELF.fetch(`${base}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        objective: "Summarize the delivery portfolio.",
        idempotency_id: "portfolio-summary-1",
      }),
    });
    expect(await duplicate.json()).toMatchObject({
      duplicate: true,
      operation_id: receipt.operation_id,
    });

    const claimed = await SELF.fetch(`${base}/operations/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({ runner_id: "test-runner" }),
    });
    const claim = (await claimed.json()) as {
      operation: { workspace_generation: number };
      claim_token: string;
      context: Array<{ record_type: string; agent_key?: string }>;
    };
    expect(claim.operation.workspace_generation).toBe(1);
    expect(claim.operation).toMatchObject({ sandbox_mode: "read-only" });
    expect(claim.context).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record_type: "root",
          agent_key: "delivery-ea",
        }),
      ]),
    );

    const incompleteResult = await SELF.fetch(
      `${base}/operations/${receipt.operation_id}/complete`,
      {
        method: "POST",
        headers: { ...headers, "x-ax-claim-token": claim.claim_token },
        body: JSON.stringify({
          schema_version: 1,
          operation_id: receipt.operation_id,
          workspace_generation: 1,
          state: "complete",
          response: "Invalid record",
          checkpoints: [],
          record_mutations: [
            {
              action: "upsert",
              record: {
                record_type: "decision",
                id: "INCOMPLETE",
                created_at: "2026-07-11T20:00:00Z",
                classification: "internal",
                summary: "Missing decision contract fields",
              },
            },
          ],
          messages: [],
          projection_record_ids: [],
        }),
      },
    );
    expect(incompleteResult.status).toBe(400);

    const stale = await SELF.fetch(
      `${base}/operations/${receipt.operation_id}/complete`,
      {
        method: "POST",
        headers: { ...headers, "x-ax-claim-token": claim.claim_token },
        body: JSON.stringify({
          schema_version: 1,
          operation_id: receipt.operation_id,
          workspace_generation: 2,
          state: "complete",
          response: "Stale result",
          checkpoints: [],
          record_mutations: [],
          messages: [],
          projection_record_ids: [],
        }),
      },
    );
    expect(stale.status).toBe(409);

    const wrongClaim = await SELF.fetch(
      `${base}/operations/${receipt.operation_id}/complete`,
      {
        method: "POST",
        headers: { ...headers, "x-ax-claim-token": "wrong-token" },
        body: JSON.stringify({
          schema_version: 1,
          operation_id: receipt.operation_id,
          workspace_generation: 1,
          state: "complete",
          response: "Wrong claim",
          checkpoints: [],
          record_mutations: [],
          messages: [],
          projection_record_ids: [],
        }),
      },
    );
    expect(wrongClaim.status).toBe(409);

    const completed = await SELF.fetch(
      `${base}/operations/${receipt.operation_id}/complete`,
      {
        method: "POST",
        headers: { ...headers, "x-ax-claim-token": claim.claim_token },
        body: JSON.stringify({
          schema_version: 1,
          operation_id: receipt.operation_id,
          workspace_generation: 1,
          state: "complete",
          response: "Portfolio summarized.",
          checkpoints: ["Read current workstreams"],
          record_mutations: [
            {
              action: "upsert",
              record: {
                record_type: "root",
                id: "rene:gitlab-manager:ai",
                created_at: "2026-07-11T20:01:00Z",
                classification: "internal",
                summary: "AI repository manager",
                agent_key: "gitlab-manager:ai",
                agent_role: "gitlab-project-manager",
                reports_to: "delivery-ea",
                owned_scope: "renehernandez/ai",
                workspace_generation: 1,
                activation_state: "active",
                prompt_contract_version: "3.0.0",
                rendered_prompt_sha256: "b".repeat(64),
                model_profile: "pinned-delivery-standard",
                runtime_backend: "cloudflare-flue-v1",
                workspace_key: "rene",
                runtime_agent_id: "rene:gitlab-manager:ai",
                codex_task_id: null,
                memory_epoch_id: "rene:gitlab-manager:ai:memory:1",
              },
            },
            {
              action: "upsert",
              record: {
                record_type: "run",
                id: "RENE-RUN-1",
                created_at: "2026-07-11T20:01:00Z",
                classification: "restricted",
                summary: "Repository inventory",
                invocation_id: "inventory-1",
                state: "reserved",
                workspace_generation: 1,
                role_variant: "researcher",
                model_profile: "research-standard",
                model_routing_reason: "Bounded repository research",
                sandbox_mode: "workspace-write",
                tool_policy_attestation: "d".repeat(64),
                mode: "Explore",
                authority_grant: [],
                canonical_sources: [],
                objective: "Inventory the repository",
                acceptance: ["Return the relevant paths"],
                verification: ["Cite inspected files"],
                stop_condition: "Stop after the inventory",
                escalation_route: "delivery-ea",
                attempt: 1,
                worktree: "/tmp/authorized-repository",
              },
            },
            {
              action: "upsert",
              record: {
                record_type: "decision",
                id: "RENE-DECISION-1",
                created_at: "2026-07-11T20:02:00Z",
                classification: "restricted",
                summary: "Secret provider decision",
                question: "Which provider?",
                evidence: ["Private evidence"],
                owner: "delivery-ea",
                status: "requested",
              },
            },
          ],
          messages: [
            {
              to: "RENE-RUN-1",
              message_type: "ASSIGN",
              objective: "Inventory the repository",
            },
          ],
          projection_record_ids: [],
        }),
      },
    );
    expect(completed.status).toBe(200);

    const delegated = await SELF.fetch(`${base}/operations/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({ runner_id: "test-runner" }),
    });
    const delegatedClaim = (await delegated.json()) as {
      claim_token: string;
      operation: {
        operation_id: string;
        agent_key: string;
        model_profile: string;
      };
      context: Array<{ record_type: string; id: string; state?: string }>;
    };
    expect(delegatedClaim.operation.agent_key).toBe("RENE-RUN-1");
    expect(delegatedClaim.operation.model_profile).toBe("research-standard");
    expect(delegatedClaim.operation).toMatchObject({
      mode: "Explore",
      sandbox_mode: "workspace-write",
      objective: "Inventory the repository",
      acceptance: ["Return the relevant paths"],
      repo_path: "/tmp/authorized-repository",
    });
    expect(delegatedClaim.context).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record_type: "run",
          id: "RENE-RUN-1",
          state: "active",
        }),
      ]),
    );

    const delegatedFailure = await SELF.fetch(
      `${base}/operations/${delegatedClaim.operation.operation_id}/complete`,
      {
        method: "POST",
        headers: {
          ...headers,
          "x-ax-claim-token": delegatedClaim.claim_token,
        },
        body: JSON.stringify({
          schema_version: 1,
          operation_id: delegatedClaim.operation.operation_id,
          workspace_generation: 1,
          state: "failed",
          response: "Repository path unavailable",
          checkpoints: [],
          record_mutations: [],
          messages: [],
          projection_record_ids: [],
        }),
      },
    );
    expect(delegatedFailure.status).toBe(200);

    const settledRun = await SELF.fetch(`${base}/records/RENE-RUN-1`, {
      headers,
    });
    expect(await settledRun.json()).toMatchObject({ state: "failed" });

    const managerMessage = await SELF.fetch(`${base}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: "gitlab-manager:ai",
        objective: "Review the AI repository delivery state.",
      }),
    });
    expect(managerMessage.status).toBe(202);
    const managerClaim = await SELF.fetch(`${base}/operations/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({ runner_id: "test-runner" }),
    });
    const managerOperation = (await managerClaim.json()) as {
      operation: { agent_key: string };
    };
    expect(managerOperation.operation.agent_key).toBe("gitlab-manager:ai");

    const exported = await SELF.fetch(`${base}/linear/export`, { headers });
    const bundle = (await exported.json()) as {
      projections: Array<{
        entity_type: string;
        payload: {
          agent_key?: string;
          checkpoints?: string[];
          response?: string;
          summary?: string;
          question?: string;
        };
      }>;
    };
    expect(bundle.projections).toHaveLength(4);
    expect(
      bundle.projections.map((projection) => projection.entity_type),
    ).toEqual(
      expect.arrayContaining([
        "decision",
        "operation_result",
        "operation_result",
        "run",
      ]),
    );
    const decisionProjection = bundle.projections.find(
      (projection) => projection.entity_type === "decision",
    );
    expect(decisionProjection?.payload).toMatchObject({
      summary:
        "Restricted record. Open an authorized canonical source explicitly.",
    });
    expect(decisionProjection?.payload.question).toBeUndefined();
    const restrictedResult = bundle.projections.find(
      (projection) =>
        projection.entity_type === "operation_result" &&
        projection.payload.agent_key === "RENE-RUN-1",
    );
    expect(restrictedResult?.payload).toMatchObject({
      response:
        "Restricted operation result. Open an authorized canonical source explicitly.",
      checkpoints: [],
    });
  });
});

function base64Url(value: string | ArrayBuffer): string {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
