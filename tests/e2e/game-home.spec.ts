import { test, expect, type Page } from "@playwright/test";

test.describe("Game Home Flow", () => {
    async function createJoinLaunchSelectRole(page: Page, role: "CREWMATE" | "IMPOSTOR") {
        const username = `OrgHome_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        // 1. Register/Login as Organizer
        await page.goto("/register");
        await page.fill('input[placeholder="New_ID..."]', username);
        await page.fill('input[placeholder="Secret..."]', "securePass123");
        await page.fill('input[placeholder="Repeat..."]', "securePass123");
        await page.click('button:has-text("REGISTER OPERATOR")');
        
        await page.goto("/login");
        await page.fill('input[placeholder="ID..."]', username);
        await page.fill('input[placeholder="SECRET..."]', "securePass123");
        await page.click('button:has-text("INITIALIZE SESSION")');

        // 2. Create Batch
        await page.click('button:has-text("Create New Batch")');
        await page.fill('input[type="number"]', "3");
        await page.click('button:has-text("CREATE BATCH")');
        await expect(page.locator("text=BATCH-").first()).toBeVisible();
        await page.getByTitle("Manage batch").first().click();

        // 3. Launch Game
        await page.click('button:has-text("LAUNCH MISSION")');
        await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 15000 });

        // 4. Join as Player
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "HomePlayer");
        await page.click('button:has-text("REJOINDRE")');

        // 5. Start Mission
        await page.click('button:has-text("LANCER LA PARTIE")');

        // 6. Select Role
        await page.click(`button:has-text("${role === "CREWMATE" ? "Crewmate" : "Impost"}")`);

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 10000 });
    }

    test("should show Game Home with all elements after selecting Crewmate", async ({ page }) => {
        await createJoinLaunchSelectRole(page, "CREWMATE");

        // Wait for the return link to ensure the page has fully settled after transitions
        await expect(page.getByText(/Retour à l'accueil/)).toBeVisible({ timeout: 15000 });

        await expect(page.getByText("Game Cockpit")).toBeVisible();
        await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
        // Check for role text globally with a high timeout to allow for transitions
        await expect(page.getByText(/Crew/i).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("HomePlayer")).toBeVisible();
        await expect(page.getByText("SCANNER")).toBeVisible();
        await expect(page.getByText("Progression des quêtes")).toBeVisible();
    });

    test("should not show quest progress for Impostor", async ({ page }) => {
        await createJoinLaunchSelectRole(page, "IMPOSTOR");

        await expect(page.getByText(/Retour à l'accueil/)).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("Game Cockpit")).toBeVisible();
        await expect(page.getByText(/Imp/i).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText("Progression des quêtes")).not.toBeVisible();
        await expect(page.getByText("SCANNER")).toBeVisible();
    });

    test("should navigate to home page via return link", async ({ page }) => {
        await createJoinLaunchSelectRole(page, "CREWMATE");
        const returnLink = page.getByText(/Retour à l'accueil/);
        await expect(returnLink).toBeVisible({ timeout: 15000 });
        await returnLink.click();
        await expect(page).toHaveURL("/", { timeout: 5000 });
    });

    test("should have SCAN link visible for Crewmate", async ({ page }) => {
        await createJoinLaunchSelectRole(page, "CREWMATE");
        await expect(page.getByText(/Retour à l'accueil/)).toBeVisible({ timeout: 15000 });
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        const href = await scanLink.getAttribute("href");
        expect(href).toContain("/quest?duration=short");
    });
});
