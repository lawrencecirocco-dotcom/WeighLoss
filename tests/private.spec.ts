import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/index";

test("private hosted app requires sign-in, saves connection keys and signs out without caching health records", async ({
  page,
}) => {
  const dataDir = mkdtempSync(join(tmpdir(), "lighter-private-browser-"));
  const password = randomBytes(18).toString("hex");
  let service: ReturnType<typeof createApp>;
  const server = createServer((req, res) => service.app(req, res));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  service = createApp({
    mode: "production",
    appOrigin: url,
    dataDir,
    authPassword: password,
    encryptionKey: randomBytes(32).toString("hex"),
    fitbitClientId: "",
    fitbitClientSecret: "",
    openaiKey: "",
  });
  try {
    expect((await page.request.get(`${url}/api/state`)).status()).toBe(401);
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Your little private space." }),
    ).toBeVisible();
    await page
      .getByLabel("Your Lighter password", { exact: true })
      .fill("incorrect-password");
    await page.getByRole("button", { name: "Open my space" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "could not be verified",
    );
    await page
      .getByLabel("Your Lighter password", { exact: true })
      .fill(password);
    await page.getByRole("button", { name: "Open my space" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little more balance",
    );
    await expect(page.locator(".save-status")).toContainText(
      "Saved in your private space",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("lighter-state")),
    ).toBe(null);
    await page
      .getByRole("button", { name: "Set up connections", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Let’s get you connected." }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "2. Your Fitbit" }).click();
    await expect(dialog.locator(".copy-address")).toContainText(
      `${url}/api/fitbit/callback`,
    );
    await dialog
      .getByLabel("OAuth client ID", { exact: true })
      .fill("test-client-id");
    await dialog
      .getByLabel("Client secret", { exact: true })
      .fill("test-secret-for-browser-check-only");
    await dialog
      .getByRole("button", { name: "Save Fitbit details securely" })
      .click();
    await expect(dialog.getByRole("status")).toContainText("Details saved");
    await expect(
      dialog.getByRole("link", { name: "Approve my Fitbit connection" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "3. Food photos" }).click();
    await dialog
      .getByLabel("Your OpenAI API key", { exact: true })
      .fill("test-key-for-browser-check-only");
    await dialog
      .getByRole("button", { name: "Save my AI connection securely" })
      .click();
    await expect(dialog.getByRole("status")).toContainText("Key saved");
    const setup = await (await page.request.get(`${url}/api/setup`)).json();
    expect(setup.fitbitConfigured).toBe(true);
    expect(setup.aiConfigured).toBe(true);
    expect(JSON.stringify(setup)).not.toContain("test-secret");
    expect(JSON.stringify(setup)).not.toContain("test-key");
    await dialog
      .getByRole("button", { name: "Close connection guide" })
      .click();
    expect((await page.request.get(`${url}/manifest.webmanifest`)).ok()).toBe(
      true,
    );
    expect((await page.request.get(`${url}/apple-touch-icon.png`)).ok()).toBe(
      true,
    );
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const cachedUrls = await page.evaluate(async () => {
      const entries = await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => request.url),
        ),
      );
      return entries.flat();
    });
    expect(
      cachedUrls.some((url) => new URL(url).pathname.startsWith("/api/")),
    ).toBe(false);
    await page.getByRole("button", { name: "Sign out of Lighter" }).click();
    await expect(
      page.getByRole("heading", { name: "Your little private space." }),
    ).toBeVisible();
    expect((await page.request.get(`${url}/api/state`)).status()).toBe(401);
    expect(
      await page.evaluate(() => localStorage.getItem("lighter-state")),
    ).toBe(null);
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    service.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
