import { test, expect, type Page } from "@playwright/test";

async function setupGame(page: Page) {
    const username = `OrgJoin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    // 1. Register/Login as Organizer
    await page.goto("/register");
    await page.fill('input[placeholder="New_ID..."]', username);
    await page.fill('input[placeholder="Secret..."]', "securePass123");
    await page.fill('input[placeholder="Repeat..."]', "securePass123");
    await page.click('button:has-text("REGISTER OPERATOR")');
    
    await expect(page).toHaveURL(/\/login/);
    await page.fill('input[placeholder="ID..."]', username);
    await page.fill('input[placeholder="SECRET..."]', "securePass123");
    await page.click('button:has-text("INITIALIZE SESSION")');

    await expect(page).toHaveURL(/\/(admin\/batches|admin\/dashboard)/);

    // 2. Create Batch
    await page.click('button:has-text("Create New Batch")');
    await page.fill('input[type="number"]', "3");
    await page.click('button:has-text("CREATE BATCH")');
    await expect(page.locator("text=BATCH-").first()).toBeVisible();
    await page.getByTitle("Manage batch").first().click();

    // 3. Launch Game
    await page.click('button:has-text("LAUNCH MISSION")');
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 15000 });
    
    return page.url();
}

test.describe("Join Game Flow", () => {
    test("should allow a player to join a game and then persist identity on refresh", async ({ page }) => {
        await setupGame(page);

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
        const gameUrl = await setupGame(pageA);

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
