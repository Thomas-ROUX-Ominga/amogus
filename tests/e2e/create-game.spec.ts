import { test, expect } from "@playwright/test";

test("should show home page and allow creating a game", async ({ page }) => {
    await page.goto("/");

    // Check if title is present
    await expect(page.getByText("AMOGUS COCKPIT")).toBeVisible();

    // Check if button is present
    const createButton = page.getByRole("button", { name: /créer une partie/i });
    await expect(createButton).toBeVisible();

    // Click button and verify redirection
    await createButton.click();

    // Wait for URL to change to /game/[id]
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 10000 });

    // After redirection, we should see the Join Form (Inbound Entry)
    await expect(page.getByText("Inbound Entry")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("PENDING_AUTH")).toBeVisible();

    // Enter pseudo to actually join the lobby
    await page.fill('input[placeholder="ENTER PSEUDO..."]', "OperatorOne");
    await page.click('button:has-text("REJOINDRE")');

    // Now "Cockpit Terminal" and "SESSION_ACTIVE" should appear
    await expect(page.getByText("Cockpit Terminal")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("SESSION_ACTIVE")).toBeVisible();

    // Verify "Game Identifier" label and value
    await expect(page.getByText("Game Identifier")).toBeVisible();

    // The game ID should be visible and match part of the URL
    const url = page.url();
    const gameIdMatch = url.match(/\/game\/([a-f0-9-]{36})/);
    if (gameIdMatch) {
        const gameId = gameIdMatch[1];
        await expect(page.getByText(gameId)).toBeVisible();
    }

    // Check if the manifest shows the player
    await expect(page.getByText("OperatorOne")).toBeVisible();
});

test("should show error on invalid game id", async ({ page }) => {
    // Navigate to a non-existent game
    await page.goto("/game/invalid-module-id");

    // Check if error message is shown
    await expect(page.getByText(/Critical Error/i)).toBeVisible();
});
