import { authorize } from "./auth.ts";
import { json, type WorkspaceEnv } from "./contracts.ts";

export { AgentWorkspace } from "./workspace-do.ts";

export default {
  async fetch(request: Request, env: WorkspaceEnv): Promise<Response> {
    try {
      await authorize(request, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "access_denied";
      const code = /^access_[a-z0-9_]+$/.test(message)
        ? message
        : "access_denied";
      return json(
        { error: code },
        code === "access_configuration_missing" ? 503 : 401,
      );
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/v1\/workspaces\/([^/]+)(?:\/|$)/);
    if (!match) return json({ error: "route_not_found" }, 404);
    const workspaceKey = decodeURIComponent(match[1]);
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(workspaceKey)) {
      return json({ error: "workspace_key_invalid" }, 400);
    }
    if (!env.AX_WORKSPACE_KEY)
      return json({ error: "workspace_configuration_missing" }, 503);
    if (workspaceKey !== env.AX_WORKSPACE_KEY)
      return json({ error: "workspace_not_found" }, 404);
    const id = env.WORKSPACES.idFromName(workspaceKey);
    const stub = env.WORKSPACES.get(id);
    const headers = new Headers(request.headers);
    headers.set("x-ax-workspace-key", workspaceKey);
    return stub.fetch(new Request(request, { headers }));
  },
};
