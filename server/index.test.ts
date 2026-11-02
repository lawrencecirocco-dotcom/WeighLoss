import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import { DatabaseSync } from "node:sqlite";
import type { AddressInfo } from "node:net";
import { createApp } from "./index.js";

async function fixture(
  dataDir?: string,
  staticDir?: string,
  integrationOptions: NonNullable<Parameters<typeof createApp>[0]> = {},
) {
  const dir = dataDir ?? mkdtempSync(join(tmpdir(), "lighter-api-"));
  const service = createApp({
    dataDir: dir,
    mode: "development",
    authPassword: "",
    encryptionKey: "",
    staticDir: staticDir ?? false,
    openaiKey: "",
    fitbitClientId: "",
    fitbitClientSecret: "",
    ...integrationOptions,
  });
  const server = service.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    dir,
    stop: async (remove = true) => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      service.close();
      if (remove) rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("state starts empty, persists across server restarts, and validates JSON objects", async () => {
  let f = await fixture();
  try {
    assert.deepEqual(await (await fetch(`${f.url}/api/state`)).json(), {
      state: null,
    });
    const state = { profile: { name: "Tester" }, water: 500, meals: [] };
    const save = await fetch(`${f.url}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    assert.equal(save.status, 200);
    assert.equal(
      (
        await fetch(`${f.url}/api/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "[]",
        })
      ).status,
      400,
    );
    const { dir } = f;
    await f.stop(false);
    f = await fixture(dir);
    assert.deepEqual(await (await fetch(`${f.url}/api/state`)).json(), {
      state,
    });
  } finally {
    await f.stop();
  }
});

