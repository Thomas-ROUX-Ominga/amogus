import { test, expect } from "@playwright/test";

test.describe("Organizer Game Flow", () => {
    test("should allow organizer to register, create a batch, and launch a game", async ({ page }) => {
        const username = `OrgFlow_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        // 1. Register as Organizer
        await page.goto("/register");
        await page.fill('input[placeholder="New_ID..."]', username);
        await page.fill('input[placeholder="Secret..."]', "securePass123");
        await page.fill('input[placeholder="Repeat..."]', "securePass123");
        await page.click('button:has-text("REGISTER OPERATOR")');

        // Should be redirected to login
        await expect(page).toHaveURL(/\/login/);

        // 2. Login
        await page.fill('input[placeholder="ID..."]', username);
        await page.fill('input[placeholder="SECRET..."]', "securePass123");
        await page.click('button:has-text("INITIALIZE SESSION")');

        // Should be redirected to admin dashboard
        await expect(page).toHaveURL(/\/(admin\/batches|admin\/dashboard)/);
        
        // 3. Create Batch
        await page.click('button:has-text("Create New Batch")');
        await page.fill('input[type="number"]', "5"); // 5 quests
        await page.click('button:has-text("CREATE BATCH")');

        // Wait for batch to appear
        await expect(page.locator("text=BATCH-").first()).toBeVisible();

        // 4. Click Manage (Settings icon) on the first batch
        // We need to find the settings link for the batch we just created. 
        // Since it's sorted by creation date, it should be the first one?
        // Let's assume the first .p-2 link inside .flex is the settings button.
        // Or better, use a locator driven by text if possible.
        // The batch ID is random, so we look for the Settings icon wrapper.
        // Let's use getByTitle("Manage batch").first()
        await page.getByTitle("Manage batch").first().click();

        // Should be on Batch Detail page
        await expect(page).toHaveURL(/\/admin\/batches\/[a-f0-9-]{36}/);
        await expect(page.locator("text=Quest Locations")).toBeVisible();

        // 5. Launch Game
        const launchButton = page.getByRole("button", { name: /launch mission/i });
        await expect(launchButton).toBeVisible();
        await launchButton.click();

        // 6. Verify Redirection to Game Lobby
        await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 15000 });
        
        // 7. Verify Lobby State
        // Organizer lands in lobby. They are NOT joined as a player yet.
        // They should see "Identification Required" or similar join screen.
        await expect(page.getByText("Inbound Entry")).toBeVisible();
        await expect(page.getByText("PENDING_AUTH")).toBeVisible();
    });
});
