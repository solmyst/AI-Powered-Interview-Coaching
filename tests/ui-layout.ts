import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function reviewPageLayout(page: Page, name: string) {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertControlLayout(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${name}: overflow at ${width}`,
    ).toBe(true);
    if (width === 320 || width === 1440) {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze()
        ).violations,
        `${name}: accessibility at ${width}`,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/alignment-${name}-${width}.png`,
        fullPage: true,
      });
    }
  }
}

/** Geometry checks complement axe: accessible controls can still be visibly misaligned. */
export async function assertControlLayout(page: Page) {
  const issues = await page.evaluate(() => {
    const issues: string[] = [];
    const visible = (el: Element) =>
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const center = (rect: DOMRect) => rect.top + rect.height / 2;
    for (const label of document.querySelectorAll(
      "label.check, label.checkbox",
    )) {
      if (!visible(label)) continue;
      const input = label.querySelector("input")!;
      const text = label.querySelector("span")!;
      const box = input.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(text);
      const line = range.getClientRects()[0];
      if (box.width !== 18 || box.height !== 18)
        issues.push("Checkbox is compressed or inconsistently sized");
      if (line && Math.abs(center(box) - center(line)) > 4)
        issues.push("Checkbox is not aligned with its first text line");
      if (text.getBoundingClientRect().left - box.right < 8)
        issues.push("Checkbox has insufficient label spacing");
    }
    for (const icon of document.querySelectorAll(
      ".password-toggle, .co-search > svg, .co-inline > input",
    )) {
      if (!visible(icon)) continue;
      const reference = icon.matches(".password-toggle")
        ? icon.parentElement!.querySelector("input")!
        : icon.parentElement!;
      if (
        Math.abs(
          center(icon.getBoundingClientRect()) -
            center(reference.getBoundingClientRect()),
        ) > 2
      )
        issues.push(`${icon.className}: off-center inline control`);
    }
    for (const row of document.querySelectorAll(".co-rubric")) {
      const fields = [...row.querySelectorAll("input, select")].map((el) =>
        el.getBoundingClientRect(),
      );
      const button = row.querySelector("button")!.getBoundingClientRect();
      if (Math.abs(center(fields[2]) - center(button)) > 2)
        issues.push("Rubric delete button is not aligned with weight control");
      if (
        fields[0].top === fields[1].top &&
        Math.abs(fields[0].height - fields[2].height) > 1
      )
        issues.push("Rubric fields have inconsistent heights");
    }
    for (const button of document.querySelectorAll(
      "button.primary, button.secondary, button.text-button, button.icon-button, button[data-slot=button]",
    )) {
      if (!visible(button)) continue;
      const rect = button.getBoundingClientRect();
      for (const icon of button.querySelectorAll(":scope > svg")) {
        const box = icon.getBoundingClientRect();
        if (Math.abs(center(box) - center(rect)) > 2)
          issues.push(
            `${button.textContent?.trim() || button.getAttribute("aria-label")}: icon is not vertically centered`,
          );
        if (box.left < rect.left - 1 || box.right > rect.right + 1)
          issues.push("Button icon overflows its control");
      }
    }
    return issues;
  });
  expect(
    issues,
    `Control alignment at ${page.viewportSize()?.width}px`,
  ).toEqual([]);
}
