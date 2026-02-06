import { test, expect } from "@playwright/test";

test.describe("Invalid Game Transitions", () => {
    test("should display error screen when game ID is invalid", async ({ page }) => {
        // Navigate to a non-existent game ID
        await page.goto("/game/invalid-uuid-1234");

        // Should show the ErrorView
        const errorTitle = page.locator("h1");
        await expect(errorTitle).toContainText("SESSION DECOMMISSIONED");

        const errorMessage = page.locator("p");
        await expect(errorMessage).toContainText("found or decommissioned");

        // Verify "No Dead End" - RECOVER SIGNAL button
        const recoverButton = page.getByRole("button", { name: /RECOVER SIGNAL/i });
        await expect(recoverButton).toBeVisible();

        // Click to return home
        await recoverButton.click();
        await expect(page).toHaveURL("/");
    });

    test("should allow retrying synchronization", async ({ page }) => {
        await page.goto("/game/invalid-uuid-5678");

        const retryButton = page.getByRole("button", { name: /RETRY SYNC/i });
        await expect(retryButton).toBeVisible();
    });
});
