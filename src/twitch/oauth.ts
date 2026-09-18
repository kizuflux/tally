import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { dataPath } from "../tally/store.ts";

export type TwitchTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  login: string;
};

const TOKEN_PATH = () => dataPath("twitch-token.json");

export function twitchAppConfigured(): boolean {
  return Boolean(
    process.env.TWITCH_CLIENT_ID?.trim() &&
      process.env.TWITCH_CLIENT_SECRET?.trim(),
  );
}

export function twitchRedirectUri(): string {
  const port = process.env.PORT || "8788";
  return (
    process.env.TWITCH_REDIRECT_URI?.trim() ||
    `http://127.0.0.1:${port}/api/twitch/callback`
  );
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? "",
    redirect_uri: twitchRedirectUri(),
    response_type: "code",
    scope: "user:read:chat",
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export async function loadTokens(): Promise<TwitchTokens | null> {
  try {
    const raw = JSON.parse(await readFile(TOKEN_PATH(), "utf8")) as TwitchTokens;
    if (!raw.access_token || !raw.refresh_token) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: TwitchTokens): Promise<void> {
  const path = TOKEN_PATH();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
}

export async function exchangeCode(code: string): Promise<TwitchTokens> {
  const body = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: twitchRedirectUri(),
  });
  const user = await helixUser(body.access_token);
  const tokens: TwitchTokens = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000 - 30_000,
    user_id: user.id,
    login: user.login,
  };
  await saveTokens(tokens);
  return tokens;
}

export async function validAccessToken(): Promise<TwitchTokens | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at) return tokens;
  try {
    const body = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    const next: TwitchTokens = {
      ...tokens,
      access_token: body.access_token,
      refresh_token: body.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + body.expires_in * 1000 - 30_000,
    };
    await saveTokens(next);
    return next;
  } catch {
    return null;
  }
}

export async function helixUser(
  accessToken: string,
  login?: string,
): Promise<{ id: string; login: string; display_name: string }> {
  const url = login
    ? `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`
    : "https://api.twitch.tv/helix/users";
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
    },
  });
  if (!response.ok) {
    throw new Error(`Twitch user lookup failed (${response.status})`);
  }
  const json = (await response.json()) as {
    data?: Array<{ id: string; login: string; display_name: string }>;
  };
  const user = json.data?.[0];
  if (!user) throw new Error("Twitch user not found");
  return user;
}

async function tokenRequest(
  extra: Record<string, string>,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? "",
    client_secret: process.env.TWITCH_CLIENT_SECRET ?? "",
    ...extra,
  });
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response.ok) {
    throw new Error(`Twitch token exchange failed (${response.status})`);
  }
  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
