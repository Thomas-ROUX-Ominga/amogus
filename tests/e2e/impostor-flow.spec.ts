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

    test("impostor scanning a quest: immediate success overlay shown with glitch", async ({ page }) => {
        await createJoinLaunchSelectImpostor(page);

        // Click SCAN button (defaults to duration=short)
        const scanLink = page.getByRole("link", { name: /Scanner/i });
        await expect(scanLink).toBeVisible();
        await scanLink.click();

        // Should navigate to quest page
        await expect(page).toHaveURL(/\/quest\?duration=short/, { timeout: 10000 });

        // Content masking checks
        // 1. Duration badge should be hidden (no "COURT" text)
        await expect(page.getByText("COURT", { exact: true })).not.toBeVisible();

        // 2. Real quest titles shouldn't be visible.
        await expect(page.getByText("Vérification de Protocole")).not.toBeVisible();
        
        // 3. Interactive quest area (renderer) should not be visible.
        await expect(page.getByLabel("Répondre VRAI")).not.toBeVisible();
        await expect(page.getByLabel("Répondre FAUX")).not.toBeVisible();

        // 4. Should see success overlay immediately (using heading selector for multi-line text)
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("heading", { name: /ACCOMPLIE/i })).toBeVisible({ timeout: 5000 });

        // 5. Should auto-redirect back to home
        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });
        await expect(page.getByText(/Game Cockpit/i)).toBeVisible();
    });

    test("impostor access via direct URL with different durations: all are masked and trigger success", async ({ page }) => {
        await createJoinLaunchSelectImpostor(page);
        const url = page.url();
        const gameId = url.split("/game/")[1];

        // Try Medium
        await page.goto(`/game/${gameId}/quest?duration=medium`);
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText("MOYEN", { exact: true })).not.toBeVisible();

        // Try Long
        await page.goto(`/game/${gameId}/quest?duration=long`);
        await expect(page.getByRole("heading", { name: /MISSION/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText("LONG", { exact: true })).not.toBeVisible();
    });
});
