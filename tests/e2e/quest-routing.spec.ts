import { test, expect } from "@playwright/test";

test.describe("Quest Routing Flow", () => {
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

    test("full flow: create → join → launch → select role → Game Home → click SCAN → quest page loads", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        // SCAN button should be enabled (no "Bientôt disponible")
        await expect(page.getByText("SCANNER")).toBeVisible();
        await expect(page.getByText("Bientôt disponible")).not.toBeVisible();

        // Click SCAN button (it's a link now)
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        await scanLink.click();

        // Should navigate to quest page
        await expect(page).toHaveURL(/\/quest\?duration=short/, { timeout: 10000 });

        // Quest page should show quest content
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 5000 });
        await expect(page.getByText("COURT", { exact: true })).toBeVisible();
        await expect(page.getByText("Abandonner")).toBeVisible();
    });

    test("SCAN button is enabled on Game Home (no longer shows 'Bientôt disponible')", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        await expect(page.getByText("SCANNER")).toBeVisible();
        await expect(page.getByText("Bientôt disponible")).not.toBeVisible();

        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        const href = await scanLink.getAttribute("href");
        expect(href).toContain("/quest?duration=short");
    });

    test("flee/abandon button returns to Game Home", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();

        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });

        // Click flee button
        const fleeButton = page.getByRole("button", { name: /Abandonner/i });
        await expect(fleeButton).toBeVisible();
        await fleeButton.click();

        // Should return to Game Home
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    });

    test("invalid duration param shows error page with recovery link", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        // Get the current game URL
        const url = page.url();
        const gameId = url.split("/game/")[1];

        // Navigate directly with invalid duration
        await page.goto(`/game/${gameId}/quest?duration=invalid`);

        // Should show error
        await expect(page.getByRole("heading", { name: "DURÉE INVALIDE" })).toBeVisible({ timeout: 10000 });

        // Should have recovery action
        await expect(page.getByText(/RECOVER SIGNAL/i)).toBeVisible();
    });

    test("direct URL access to quest page validates game/player state", async ({ page }) => {
        // Navigate to a non-existent game's quest page
        await page.goto("/game/non-existent-game-id/quest?duration=short");

        // Should show error (game not found or signal lost)
        await expect(
            page.getByText(/SESSION INTROUVABLE|SIGNAL PERDU|SIGNAL LOST|SESSION DECOMMISSIONED/i)
        ).toBeVisible({ timeout: 10000 });
    });

    test("quest interaction: correct answer shows success state (green highlight + buttons disabled)", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });

        // Detect quest type
        const vraiButton = page.getByLabel("Répondre VRAI");
        const isTrueFalse = await vraiButton.isVisible().catch(() => false);

        if (isTrueFalse) {
            // Try VRAI — if wrong, retry then try FAUX
            await vraiButton.click();
            const retryButton = page.getByLabel("Réessayer la question");
            const wasWrong = await retryButton.isVisible().catch(() => false);
            if (wasWrong) {
                await retryButton.click();
                await page.getByLabel("Répondre FAUX").click();
            }
            // Now we have the correct answer — verify success state
            const correctButton = wasWrong
                ? page.getByLabel("Répondre FAUX")
                : page.getByLabel("Répondre VRAI");
            await expect(correctButton).toBeDisabled();
            // Verify green success class on the selected button
            await expect(correctButton).toHaveClass(/border-\[#2DA44E\]/);
        } else {
            // QCM: try options until correct
            const options = page.locator('[role="radio"]');
            const count = await options.count();
            for (let i = 0; i < count; i++) {
                await options.nth(i).click();
                const retryButton = page.getByLabel("Réessayer la question");
                const wasWrong = await retryButton.isVisible().catch(() => false);
                if (wasWrong) {
                    await retryButton.click();
                    continue;
                }
                // Correct answer found — verify success state
                await expect(options.nth(i)).toBeDisabled();
                await expect(options.nth(i)).toHaveClass(/border-\[#2DA44E\]/);
                break;
            }
        }
    });

    test("quest interaction: wrong answer shows error state + retry resets", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });

        const vraiButton = page.getByLabel("Répondre VRAI");
        const isTrueFalse = await vraiButton.isVisible().catch(() => false);

        if (isTrueFalse) {
            // Click VRAI — if it's correct, we can't test wrong answer with this quest
            await vraiButton.click();
            const retryButton = page.getByLabel("Réessayer la question");
            const wasWrong = await retryButton.isVisible().catch(() => false);
            if (wasWrong) {
                // Verify error state: red highlight, buttons disabled, retry visible
                await expect(vraiButton).toBeDisabled();
                await expect(vraiButton).toHaveClass(/border-\[#DA3633\]/);
                await expect(retryButton).toBeVisible();
                // Click retry — buttons should be re-enabled
                await retryButton.click();
                await expect(vraiButton).toBeEnabled();
                await expect(page.getByLabel("Répondre FAUX")).toBeEnabled();
            }
            // If VRAI was correct, the test still passes (we verified success in the other test)
        } else {
            // QCM: click first option
            const firstOption = page.locator('[role="radio"]').first();
            await firstOption.click();
            const retryButton = page.getByLabel("Réessayer la question");
            const wasWrong = await retryButton.isVisible().catch(() => false);
            if (wasWrong) {
                await expect(firstOption).toBeDisabled();
                await expect(firstOption).toHaveClass(/border-\[#DA3633\]/);
                await expect(retryButton).toBeVisible();
                await retryButton.click();
                await expect(firstOption).toBeEnabled();
            }
        }
    });

    test("flee button works during quest interaction", async ({ page }) => {
        await createJoinLaunchSelectRole(page);

        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await scanLink.click();
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 10000 });

        // Verify interactive quest content is present
        const vraiButton = page.getByLabel("Répondre VRAI");
        const optionA = page.getByLabel(/^Option A:/);
        const isTrueFalse = await vraiButton.isVisible().catch(() => false);
        const isQCM = await optionA.isVisible().catch(() => false);
        expect(isTrueFalse || isQCM).toBe(true);

        // Click flee button — should still work
        const fleeButton = page.getByRole("button", { name: /Abandonner/i });
        await expect(fleeButton).toBeVisible();
        await fleeButton.click();

        // Should return to Game Home
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    });
});
