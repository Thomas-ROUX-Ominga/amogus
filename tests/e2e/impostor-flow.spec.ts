import { test, expect, type Page } from "@playwright/test";

test.describe("Impostor Content Masking Flow", () => {
    async function createJoinLaunchSelectImpostor(page: Page) {
        const username = `OrgImp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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

        // 4. Join as Player
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "ImpostorPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("ImpostorPlayer")).toBeVisible({ timeout: 5000 });

        // 5. Start Mission
        await page.click('button:has-text("Lancer la partie")');
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        // 6. Select Impostor
        await page.click('button:has-text("Impost")', { timeout: 15000 });
        
        // Wait for the return link to ensure the page has fully settled after transitions
        await expect(page.getByText(/Retour à l'accueil/)).toBeVisible({ timeout: 15000 });
        
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 10000 });
    }

    test("impostor scanning a quest: immediate success overlay shown with glitch", async ({ page }) => {
        await createJoinLaunchSelectImpostor(page);

        // Click SCAN button
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        await scanLink.click();

        // Should navigate to quest page
        await expect(page).toHaveURL(/\/quest\?duration=short/, { timeout: 10000 });

        // Content masking checks
        // 1. Duration badge should be hidden (no "COURT" text)
        await expect(page.getByText("COURT", { exact: true })).not.toBeVisible();

        // 2. Real quest titles shouldn't be visible
        await expect(page.getByText("Vérification de Protocole")).not.toBeVisible();
        
        // 3. Interactive quest area should not be visible
        await expect(page.getByLabel("Répondre VRAI")).not.toBeVisible();

        // 4. Should see success overlay immediately
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("heading", { name: /ACCOMPLIE/i })).toBeVisible({ timeout: 5000 });

        // 5. Should auto-redirect back to home
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });
    });

    test("impostor access via direct URL with different durations: all are masked and trigger success", async ({ page }) => {
        await createJoinLaunchSelectImpostor(page);
        const url = page.url();
        const gameId = url.split("/game/")[1];

        // Try Medium
        await page.goto(`/game/${gameId}/quest?duration=medium`);
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });

        // Try Long
        await page.goto(`/game/${gameId}/quest?duration=long`);
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });
    });
});
