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
    const lobbyTitle = page.getByText("Lobby Module");
    await expect(lobbyTitle).toBeVisible({ timeout: 15000 });

    // Verify "LIVE_CONNECTION" indicator
    await expect(page.getByText("LIVE_CONNECTION")).toBeVisible();

    // Verify "Game Identifier" label and value
    await expect(page.getByText("Game Identifier")).toBeVisible();

    // The game ID should be visible and match part of the URL
    const url = page.url();
    const gameIdMatch = url.match(/\/game\/([a-f0-9-]{36})/);
    if (gameIdMatch) {
        const gameId = gameIdMatch[1];
        await expect(page.getByText(gameId)).toBeVisible();
    }
});

test("should show error on invalid game id", async ({ page }) => {
    // Navigate to a non-existent game
    await page.goto("/game/invalid-module-id");

    // Check if error message is shown
    await expect(page.getByText(/Critical Error/i)).toBeVisible();
});
