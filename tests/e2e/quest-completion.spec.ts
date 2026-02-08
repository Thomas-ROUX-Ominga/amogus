import { test, expect } from "@playwright/test";

test.describe("Quest Completion Flow", () => {
    async function createJoinLaunchSelectRole(page: import("@playwright/test").Page) {
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "QuestPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("QuestPlayer")).toBeVisible({ timeout: 5000 });

        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        const crewmateButton = page.getByRole("button", { name: /Crewmate/i });
        await crewmateButton.click();

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    }

    test("complete quest s1 and auto-redirect to home with progress update", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        // Get gameId from URL
        const url = page.url();
        const gameId = url.split("/game/")[1];
        expect(gameId).toBeTruthy();

        // Check initial progress (should be 0)
        // QuestProgress component usually shows "0 / X" or a progress bar.
        // Let's verify the text content if possible, or just the presence.
        // We expect "0 / "
        await expect(page.locator('text=/^0\\s*\\/\\s*\\d+/')).toBeVisible();

        // Navigate to specific quest s1 (answer: TRUE)
        await page.goto(`/game/${gameId}/quest?duration=short&questId=s1`);

        // Verify quest loaded
        await expect(page.getByText("Vérification de Protocole")).toBeVisible();

        // Answer correctly (VRAI)
        const trueButton = page.getByLabel("Répondre VRAI");
        await trueButton.click();

        // Check for error first (fast failure if something is wrong)
        const errorMsg = page.getByText("ERREUR DE SAUVEGARDE");
        if (await errorMsg.isVisible()) {
            throw new Error("Quest completion failed with error message");
        }

        // Expect Celebration Overlay
        // Use regex to match text with line break
        await expect(page.getByRole("heading", { name: /MISSION\s*ACCOMPLIE/i })).toBeVisible({ timeout: 15000 });
        
        // Wait for auto-redirect (3s delay + buffer)
        // The URL should change back to /game/[id]
        await expect(page).toHaveURL(new RegExp(`/game/${gameId}$`), { timeout: 15000 });

        // Verify overlay is gone
        await expect(page.getByText("MISSION ACCOMPLIE")).not.toBeVisible();

        // Verify progress updated (should be 1)
        await expect(page.locator('text=/^1\\s*\\/\\s*\\d+/')).toBeVisible();
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
        await expect(page.locator('text=/^1\\s*\\/\\s*\\d+/')).toBeVisible();
    });
});
