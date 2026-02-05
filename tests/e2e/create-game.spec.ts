import { test, expect } from "@playwright/test";

test("should show home page and allow creating a game", async ({ page }) => {
    await page.goto("/");

    // Check if title is present
    await expect(page.getByText("AMOGUS COCKPIT")).toBeVisible();

    // Check if button is present
    const createButton = page.getByRole("button", { name: /créer une partie/i });
    await expect(createButton).toBeVisible();

    // Click button and verify redirection
    // Note: This requires KV mock or real environment
    await createButton.click();

    // Wait for URL to change to /game/[id]
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 10000 });

    // Wait for the loading state to disappear if needed, or just wait for the title
    // "Lobby Module" should eventually appear
    await expect(page.getByText("Lobby Module")).toBeVisible({ timeout: 15000 });
});

test("should show error on invalid game id", async ({ page }) => {
    // Navigate to a non-existent game
    await page.goto("/game/invalid-module-id");

    // Check if error message is shown
    await expect(page.getByText(/Critical Error/i)).toBeVisible();
});
