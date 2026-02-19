import { test, expect, type Page } from "@playwright/test";

test.describe("Quest Completion Flow", () => {
    async function createJoinLaunchSelectRole(page: Page) {
        const username = `OrgComp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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

        // 2. Create Batch (of 3)
        await page.click('button:has-text("Create New Batch")');
        await page.fill('input[type="number"]', "3");
        await page.click('button:has-text("CREATE BATCH")');
        await expect(page.locator("text=BATCH-").first()).toBeVisible();
        await page.getByTitle("Manage batch").first().click();

        // 3. Launch Game
        await page.click('button:has-text("LAUNCH MISSION")');
        await expect(page).toHaveURL(/\/game\/[a-f0-9-]{36}/, { timeout: 15000 });

        // 4. Join as Player
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "QuestPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("QuestPlayer")).toBeVisible({ timeout: 5000 });

        // 5. Start Mission
        await page.click('button:has-text("Lancer la partie")');
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        // 6. Select Role
        await page.click('button:has-text("CREWMATE")');
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    }

    test("complete quest s1 and auto-redirect to home with progress update", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        // Get gameId from URL
        const url = page.url();
        const gameId = url.split("/game/")[1];
        expect(gameId).toBeTruthy();

        // Check initial progress (should be 0/3)
        await expect(page.getByText("0/3 quêtes accomplies")).toBeVisible();

        // Navigate to specific quest s1 (answer: TRUE)
        await page.goto(`/game/${gameId}/quest?duration=short&questId=s1`);

        // Verify quest loaded
        await expect(page.getByText("Vérification de Protocole")).toBeVisible();

        // Answer correctly (VRAI)
        await page.getByLabel("Répondre VRAI").click();

        // Expect Celebration Overlay
        await expect(page.getByRole("heading", { name: /MISSION\s*ACCOMPLIE/i })).toBeVisible({ timeout: 15000 });
        
        // Wait for auto-redirect
        await expect(page).toHaveURL(new RegExp(`/game/${gameId}$`), { timeout: 15000 });

        // Verify progress updated
        await expect(page.getByText("1/3 quêtes accomplies")).toBeVisible();
    });

    test("manual exit from success overlay", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        const url = page.url();
        const gameId = url.split("/game/")[1];

        // Navigate to quest s1
        await page.goto(`/game/${gameId}/quest?duration=short&questId=s1`);

        // Answer correctly
        await page.getByLabel("Répondre VRAI").click();

        // Expect Overlay
        await expect(page.getByRole("heading", { name: /MISSION\s*ACCOMPLIE/i })).toBeVisible({ timeout: 15000 });

        // Click Manual Exit button
        await page.click('button:has-text("Retour au Cockpit")');

        // Should redirect immediately
        await expect(page).toHaveURL(new RegExp(`/game/${gameId}$`));
        
        // Verify progress updated
        await expect(page.getByText("1/3 quêtes accomplies")).toBeVisible();
    });
});
