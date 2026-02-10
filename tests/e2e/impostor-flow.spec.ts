import { test, expect } from "@playwright/test";

test.describe("Impostor Content Masking Flow", () => {
    async function createJoinLaunchSelectImpostor(page: import("@playwright/test").Page) {
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "ImpostorPlayer");
        await page.click('button:has-text("REJOINDRE")');
        await expect(page.getByText("ImpostorPlayer")).toBeVisible({ timeout: 5000 });

        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();
        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        const impostorButton = page.getByRole("button", { name: /Imposteur/i });
        await impostorButton.click();

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    }

    test("impostor scanning a quest: contents are masked, duration hidden, tactical signal shown", async ({ page }) => {
        await createJoinLaunchSelectImpostor(page);

        // Click SCAN button (defaults to duration=short)
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        await scanLink.click();

        // Should navigate to quest page
        await expect(page).toHaveURL(/\/quest\?duration=short/, { timeout: 10000 });

        // Header should still be there
        await expect(page.getByText("Quest Active")).toBeVisible({ timeout: 5000 });

        // Content masking checks
        // 1. Duration badge should be hidden (no "COURT" text)
        await expect(page.getByText("COURT", { exact: true })).not.toBeVisible();

        // 2. Real quest titles shouldn't be visible. Since we don't know which one would have been pulled,
        // we check that the "Transmission Brouillée" message is present instead of generic quest patterns.
        await expect(page.getByText("Transmission Brouillée")).toBeVisible();
        
        // 3. Interactive quest area (renderer) should not be visible.
        // True-false quests use "Répondre VRAI/FAUX". QCM use radio buttons.
        await expect(page.getByLabel("Répondre VRAI")).not.toBeVisible();
        await expect(page.getByLabel("Répondre FAUX")).not.toBeVisible();
        await expect(page.locator('[role="radio"]')).not.toBeVisible();

        // 4. Success button should be visible and clickable after delay
        const successButton = page.getByRole("button", { name: /Finaliser l'Offuscation/i });
        await expect(successButton).toBeVisible({ timeout: 5000 });
        await successButton.click();

        // 5. Should see success overlay (using heading selector for multi-line text)
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("heading", { name: /ACCOMPLIE/i })).toBeVisible({ timeout: 5000 });

        // 6. Should auto-redirect back to home
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible();
    });

    test("impostor access via direct URL with different durations: all are masked", async ({ page }) => {
        await createJoinLaunchSelectImpostor(page);
        const url = page.url();
        const gameId = url.split("/game/")[1];

        // Try Medium
        await page.goto(`/game/${gameId}/quest?duration=medium`);
        await expect(page.getByText("Transmission Brouillée")).toBeVisible();
        await expect(page.getByText("MOYEN", { exact: true })).not.toBeVisible();

        // Try Long
        await page.goto(`/game/${gameId}/quest?duration=long`);
        await expect(page.getByText("Transmission Brouillée")).toBeVisible();
        await expect(page.getByText("LONG", { exact: true })).not.toBeVisible();
    });
});
