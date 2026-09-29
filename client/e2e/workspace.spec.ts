import { test, expect } from "@playwright/test";
async function login(page: any, member = false) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("language", "en"));
  await page.reload();
  await page
    .getByLabel("Email", { exact: true })
    .fill(member ? "member@example.test" : "manager@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-preview-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
test("logo, public auth header, routes, history and duplicate identities", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Members", exact: true }).click();
  await expect(page).toHaveURL(/app\/members/);
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Members", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Deposits", exact: true }).click();
  await page.getByRole("button", { name: "Record cash", exact: true }).click();
  const memberSelect = page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Member", exact: true });
  await memberSelect.selectOption({
    label: "Demo Manager · member@example.test",
  });
  await expect(memberSelect).toHaveValue("second-member");
  await memberSelect.selectOption({
    label: "Demo Manager · manager@example.test",
  });
  await expect(memberSelect).toHaveValue("demo-member");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("link", { name: "messmate .", exact: true }).click();
  await expect(page).toHaveURL(/app\/overview/);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Open dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Contact", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good meals. Fair shares." }),
  ).toBeVisible();
  await page.goto("/app/deposits?month=2026-08&status=pending");
  await expect(page.getByLabel("Statement month")).toHaveValue("2026-08");
  await expect(page.getByLabel("Deposit status")).toHaveValue("pending");
  await page.reload();
  await expect(page.getByLabel("Deposit status")).toHaveValue("pending");
  await page.getByRole("button", { name: "Members", exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/status=pending/);
});
test("network outage is not logout and failed balance is not zero", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/me", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary outage" }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Account temporarily unavailable" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/app/);
  await page.unroute("**/api/me");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.route("**/settlement/*", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary report outage" }),
    }),
  );
  await page.reload();
  await expect(
    page.getByText(
      "Balances unavailable. A zero balance has not been assumed.",
    ),
  ).toBeVisible();
  await expect(page.locator(".stats-grid")).toHaveCount(0);
});
test("mobile drawer, keyboard dialog, Bengali meals and month lock", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Settlement", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finalize", exact: true }),
  ).toBeDisabled();
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "messmate .", exact: true }).click();
  await expect(page).toHaveURL(/app\/overview/);
  await expect(page.getByRole("button", { name: "Close menu overlay" })).toHaveCount(0);

  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Meals & menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Close menu overlay" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Turn on / off", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "বাংলা", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "সকালের নাস্তা", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ম্যানেজার এখনো মেনু প্রকাশ করেননি।").first(),
  ).toBeVisible();
});
test("member role cannot access manager controls, resend and 404 screens", async ({
  page,
}) => {
  await login(page, true);
  await page.getByRole("button", { name: "Deposits", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Record cash", exact: true }),
  ).toHaveCount(0);
  await page.goto("/resend");
  await expect(
    page.getByRole("heading", { name: "Resend verification email" }),
  ).toBeVisible();
  await page.goto("/not-a-page");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
