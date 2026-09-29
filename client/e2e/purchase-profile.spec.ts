import { test, expect } from "@playwright/test";
const photo = {
  name: "bazar.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
    "base64",
  ),
};
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
test("purchase decimals, bottom total, required photo and expense-before-completion", async ({
  page,
}) => {
  await login(page);
  const me = await (await page.request.get("/api/me")).json(),
    messes = await (await page.request.get("/api/messes")).json(),
    id = messes[0].id,
    state = await (await page.request.get("/api/messes/" + id)).json();
  const seed = await page.request.post("/api/messes/" + id + "/actions", {
    headers: { "X-CSRF-Token": me.csrf, Origin: "http://localhost:5310" },
    data: {
      action: "duty",
      payload: {
        memberId: "demo-member",
        date: new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Dhaka",
        }),
        items: "Browser purchase fixture",
      },
      revision: state.revision,
      requestId: crypto.randomUUID(),
    },
  });
  expect(seed.ok()).toBeTruthy();
  await page.goto("/app/bazar");
  await expect(
    page.getByRole("button", { name: "Complete", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Submit expense", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Purchase / bill", { exact: true }).fill("Rice and salt");
  await d.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(d.getByLabel("Quantity", { exact: true })).toHaveValue("");
  await expect(d.getByLabel("Total price (৳)", { exact: true })).toHaveValue(
    "",
  );
  await d.getByLabel("Item", { exact: true }).fill("Rice");
  await d.getByLabel("Quantity", { exact: true }).fill("0.5");
  await d.getByLabel("Total price (৳)", { exact: true }).fill("12.50");
  await expect(
    d.getByRole("status", { name: "Total expense", exact: true }),
  ).toHaveText("৳12.50");
  await d.getByLabel("Total price (৳)", { exact: true }).fill("");
  await expect(d.getByLabel("Total price (৳)", { exact: true })).toHaveValue(
    "",
  );
  await d.getByLabel("Total price (৳)", { exact: true }).fill("25.75");
  await d.getByRole("button", { name: "Add item", exact: true }).click();
  await d.getByLabel("Item", { exact: true }).nth(1).fill("Salt");
  await d.getByLabel("Quantity", { exact: true }).nth(1).fill("1");
  await d.getByLabel("Total price (৳)", { exact: true }).nth(1).fill("2.25");
  await expect(
    d.getByRole("status", { name: "Total expense", exact: true }),
  ).toHaveText("৳28.00");
  await expect(d.getByLabel(/Bazar photo/)).toHaveAttribute("required", "");
  await d.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(d).toBeVisible();
  await d.getByLabel(/Bazar photo/).setInputFiles(photo);
  await d.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Complete", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Complete", exact: true }),
  ).toHaveCount(0);
  const saved = await (await page.request.get("/api/messes/" + id)).json();
  expect(saved.data.expenses.at(-1).amount).toBe(2800);
  expect(saved.data.expenses.at(-1).dutyId).toBe(saved.data.duties.at(-1).id);
});
test("meal and deposit badges remain separate", async ({ page }) => {
  await login(page, true);
  await page.route("**/api/messes/*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(),
      body = await response.json();
    if (body.data?.notifications)
      body.data.notifications = [
        {
          id: "meal",
          target: "meals",
          message: "Meal correction approved",
          read: false,
        },
        {
          id: "deposit",
          target: "deposits",
          message: "Deposit approved",
          read: false,
        },
      ];
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: /^Meals & menu/ })
      .getByText("1", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /^Deposits/ })
      .getByText("1", { exact: true }),
  ).toBeVisible();
});
test("private profile, photo and preferences persist on mobile", async ({
  page,
}) => {
  await login(page, true);
  await page.goto("/app/profile");
  await page
    .getByLabel("Address (optional)", { exact: true })
    .fill("Fictional test address");
  await page
    .getByLabel("Occupation / institution (optional)", { exact: true })
    .fill("Student");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Personal information saved.",
  );
  await page.reload();
  await expect(
    page.getByLabel("Address (optional)", { exact: true }),
  ).toHaveValue("Fictional test address");
  await page.getByLabel("Profile photo", { exact: true }).setInputFiles(photo);
  await expect(
    page.getByRole("img", { name: "Your profile photo" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/app/settings");
  await page
    .getByLabel("Table spacing (this browser)", { exact: true })
    .selectOption("compact");
  await page.reload();
  await expect(
    page.getByLabel("Table spacing (this browser)", { exact: true }),
  ).toHaveValue("compact");
});
