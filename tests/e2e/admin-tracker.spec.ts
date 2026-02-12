import { test, expect } from "@playwright/test";

test.describe("Admin Tracker Flow", () => {
    test.beforeEach(async ({ page }) => {
        // Mock localStorage for user ID
        await page.addInitScript(() => {
            localStorage.setItem("userId", "test-user-123");
        });
    });

    test("should display admin tracker page with real game data", async ({ page }) => {
        // Create and setup a real game
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        // Get the game ID from URL
        const url = page.url();
        const gameId = url.split("/").pop() || "";

        // Join the game
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "TestPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("TestPlayer")).toBeVisible({ timeout: 5000 });

        // Launch the game
        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        // Select role
        const roleButton = page.getByRole("button", { name: /Crewmate/i });
        await roleButton.click();
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });

        // Navigate to admin tracker
        await page.goto(`/admin/tracker/${gameId}`);

        // Check page loads correctly
        await expect(page.getByText("Admin Tracker")).toBeVisible();
        await expect(page.getByText(`GAME: ${gameId}`)).toBeVisible();
        await expect(page.locator('div:has-text("IN_PROGRESS")').first()).toBeVisible();

        // Check player list
        await expect(page.getByText("Crew Manifest")).toBeVisible();
        await expect(page.locator('div:has-text("TestPlayer")').first()).toBeVisible();
        await expect(page.getByText("1 MEMBERS")).toBeVisible();

        // Check player details
        await expect(page.getByText("CREWMATE • ACTIVE")).toBeVisible();
        await expect(page.getByText("YOU")).toBeVisible();

        // Check quest progress
        await expect(page.getByText("0/9")).toBeVisible();

        // Check global progress
        await expect(page.getByText("Global Progress")).toBeVisible();
        await expect(page.getByText("Mission Completion")).toBeVisible();
        await expect(page.locator('div:has-text("0.0%")').first()).toBeVisible();

        // Check stats
        await expect(page.getByText("Mission Stats")).toBeVisible();
        await expect(page.getByText("Active", { exact: true })).toBeVisible();
        await expect(page.getByText("Crewmates")).toBeVisible();
    });

    test("should handle game not found error", async ({ page }) => {
        await page.goto("/admin/tracker/nonexistent-game");

        // Should show error page
        await expect(page.getByText("SESSION DECOMMISSIONED")).toBeVisible();
        await expect(page.getByText("Game module not found or decommissioned")).toBeVisible();
        await expect(page.getByText("GAME_NOT_FOUND")).toBeVisible();
    });

    test("should show loading state", async ({ page }) => {
        // Navigate to a game that doesn't exist to see loading behavior
        await page.goto("/admin/tracker/loading-test-game");

        // Should eventually show error page (since game doesn't exist)
        await expect(page.getByText("SESSION DECOMMISSIONED")).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("Game module not found or decommissioned")).toBeVisible();
    });

    test("should navigate back to game", async ({ page }) => {
        // Create a real game first
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        const url = page.url();
        const gameId = url.split("/").pop() || "";

        // Join and setup game
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "NavigatorPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("NavigatorPlayer")).toBeVisible({ timeout: 5000 });

        // Navigate to admin tracker
        await page.goto(`/admin/tracker/${gameId}`);

        // Click return button
        await page.click("text=Return");

        // Should navigate back to game page
        await expect(page).toHaveURL(`/game/${gameId}`);
    });

    test("should display empty state in lobby", async ({ page }) => {
        // Create a game but don't join it
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        const url = page.url();
        const gameId = url.split("/").pop() || "";

        // Navigate to admin tracker without joining
        await page.goto(`/admin/tracker/${gameId}`);

        // Should show empty state
        await expect(page.getByText("No crew members detected")).toBeVisible();
        
        // Should still show other sections
        await expect(page.getByText("Global Progress")).toBeVisible();
        await expect(page.getByText("Mission Stats")).toBeVisible();
        await expect(page.locator('div:has-text("LOBBY")').first()).toBeVisible();
    });

    test("should display correct game status indicators", async ({ page }) => {
        // Create game
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        const url = page.url();
        const gameId = url.split("/").pop() || "";

        // Check LOBBY status
        await page.goto(`/admin/tracker/${gameId}`);
        await expect(page.locator('div:has-text("LOBBY")').first()).toBeVisible();

        // Go back to game to join
        await page.goto(`/game/${gameId}`);
        
        // Join game
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "StatusPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("StatusPlayer")).toBeVisible({ timeout: 5000 });

        // Check still LOBBY after joining
        await page.goto(`/admin/tracker/${gameId}`);
        await expect(page.locator('div:has-text("LOBBY")').first()).toBeVisible();

        // Go back to game to launch
        await page.goto(`/game/${gameId}`);
        
        // Launch game
        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        // Select role
        const roleButton = page.getByRole("button", { name: /Crewmate/i });
        await roleButton.click();
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });

        // Check IN_PROGRESS status
        await page.goto(`/admin/tracker/${gameId}`);
        await expect(page.locator('div:has-text("IN_PROGRESS")').first()).toBeVisible();
    });
});
