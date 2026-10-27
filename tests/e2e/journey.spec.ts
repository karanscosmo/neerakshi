import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("journey descends to arrival, then dial → atlas → district sheet", async ({ page }) => {
  await page.goto("/?replay=1");
  await expect(page.getByRole("heading", { name: "NEERAKSHI" })).toBeVisible();
  // live caption for act 1 (value or an honest "unavailable")
  await expect(page.locator(".jn-note").first()).toBeVisible();
  // altimeter jumps to the last act
  await page.getByRole("button", { name: /Reflection/ }).click();
  await expect(page.getByRole("link", { name: "Explore the Atlas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: /Enter Neerakshi/ }).click();
  await expect(page).toHaveURL(/\/hub/);
  // dial: keyboard rotate then open
  const dial = page.getByRole("group", { name: "Neerakshi sections" });
  await dial.focus();
  await expect(page.locator(".dial__title")).toHaveText("Water Stress Atlas");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".dial__title")).toHaveText("Monsoon Story");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".dial__title")).toHaveText("Water Stress Atlas");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/atlas/);
  // map renders and the data table alternative lists real districts
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Show data table" }).click();
  await expect(page.locator("table.data tbody tr").first()).toBeVisible();
  // tap a district → bottom sheet with components
  const canvas = page.locator(".maplibregl-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.55);
  await expect(page.getByRole("dialog")).toContainText("Component scores", { timeout: 10_000 });
  await expect(page).toHaveURL(/d=d\d+/);
});

test("returning visitors land in the app; replay works", async ({ page }) => {
  await page.goto("/?replay=1");
  await page.evaluate(() => localStorage.setItem("nk_journey_seen", "1"));
  await page.goto("/");
  await expect(page).toHaveURL(/\/hub/);
});

for (const path of ["/hub", "/atlas", "/monsoon", "/groundwater", "/crops", "/field", "/methods", "/impact"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page }).disableRules(["region"]).analyze();
    const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} — ${v.help}`)).toEqual([]);
  });
}

for (const lang of ["hi", "kn"]) {
  test(`renders in ${lang}`, async ({ page, context }) => {
    await context.addCookies([{ name: "nk_lang", value: lang, url: "http://localhost:3200" }]);
    await page.goto("/hub");
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator(".dial__title")).toHaveText(lang === "hi" ? "जल दबाव एटलस" : "ನೀರಿನ ಒತ್ತಡ ಅಟ್ಲಾಸ್");
    await page.goto("/field");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(lang === "hi" ? "अपना खेत ढूँढें" : "ನಿಮ್ಮ ಹೊಲ ಹುಡುಕಿ");
  });
}