test("Fitbit OAuth state enables sync with total expenditure and latest metric weight", async () => {
  const requestedUrls: string[] = [];
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith("/oauth2/token"))
      return Response.json({
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
      });
    assert.equal(
      (init?.headers as Record<string, string>)["Accept-Language"],
      "en_AU",
    );
    if (url.includes("/activities/date/"))
      return Response.json({
        summary: { steps: 1234, caloriesOut: 2450 },
        activities: [
          {
            logId: 1,
            name: "Walk",
            duration: 1_800_000,
            calories: 200,
            startTime: "17:00",
          },
        ],
      });
    if (url.includes("/body/log/weight/"))
      return Response.json({
        weight: [
          { date: "2026-11-02", time: "08:00:00", weight: 80 },
          { date: "2026-10-10", time: "08:00:00", weight: 82 },
        ],
      });
    if (url.includes("/sleep/")) return new Response("", { status: 403 });
    if (url.includes("/activities/heart/"))
      return Response.json({
        "activities-heart": [{ value: { restingHeartRate: 60 } }],
      });
    if (url.includes("/foods/log/"))
      return Response.json({ summary: { calories: 1700 } });
    throw new Error("Unexpected external request");
  }) as typeof fetch;
  const f = await fixture(undefined, undefined, {
    fitbitClientId: "test-client",
    fitbitClientSecret: "test-secret",
    fetcher,
  });
  try {
    const begin = await fetch(`${f.url}/api/fitbit/connect`, {
      redirect: "manual",
    });
    assert.equal(begin.status, 302);
    const oauthState = new URL(begin.headers.get("location")!).searchParams.get(
      "state",
    );
    assert.ok(oauthState);
    const cookie = begin.headers.get("set-cookie")!.split(";")[0];
    const callback = await fetch(
      `${f.url}/api/fitbit/callback?state=${oauthState}&code=test-code`,
      { headers: { Cookie: cookie }, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location")!, /fitbit=connected$/);
    const integrations = (await (
      await fetch(`${f.url}/api/integrations`)
    ).json()) as any;
    assert.equal(integrations.fitbit.connected, true);
    assert.equal("access_token" in integrations.fitbit, false);
    const sync = (date: string) =>
      fetch(`${f.url}/api/fitbit/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
    assert.equal((await sync("2026-02-30")).status, 400);
    const result = (await (await sync("2026-11-02")).json()) as any;
    assert.equal(
      result.caloriesOut,
      2450,
      "workout calories must not be added to Fitbit total",
    );
    assert.equal(result.workouts[0].calories, 200);
    assert.equal(result.workouts[0].durationMinutes, 30);
    assert.equal(result.weightKg, 80);
    assert.equal(result.weightDate, "2026-11-02");
    assert.equal(
      result.sleepMinutes,
      null,
      "unavailable sleep must not appear as zero",
    );
    assert.equal(result.restingHeartRate, 60);
    assert.ok(
      requestedUrls.some((url) =>
        url.endsWith("/body/log/weight/date/2026-10-03/2026-11-02.json"),
      ),
    );
  } finally {
    await f.stop();
  }
});

test("integrations report missing setup honestly and callbacks reject unverified states", async () => {
  const f = await fixture();
  try {
    const integrations = (await (
      await fetch(`${f.url}/api/integrations`)
    ).json()) as any;
    assert.equal(integrations.fitbit.configured, false);
    assert.equal(integrations.fitbit.connected, false);
    assert.equal(integrations.ai.configured, false);
    assert.equal((await fetch(`${f.url}/api/fitbit/connect`)).status, 503);
    assert.equal(
      (await fetch(`${f.url}/api/fitbit/sync`, { method: "POST" })).status,
      503,
    );
    assert.equal(
      (await fetch(`${f.url}/api/fitbit/callback?state=madeup&code=madeup`))
        .status,
      400,
    );
    assert.equal(
      (await fetch(`${f.url}/api/food/analyze`, { method: "POST" })).status,
      503,
    );
    assert.equal(
      (await fetch(`${f.url}/api/snacks/suggest`, { method: "POST" })).status,
      503,
    );
  } finally {
    await f.stop();
  }
});

test("AI snack suggestions validate input and reject invented, duplicate or over-budget IDs", async () => {
  let output: any = {
    suggestions: [{ id: "apple", reason: "Fits your remaining budget." }],
    note: "These are alternative choices.",
  };
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return Response.json({
      choices: [{ message: { content: JSON.stringify(output) } }],
    });
  }) as typeof fetch;
  const f = await fixture(undefined, undefined, {
    openaiKey: "test-fixture-only",
    fetcher,
  });
  const body = {
    favorites: [
      { id: "apple", name: "Apple", calories: 80 },
      { id: "cake", name: "Cake", calories: 400 },
    ],
    remainingCalories: 200,
    hunger: 7,
  };
  const post = (input: unknown) =>
    fetch(`${f.url}/api/snacks/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  try {
    assert.equal((await post({ ...body, hunger: 11 })).status, 400);
    assert.equal((await post({ ...body, remainingCalories: -1 })).status, 400);
    assert.equal(
      (
        await post({
          ...body,
          favorites: [body.favorites[0], body.favorites[0]],
        })
      ).status,
      400,
    );
    assert.equal(calls, 0, "invalid user data must not be sent to AI");
    const valid = await post(body);
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), output);
    for (const suggestions of [
      [{ id: "invented", reason: "Wrong ID" }],
      [{ id: "cake", reason: "Too many calories" }],
      [
        { id: "apple", reason: "First" },
        { id: "apple", reason: "Duplicate" },
      ],
    ]) {
      output = { suggestions, note: "Test output" };
      const response = await post(body);
      assert.equal(response.status, 502);
      assert.equal(
        ((await response.json()) as any).error,
        "invalid_suggestions",
      );
    }
  } finally {
    await f.stop();
  }
});

