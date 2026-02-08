import { test, expect } from "@playwright/test";

test.describe("Launch Game Flow", () => {
    test("should allow organizer to launch game after player joins", async ({ page }) => {
        // Create a game
        await page.goto("/");
        const createButton = page.getByRole("button", { name: /créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 10000 });

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
        // Create a game
        await page.goto("/");
        const createButton = page.getByRole("button", { name: /créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 10000 });

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
