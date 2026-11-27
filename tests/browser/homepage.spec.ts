import { test, expect } from "@playwright/test";

test("homepage preview changes round and feedback without starting an interview", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      apiRequests.push(request.url());
    }
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Behavioral", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Technical", exact: true }).click();
  await expect(
    page.getByText(
      "Your API slows down under peak traffic. How would you find the bottleneck?",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Connect your proposed fix to a measured bottleneck.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "System design", exact: true })
    .click();
  await expect(
    page.getByText(
      "What happens if the downstream provider becomes unavailable?",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Technical", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .locator("summary")
    .filter({ hasText: "How does the interview work?" })
    .click();
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
  expect(apiRequests).toEqual([]);
});

// On the live server the app is mounted under /interviewace/, and "/" is a different site.
test("public links and sign-out stay under the path the app is mounted at", async ({
  page,
}) => {
  await page.goto("/interviewace/");
  await expect(
    page.getByRole("link", { name: /Practice sign in/ }),
  ).toHaveAttribute("href", "/interviewace/practice?auth=signin");
  await expect(
    page.getByRole("link", { name: /Hiring sign in/ }),
  ).toHaveAttribute("href", "/interviewace/hiring?auth=signin");
  await expect(
    page.getByRole("link", { name: /InterviewAce home/ }),
  ).toHaveAttribute("href", "/interviewace/");
  const stray = await page
    .locator("a[href^='/']")
    .evaluateAll((links) =>
      links
        .map((a) => a.getAttribute("href") || "")
        .filter((href) => !href.startsWith("/interviewace/")),
    );
  expect(stray).toEqual([]);
  // Mounted at the root (local development) the same links point at the root.
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Hiring sign in/ }),
  ).toHaveAttribute("href", "/hiring?auth=signin");
});
