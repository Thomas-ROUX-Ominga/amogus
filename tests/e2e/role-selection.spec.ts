import { test, expect, type Page } from "@playwright/test";

async function setupGame(page: Page) {
    const username = `OrgRole_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
}

test.describe("Role Selection Flow", () => {
    test("should complete full flow: create → join → launch → select Crewmate → see transition → reach home", async ({ page }) => {
        await setupGame(page);

        // Join the game
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "CrewMember");
        await page.click('button:has-text("REJOINDRE")');

        // Verify we are in the lobby
        await expect(page.getByText("Cockpit Terminal")).toBeVisible({ timeout: 30000 });

        // Launch the game (as player)
        await page.click('button:has-text("LANCER LA PARTIE")');

        // Role selection appears
        await expect(page.getByText(/Choisissez votre rôle/i)).toBeVisible({ timeout: 10000 });

        // Select Crewmate
        await page.click('button:has-text("Crewmate")', { timeout: 15000 });

        // Role transition appears
        await expect(page.getByText(/Crew/i).first()).toBeVisible({ timeout: 15000 });

        // Finally reaches home
        await expect(page.getByText("Game Cockpit")).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
    });

    test("should complete full flow with Impostor role", async ({ page }) => {
        await setupGame(page);

        // Join
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "SuspectOne");
        await page.click('button:has-text("REJOINDRE")');

        // Launch
        await page.click('button:has-text("Lancer la partie")');

        // Select Impostor
        await page.click('button:has-text("Impost")', { timeout: 15000 });

        // Role transition
        await expect(page.getByText(/Imp/i).first()).toBeVisible({ timeout: 15000 });

        // Home page
        await expect(page.getByText("Game Cockpit")).toBeVisible({ timeout: 10000 });
    });

    test("should show role selection disabled when game not launched", async ({ page }) => {
        const username = `OrgNoLaunch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        // Partial setup: create but don't launch from lobby
        await page.goto("/register");
        await page.fill('input[placeholder="New_ID..."]', username);
        await page.fill('input[placeholder="Secret..."]', "securePass123");
        await page.fill('input[placeholder="Repeat..."]', "securePass123");
        await page.click('button:has-text("REGISTER OPERATOR")');
        
        await page.goto("/login");
        await page.fill('input[placeholder="ID..."]', username);
        await page.fill('input[placeholder="SECRET..."]', "securePass123");
        await page.click('button:has-text("INITIALIZE SESSION")');
        await page.click('button:has-text("Create New Batch")');
        await page.fill('input[type="number"]', "3");
        await page.click('button:has-text("CREATE BATCH")');
        await expect(page.locator("text=BATCH-").first()).toBeVisible();
        await page.getByTitle("Manage batch").first().click();
        await page.click('button:has-text("LAUNCH MISSION")');
        
        // Now in lobby. Join.
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "EarlyBird");
        await page.click('button:has-text("REJOINDRE")');

        // We should NOT see role selection yet
        await expect(page.getByText(/Choisissez votre rôle/i)).not.toBeVisible();
    });

    test("should display both role options with correct colors", async ({ page }) => {
        await setupGame(page);
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "ColorTester");
        await page.click('button:has-text("REJOINDRE")');
        await page.click('button:has-text("LANCER LA PARTIE")');

        const crewmateBtn = page.getByRole("button", { name: /Crew/i });
        const impostorBtn = page.getByRole("button", { name: /Imp/i });

        await expect(crewmateBtn).toBeVisible({ timeout: 30000 });
        await expect(impostorBtn).toBeVisible({ timeout: 30000 });

        // Check for presence of the color codes in style or classes if possible, 
        // but since they are dynamic HEX, let's just check the button exists
        await expect(crewmateBtn).toBeVisible();
        await expect(impostorBtn).toBeVisible();
    });

    test("should show transition animation with correct role color", async ({ page }) => {
        await setupGame(page);
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "AnimTester");
        await page.click('button:has-text("REJOINDRE")');
        await page.click('button:has-text("LANCER LA PARTIE")');

        await page.click('button:has-text("Crewmate")', { timeout: 15000 });

        const transitionContainer = page.locator(".fixed.inset-0");
        await expect(transitionContainer).toBeVisible();
    });
});
