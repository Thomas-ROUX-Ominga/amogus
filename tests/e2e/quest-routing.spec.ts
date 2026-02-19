import { test, expect, type Page } from "@playwright/test";

test.describe("Quest Routing Flow", () => {
    async function createJoinLaunchSelectRole(page: Page) {
        const username = `OrgQuest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
        await page.fill('input[placeholder="ENTER PSEUDO..."]', "QuestPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("QuestPlayer")).toBeVisible({ timeout: 5000 });

        // 5. Start Mission (Launch)
        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        // 6. Select Role
        const crewmateButton = page.getByRole("button", { name: /Crewmate/i });
        await crewmateButton.click();

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    }

    test("full flow: create → join → launch → select role → Game Home → click SCAN → quest page loads", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        // SCAN button should be enabled
        await expect(page.getByText("SCANNER")).toBeVisible();

        // Click SCAN button (it's a link)
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        await scanLink.click();

        // Should navigate to quest page
        await expect(page).toHaveURL(/\/quest\?duration=short/, { timeout: 10000 });

        // Quest page should show quest content
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 5000 });
        await expect(page.getByText("Abandonner")).toBeVisible();
    });

    test("SCAN button is enabled on Game Home", async ({ page }) => {
        await createJoinLaunchSelectRole(page);
        await expect(page.getByText("SCANNER")).toBeVisible();
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
    });

    test("flee/abandon button returns to Game Home", async ({ page }) => {
        await createJoinLaunchSelectRole(page);
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });

        const fleeButton = page.getByRole("button", { name: /Abandonner/i });
        await expect(fleeButton).toBeVisible();
        await fleeButton.click();

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    });

    test("invalid duration param shows error page with recovery link", async ({ page }) => {
        await createJoinLaunchSelectRole(page);
        const url = page.url();
        const gameId = url.split("/game/")[1];
        await page.goto(`/game/${gameId}/quest?duration=invalid`);
        await expect(page.getByRole("heading", { name: "DURÉE INVALIDE" })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/RECOVER SIGNAL/i)).toBeVisible();
    });

    test("direct URL access to quest page validates game/player state", async ({ page }) => {
        await page.goto("/game/non-existent-game-id/quest?duration=short");
        await expect(
            page.getByText(/SESSION INTROUVABLE|SIGNAL PERDU|SIGNAL LOST|SESSION DECOMMISSIONED/i)
        ).toBeVisible({ timeout: 10000 });
    });

    test("quest interaction: correct answer shows success state", async ({ page }) => {
        await createJoinLaunchSelectRole(page);
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });

        // Identify quest type and solve (brute force since it's dynamic)
        const vraiButton = page.getByLabel("Répondre VRAI");
        const isTrueFalse = await vraiButton.isVisible().catch(() => false);

        if (isTrueFalse) {
            await vraiButton.click();
            const retryButton = page.getByLabel("Réessayer la question");
            if (await retryButton.isVisible().catch(() => false)) {
                await retryButton.click();
                await page.getByLabel("Répondre FAUX").click();
            }
        } else {
            const options = page.locator('[role="radio"]');
            const count = await options.count();
            for (let i = 0; i < count; i++) {
                await options.nth(i).click();
                const retryButton = page.getByLabel("Réessayer la question");
                if (await retryButton.isVisible().catch(() => false)) {
                    await retryButton.click();
                    continue;
                }
                break;
            }
        }
        await expect(page.getByText("MISSION ENREGISTRÉE")).toBeVisible({ timeout: 5000 });
    });

    test("full flow: answer quest correctly → progress bar updated", async ({ page }) => {
        await createJoinLaunchSelectRole(page);
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 5000 });

        // Solve quest
        const vraiButton = page.getByLabel("Répondre VRAI");
        if (await vraiButton.isVisible().catch(() => false)) {
            await vraiButton.click();
            const retryButton = page.getByLabel("Réessayer la question");
            if (await retryButton.isVisible().catch(() => false)) {
                await retryButton.click();
                await page.getByLabel("Répondre FAUX").click();
            }
        } else {
            const options = page.locator('[role="radio"]');
            for (let i = 0; i < await options.count(); i++) {
                await options.nth(i).click();
                const retryButton = page.getByLabel("Réessayer la question");
                if (await retryButton.isVisible().catch(() => false)) {
                    await retryButton.click();
                    continue;
                }
                break;
            }
        }

        await expect(page.getByText("MISSION ENREGISTRÉE")).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("heading", { name: /MISSION\s*ACCOMPLIE/i })).toBeVisible({ timeout: 15000 });
        await page.getByRole("button", { name: /Retour au Cockpit/i }).click();

        // Progress shows 1/3 (since we created batch of 3)
        await expect(page.getByText("1/3 quêtes accomplies")).toBeVisible({ timeout: 5000 });
    });

    test("quest progress persists across page refreshes", async ({ page }) => {
        await createJoinLaunchSelectRole(page);
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });
        
        // Solve quest
        const vraiButton = page.getByLabel("Répondre VRAI");
        if (await vraiButton.isVisible().catch(() => false)) {
            await vraiButton.click();
            const retryButton = page.getByLabel("Réessayer la question");
            if (await retryButton.isVisible().catch(() => false)) {
                await retryButton.click();
                await page.getByLabel("Répondre FAUX").click();
            }
        } else {
            const options = page.locator('[role="radio"]');
            for (let i = 0; i < await options.count(); i++) {
                await options.nth(i).click();
                const retryButton = page.getByLabel("Réessayer la question");
                if (await retryButton.isVisible().catch(() => false)) {
                    await retryButton.click();
                    continue;
                }
                break;
            }
        }

        await expect(page.getByText("MISSION ENREGISTRÉE")).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("heading", { name: /MISSION\s*ACCOMPLIE/i })).toBeVisible({ timeout: 15000 });
        await page.getByRole("button", { name: /Retour au Cockpit/i }).click();
        await expect(page.getByText("1/3 quêtes accomplies")).toBeVisible({ timeout: 5000 });

        await page.reload();
        await expect(page.getByText("1/3 quêtes accomplies")).toBeVisible({ timeout: 5000 });
    });
});
