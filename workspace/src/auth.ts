import type { WorkspaceEnv } from "./contracts.ts";

type AccessClaims = {
  aud?: string | string[];
  exp?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
};

type Jwk = JsonWebKey & { kid?: string };

const keyCache = new Map<string, Promise<Jwk[]>>();

export async function authorize(
  request: Request,
  env: WorkspaceEnv,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const environment = env.AX_WORKSPACE_ENVIRONMENT ?? "production";
  if (environment !== "production" && env.AX_WORKSPACE_DEV_TOKEN) {
    const supplied = request.headers.get("x-ax-dev-token");
    if (supplied && timingSafeEqual(supplied, env.AX_WORKSPACE_DEV_TOKEN))
      return;
  }

  const teamDomain = normalizedTeamDomain(env.AX_ACCESS_TEAM_DOMAIN);
  const audience = env.AX_ACCESS_AUD;
  if (!teamDomain || !audience) throw new Error("access_configuration_missing");
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("access_token_missing");
  await verifyAccessJwt(token, teamDomain, audience, fetcher);
}

async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  audience: string,
  fetcher: typeof fetch,
): Promise<void> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("access_token_malformed");
  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodeJson<AccessClaims>(parts[1]);
  if (header.alg !== "RS256" || !header.kid)
    throw new Error("access_token_algorithm_invalid");
  const issuer = `${teamDomain}/cdn-cgi/access`;
  const now = Math.floor(Date.now() / 1000);
  const tolerance = 60;
  if (claims.iss !== issuer) throw new Error("access_token_issuer_invalid");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience))
    throw new Error("access_token_audience_invalid");
  if (!claims.exp || claims.exp < now - tolerance)
    throw new Error("access_token_expired");
  if (claims.nbf && claims.nbf > now + tolerance)
    throw new Error("access_token_not_active");

  let keys = await loadKeys(teamDomain, fetcher);
  let jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keyCache.delete(teamDomain);
    keys = await loadKeys(teamDomain, fetcher);
    jwk = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk) throw new Error("access_token_key_unknown");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error("access_token_signature_invalid");
}

function loadKeys(teamDomain: string, fetcher: typeof fetch): Promise<Jwk[]> {
  let cached = keyCache.get(teamDomain);
  if (!cached) {
    cached = fetcher(`${teamDomain}/cdn-cgi/access/certs`)
      .then(async (response) => {
        if (!response.ok) throw new Error("access_keys_unavailable");
        const body = (await response.json()) as { keys?: Jwk[] };
        if (!Array.isArray(body.keys)) throw new Error("access_keys_invalid");
        return body.keys;
      })
      .catch((error) => {
        keyCache.delete(teamDomain);
        throw error;
      });
    keyCache.set(teamDomain, cached);
  }
  return cached;
}

function normalizedTeamDomain(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\/$/, "");
}

function decodeJson<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(base64Url(part))) as T;
}

function base64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function timingSafeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
