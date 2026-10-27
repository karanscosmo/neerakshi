import { expect, test } from "@playwright/test";

test("create field → advisory card with explanation → Telegram link code → delete", async ({ page }) => {
  await page.goto("/field?lat=12.52&lon=76.9");
  await page.getByRole("button", { name: /Drop a pin/ }).click();
  const map = page.locator(".field-map");
  await expect(page.locator(".field-map .maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/Area: 1\.00 acres/)).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Maize/ }).click();
  const d = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').first().fill(d);
  await page.getByRole("button", { name: /Clay loam/ }).click();
  await page.getByRole("button", { name: "Drip" }).click();
  await page.getByRole("button", { name: /Get advice/ }).click();
  // real progress, request by request
  await expect(page.getByText("Saving your field")).toBeVisible();
  await page.waitForURL(/\/field\/[A-Za-z0-9_-]+$/, { timeout: 45_000 });
  // an advisory card is always shown: either advice with numbers, or "unavailable" with the reason — never a guess
  const card = page.locator("section.advice");
  await expect(card).toBeVisible({ timeout: 20_000 });
  const title = await card.locator(".advice__title").innerText();
  expect(["Irrigate now", "Wait for rain", "No irrigation needed", "Advice unavailable"].some((x) => title.startsWith(x)) || /^Irrigate in \d+ days$/.test(title)).toBeTruthy();
  if (!title.startsWith("Advice unavailable")) await expect(page.getByRole("heading", { name: "Why this advice" })).toBeVisible();
  // Telegram link code
  await page.getByRole("button", { name: /Send to Telegram/ }).click();
  await expect(page.getByText(/\/start [A-Z2-9]{8}/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Telegram" })).toHaveAttribute("href", /t\.me\/neerakshi_e2e_bot\?start=[A-Z2-9]{8}/);
  // subscribe toggle and delete
  await page.getByRole("button", { name: /Daily alerts/ }).click();
  await expect(page.getByRole("button", { name: /Alerts on/ })).toBeVisible();
  page.once("dialog", (dlg) => dlg.accept());
  await page.getByRole("button", { name: "Delete field" }).click();
  await expect(page).toHaveURL(/\/field$/);
});

test("API security: cron, webhook and admin reject missing secrets", async ({ request }) => {
  expect((await request.get("/api/cron/daily-advisories")).status()).toBe(401);
  expect((await request.post("/api/telegram/webhook", { data: { update_id: 1 } })).status()).toBe(403);
  expect((await request.get("/api/admin/stats")).status()).toBe(401);
  expect((await request.get("/api/admin/export", { headers: { "x-admin-passcode": "e2e-officer-passcode" } })).status()).toBe(200);
  const cron = await request.get("/api/cron/daily-advisories", { headers: { authorization: "Bearer e2e-cron-secret" } });
  expect(cron.status()).toBe(200);
  expect((await cron.json()).ok).toBe(true);
});

test("officer view: passcode gate and live counts", async ({ page }) => {
  await page.goto("/impact");
  await page.getByLabel("Officer passcode").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect passcode.")).toBeVisible();
  await page.getByLabel("Officer passcode").fill("e2e-officer-passcode");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Active fields")).toBeVisible();
  await expect(page.getByRole("link", { name: /Export advisories\.csv/ })).toBeVisible();
});
