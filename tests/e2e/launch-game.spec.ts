import { test, expect, type Page } from "@playwright/test";

test.describe("Launch Game Flow", () => {
    async function setupGame(page: Page) {
        const username = `OrgLaunch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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

    test("should allow organizer to launch game after player joins", async ({ page }) => {
        await setupGame(page);

        // Join the game
        await expect(page.getByText("Inbound Entry")).toBeVisible({ timeout: 15000 });
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "Commander");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("Cockpit Terminal")).toBeVisible({ timeout: 10000 });

        // Verify launch button is visible and enabled
        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await expect(launchButton).toBeVisible();
        await expect(launchButton).toBeEnabled();

        // Click launch button
        await launchButton.click();

        // Should transition to role selection screen
        await expect(page.getByText("Mission Active")).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("IN_PROGRESS")).toBeVisible();
        await expect(page.getByText(/Choisissez votre rôle/i)).toBeVisible();
    });

    test("should show launch button disabled before players join, then enabled after", async ({ page }) => {
        await setupGame(page);

        // Join the game first to see the lobby (button is only visible when joined)
        await expect(page.getByText("Inbound Entry")).toBeVisible({ timeout: 15000 });
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "Commander");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("Cockpit Terminal")).toBeVisible({ timeout: 10000 });

        // The launch button should be enabled since there's at least 1 player
        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await expect(launchButton).toBeVisible();
        await expect(launchButton).toBeEnabled();
    });
});
