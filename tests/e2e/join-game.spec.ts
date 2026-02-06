import { test, expect } from "@playwright/test";

test.describe("Join Game Flow", () => {
    test("should allow a player to join a game and then persist identity on refresh", async ({ page }) => {
        await page.goto("/");
        await page.click('button:has-text("Créer une partie")');
        await expect(page).toHaveURL(/\/game\/.+/);

        // Wait for hydration and state load
        await expect(page.locator("text=Identify Yourself")).toBeVisible({ timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "StayCrew");
        await page.click('button:has-text("REJOINDRE")');

        await expect(page.locator("text=Cockpit Terminal")).toBeVisible();
        await expect(page.locator("text=StayCrew")).toBeVisible();

        // Refresh and check if still joined
        await page.reload();
        await expect(page.locator("text=Cockpit Terminal")).toBeVisible();
        await expect(page.locator("text=StayCrew")).toBeVisible();
        await expect(page.locator("text=YOU")).toBeVisible();
    });

    test("should show join form for a new user accessing the same game", async ({ browser }) => {
        // 1. Create a game and join in context A
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await pageA.goto("/");
        await pageA.click('button:has-text("Créer une partie")');
        await expect(pageA).toHaveURL(/\/game\/.+/);
        const gameUrl = pageA.url();

        await pageA.fill('input[placeholder="ENTER PSEUDO..."]', "LeadPlayer");
        await pageA.click('button:has-text("REJOINDRE")');
        await expect(pageA.locator("text=LeadPlayer")).toBeVisible();

        // 2. Access same URL in context B (different localStorage)
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await pageB.goto(gameUrl);

        // Should wait for loading to finish and show join form
        await expect(pageB.locator("text=Identify Yourself")).toBeVisible({ timeout: 15000 });

        await pageB.fill('input[placeholder="ENTER PSEUDO..."]', "SecondPlayer");
        await pageB.click('button:has-text("REJOINDRE")');

        // Both should now be in the manifest on page B
        await expect(pageB.locator("text=LeadPlayer")).toBeVisible();
        await expect(pageB.locator("text=SecondPlayer")).toBeVisible();
        await expect(pageB.locator("text=YOU")).toBeVisible();
    });
});