test("photo upload preserves image, supports removal, and rejects disguised files", async () => {
  // Match the real hidden .data ancestor, which Express otherwise refuses to serve.
  const parent = mkdtempSync(join(tmpdir(), "lighter-photo-"));
  const f = await fixture(join(parent, ".data"));
  try {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPoW1QBAANqAan1p9SSAAAAAElFTkSuQmCC",
      "base64",
    );
    const data = new FormData();
    data.set("photo", new Blob([png], { type: "image/png" }), "image.png");
    const response = await fetch(`${f.url}/api/photos`, {
      method: "POST",
      body: data,
    });
    assert.equal(response.status, 201);
    const saved = (await response.json()) as any;
    const retrieved = await fetch(`${f.url}${saved.url}`);
    assert.equal(retrieved.status, 200);
    assert.equal(retrieved.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await retrieved.arrayBuffer()), png);
    assert.equal(
      (await fetch(`${f.url}${saved.url}`, { method: "DELETE" })).status,
      200,
    );
    assert.equal((await fetch(`${f.url}${saved.url}`)).status, 404);
    const invalid = new FormData();
    invalid.set(
      "photo",
      new Blob(["<script>alert(1)</script>"], { type: "image/png" }),
      "image.png",
    );
    assert.equal(
      (await fetch(`${f.url}/api/photos`, { method: "POST", body: invalid }))
        .status,
      415,
    );
  } finally {
    await f.stop();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("cross-origin browser requests cannot read or mutate private state", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await fetch(`${f.url}/api/state`, {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${f.url}/api/state`, {
          method: "PUT",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${f.url}/api/state`, {
          headers: { Origin: "http://localhost:5173" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${f.url}/api/state`, {
          headers: { Origin: "http://localhost:3001" },
        })
      ).status,
      200,
    );
    // Fetch normalizes Host itself, so use a raw local HTTP request for rebinding protection.
    const hostStatus = await new Promise<number>((resolve, reject) => {
      request(
        `${f.url}/api/state`,
        { headers: { Host: "attacker.example" } },
        (response) => {
          response.resume();
          response.once("end", () => resolve(response.statusCode ?? 0));
        },
      )
        .on("error", reject)
        .end();
    });
    assert.equal(hostStatus, 403);
  } finally {
    await f.stop();
  }
});

test("built UI serves HTML and assets without masking API, upload, or asset 404s", async () => {
  const staticDir = mkdtempSync(join(tmpdir(), "lighter-static-"));
  mkdirSync(join(staticDir, "assets"));
  writeFileSync(
    join(staticDir, "index.html"),
    '<!doctype html><title>Lighter</title><div id="root"></div>',
  );
  writeFileSync(join(staticDir, "assets", "app.js"), 'console.log("app")');
  const f = await fixture(undefined, staticDir);
  try {
    const home = await fetch(f.url);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await home.text(), /<title>Lighter<\/title>/);
    assert.equal((await fetch(`${f.url}/progress`)).status, 200);
    assert.equal(
      await (await fetch(`${f.url}/assets/app.js`)).text(),
      'console.log("app")',
    );
    assert.deepEqual(await (await fetch(`${f.url}/api/health`)).json(), {
      ok: true,
      storage: "sqlite",
    });
    for (const path of [
      "/api/unknown",
      "/uploads/unknown",
      "/assets/missing",
      "/missing.js",
      "/.env",
    ]) {
      const response = await fetch(`${f.url}${path}`);
      assert.equal(response.status, 404, path);
      assert.equal(((await response.json()) as any).error, "not_found", path);
    }
  } finally {
    await f.stop();
    rmSync(staticDir, { recursive: true, force: true });
  }
});

const ownerPassword = "test-owner-password-only";
const storageKey = "test-encryption-material-only-not-a-real-secret";
const ownerConfig = {
  mode: "production" as const,
  authPassword: ownerPassword,
  encryptionKey: storageKey,
  appOrigin: "https://lighter.example",
};
async function signIn(url: string, password = ownerPassword) {
  return fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

test("production fails closed without owner password and encrypted storage", async () => {
  const f = await fixture(undefined, undefined, {
    mode: "production",
    authPassword: "",
    encryptionKey: "",
  });
  try {
    const health = await fetch(`${f.url}/api/health`);
    assert.equal(health.status, 503);
    assert.deepEqual(await health.json(), { ok: false, setupRequired: true });
    assert.deepEqual(await (await fetch(`${f.url}/api/auth/status`)).json(), {
      required: true,
      authenticated: false,
      setupRequired: true,
    });
    assert.equal((await signIn(f.url)).status, 503);
    for (const path of [
      "/api/state",
      "/api/photos/id",
      "/api/integrations",
      "/api/setup",
      "/api/fitbit/callback?code=anything",
    ])
      assert.equal((await fetch(f.url + path)).status, 503, path);
  } finally {
    await f.stop();
  }
});

test("owner session protects every private route, survives restart, and logout revokes it", async () => {
  let f = await fixture(undefined, undefined, ownerConfig);
  try {
    assert.deepEqual(await (await fetch(`${f.url}/api/auth/status`)).json(), {
      required: true,
      authenticated: false,
      setupRequired: false,
    });
    for (const [method, path] of [
      ["GET", "/api/state"],
      ["PUT", "/api/state"],
      ["GET", "/api/photos/id"],
      ["POST", "/api/photos"],
      ["POST", "/api/food/analyze"],
      ["POST", "/api/snacks/suggest"],
      ["GET", "/api/fitbit/connect"],
      ["GET", "/api/fitbit/callback?code=anything"],
      ["POST", "/api/setup/credentials"],
    ]) {
      assert.equal(
        (await fetch(f.url + path, { method, redirect: "manual" })).status,
        401,
        `${method} ${path}`,
      );
    }
    assert.equal((await signIn(f.url, "wrong-password")).status, 401);
    const login = await signIn(f.url);
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { ok: true });
    const header = login.headers.get("set-cookie")!;
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);
    const cookie = header.split(";")[0];
    assert.deepEqual(
      await (
        await fetch(`${f.url}/api/auth/status`, { headers: { Cookie: cookie } })
      ).json(),
      { required: true, authenticated: true, setupRequired: false },
    );
    assert.equal(
      (await fetch(`${f.url}/api/state`, { headers: { Cookie: cookie } }))
        .status,
      200,
    );
    const db = new DatabaseSync(join(f.dir, "weighloss.sqlite"));
    const sessions = db
      .prepare("SELECT token_hash FROM owner_sessions")
      .all() as { token_hash: string }[];
    db.close();
    assert.equal(sessions.length, 1);
    assert.ok(!sessions[0].token_hash.includes(cookie.split("=")[1]));
    const dir = f.dir;
    await f.stop(false);
    f = await fixture(dir, undefined, ownerConfig);
    assert.equal(
      (await fetch(`${f.url}/api/state`, { headers: { Cookie: cookie } }))
        .status,
      200,
    );
    assert.equal(
      (
        await fetch(`${f.url}/api/auth/logout`, {
          method: "POST",
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(`${f.url}/api/state`, { headers: { Cookie: cookie } }))
        .status,
      401,
    );
  } finally {
    await f.stop();
  }
});

test("repeated failed owner sign-ins are rate limited", async () => {
  const f = await fixture(undefined, undefined, ownerConfig);
  try {
    for (let i = 0; i < 5; i++)
      assert.equal((await signIn(f.url, "incorrect")).status, 401);
    const blocked = await signIn(f.url);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  } finally {
    await f.stop();
  }
});

test("private setup saves encrypted provider credentials, exposes only status, and encrypts Fitbit tokens", async () => {
  const calls: { url: string; authorization: string | undefined }[] = [];
  const fetcher = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(input),
      authorization: (init?.headers as Record<string, string>)?.Authorization,
    });
    return Response.json({
      access_token: "test-owner-fitbit-access",
      refresh_token: "test-owner-fitbit-refresh",
      expires_in: 3600,
    });
  }) as typeof fetch;
  const f = await fixture(undefined, undefined, { ...ownerConfig, fetcher });
  try {
    const login = await signIn(f.url);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const setup = (await (
      await fetch(`${f.url}/api/setup`, { headers })
    ).json()) as any;
    assert.deepEqual(setup, {
      appUrl: "https://lighter.example",
      fitbitRedirectUri: "https://lighter.example/api/fitbit/callback",
      fitbitConfigured: false,
      aiConfigured: false,
      secure: true,
    });
    const clientId = "test-saved-fitbit-client";
    const clientSecret = "test-saved-fitbit-secret";
    const apiKey = "test-saved-ai-key";
    assert.equal(
      (
        await fetch(`${f.url}/api/setup/credentials`, {
          method: "POST",
          headers,
          body: JSON.stringify({ provider: "fitbit", clientId, clientSecret }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${f.url}/api/setup/credentials`, {
          method: "POST",
          headers,
          body: JSON.stringify({ provider: "ai", apiKey }),
        })
      ).status,
      200,
    );
    const visible = await (
      await fetch(`${f.url}/api/setup`, { headers })
    ).text();
    assert.ok(!visible.includes(clientId));
    assert.ok(!visible.includes(clientSecret));
    assert.ok(!visible.includes(apiKey));
    const integrations = (await (
      await fetch(`${f.url}/api/integrations`, { headers })
    ).json()) as any;
    assert.equal(integrations.fitbit.configured, true);
    assert.equal(integrations.ai.configured, true);
    const begin = await fetch(`${f.url}/api/fitbit/connect`, {
      headers,
      redirect: "manual",
    });
    const location = new URL(begin.headers.get("location")!);
    assert.equal(location.searchParams.get("client_id"), clientId);
    const state = location.searchParams.get("state");
    const oauthCookie = begin.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await fetch(
          `${f.url}/api/fitbit/callback?state=${state}&code=owner-code`,
          {
            headers: { Cookie: `${cookie}; ${oauthCookie}` },
            redirect: "manual",
          },
        )
      ).status,
      302,
    );
    assert.equal(
      calls[0].authorization,
      `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    );
    const db = new DatabaseSync(join(f.dir, "weighloss.sqlite"));
    const raw = db
      .prepare("SELECT key,value FROM settings WHERE key IN (?,?)")
      .all("integration_credentials", "fitbit_tokens") as {
      key: string;
      value: string;
    }[];
    db.close();
    assert.equal(raw.length, 2);
    for (const row of raw) {
      assert.equal(JSON.parse(row.value).encrypted, true);
      for (const plain of [
        clientId,
        clientSecret,
        apiKey,
        "test-owner-fitbit-access",
        "test-owner-fitbit-refresh",
      ])
        assert.ok(!row.value.includes(plain), `${row.key} must be encrypted`);
    }
    assert.equal(
      (
        (await (
          await fetch(`${f.url}/api/integrations`, { headers })
        ).json()) as any
      ).fitbit.connected,
      true,
    );
  } finally {
    await f.stop();
  }
});

test("password rotation invalidates persisted owner sessions", async () => {
  let f = await fixture(undefined, undefined, ownerConfig);
  try {
    const login = await signIn(f.url);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const dir = f.dir;
    await f.stop(false);
    f = await fixture(dir, undefined, {
      ...ownerConfig,
      authPassword: "a-different-owner-password",
    });
    assert.equal(
      (await fetch(`${f.url}/api/state`, { headers: { Cookie: cookie } }))
        .status,
      401,
    );
    assert.equal(
      (await signIn(f.url, "a-different-owner-password")).status,
      200,
    );
  } finally {
    await f.stop();
  }
});

test("legacy local Fitbit tokens migrate into encryption and a wrong key cannot use them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lighter-migration-"));
  let f = await fixture(dir);
  const db = new DatabaseSync(join(dir, "weighloss.sqlite"));
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run(
    "fitbit_tokens",
    JSON.stringify({
      access_token: "test-legacy-access",
      refresh_token: "test-legacy-refresh",
      expires_at: Date.now() + 3600000,
    }),
  );
  db.close();
  await f.stop(false);
  f = await fixture(dir, undefined, { encryptionKey: storageKey });
  try {
    assert.equal(
      ((await (await fetch(`${f.url}/api/integrations`)).json()) as any).fitbit
        .connected,
      true,
    );
    const encryptedDb = new DatabaseSync(join(dir, "weighloss.sqlite"));
    const row = encryptedDb
      .prepare("SELECT value FROM settings WHERE key=?")
      .get("fitbit_tokens") as { value: string };
    encryptedDb.close();
    assert.equal(JSON.parse(row.value).encrypted, true);
    assert.ok(!row.value.includes("test-legacy-access"));
    await f.stop(false);
    f = await fixture(dir, undefined, {
      ...ownerConfig,
      encryptionKey: "a-different-test-encryption-key-not-real",
    });
    const login = await signIn(f.url);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const failed = await fetch(`${f.url}/api/integrations`, {
      headers: { Cookie: cookie },
    });
    assert.equal(failed.status, 503);
    assert.ok(!(await failed.text()).includes("test-legacy-access"));
    assert.equal(
      (await fetch(`${f.url}/api/state`, { headers: { Cookie: cookie } }))
        .status,
      200,
      "connection storage failure does not prevent accessing separate owner records",
    );
    assert.equal(
      (
        await fetch(`${f.url}/api/auth/logout`, {
          method: "POST",
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
  } finally {
    await f.stop();
  }
});

test(
  "host-managed disk starts and preserves data when chmod on the mount root is forbidden",
  { concurrency: false },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), "lighter-managed-disk-"));
    fs.chmodSync(dir, 0o755);
    const originalChmod = fs.chmodSync;
    t.mock.method(
      fs,
      "chmodSync",
      (
        path: Parameters<typeof fs.chmodSync>[0],
        mode: Parameters<typeof fs.chmodSync>[1],
      ) => {
        if (String(path) === dir)
          throw Object.assign(new Error("Host owns the mount root"), {
            code: "EPERM",
          });
        return originalChmod(path, mode);
      },
    );
    syncBuiltinESMExports();
    let f: Awaited<ReturnType<typeof fixture>> | undefined;
    try {
      f = await fixture(dir);
      const state = { profile: { name: "Managed disk test" }, water: 750 };
      assert.equal(
        (
          await fetch(`${f.url}/api/state`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
          })
        ).status,
        200,
      );
      const image = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=",
        "base64",
      );
      const upload = new FormData();
      upload.set(
        "photo",
        new Blob([image], { type: "image/png" }),
        "progress.png",
      );
      const response = await fetch(`${f.url}/api/photos`, {
        method: "POST",
        body: upload,
      });
      assert.equal(response.status, 201);
      const photo = (await response.json()) as { url: string };
      assert.equal(
        fs.statSync(dir).mode & 0o777,
        0o755,
        "host mount permissions remain unchanged",
      );
      assert.equal(fs.statSync(join(dir, "photos")).mode & 0o777, 0o700);
      assert.equal(
        fs.statSync(join(dir, "weighloss.sqlite")).mode & 0o777,
        0o600,
      );
      await f.stop(false);
      f = undefined;
      f = await fixture(dir);
      assert.deepEqual(await (await fetch(`${f.url}/api/state`)).json(), {
        state,
      });
      const retrieved = await fetch(`${f.url}${photo.url}`);
      assert.equal(retrieved.status, 200);
      assert.deepEqual(Buffer.from(await retrieved.arrayBuffer()), image);
    } finally {
      if (f) await f.stop(false);
      t.mock.restoreAll();
      syncBuiltinESMExports();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
