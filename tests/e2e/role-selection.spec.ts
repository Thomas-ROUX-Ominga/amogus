import { test, expect } from "@playwright/test";

test.describe("Role Selection Flow", () => {
    test("should complete full flow: create → join → launch → select Crewmate → see transition → reach home", async ({ page }) => {
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();

        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "TestPlayer");
        await page.click('button:has-text("REJOINDRE")');

        await expect(page.getByText("TestPlayer")).toBeVisible({ timeout: 5000 });

        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();

        await expect(page.getByText(/Mission Active/i)).toBeVisible({ timeout: 10000 });

        await expect(page.getByText(/Choisissez votre rôle/i)).toBeVisible({ timeout: 5000 });

        const crewmateButton = page.getByRole("button", { name: /Crewmate/i });
        await crewmateButton.click();

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText("Crewmate", { exact: true })).toBeVisible();
    });

    test("should complete full flow with Impostor role", async ({ page }) => {
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
        await expect(page.getByText("Imposteur", { exact: true })).toBeVisible();
    });

    test("should show role selection disabled when game not launched", async ({ page }) => {
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();

        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "TestPlayer");
        await page.click('button:has-text("REJOINDRE")');

        await expect(page.getByText("TestPlayer")).toBeVisible({ timeout: 5000 });

        await expect(page.getByText(/Choisissez votre rôle/i)).not.toBeVisible();
    });

    test("should display both role options with correct colors", async ({ page }) => {
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();

        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "TestPlayer");
        await page.click('button:has-text("REJOINDRE")');

        await expect(page.getByText("TestPlayer")).toBeVisible({ timeout: 5000 });

        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();

        await expect(page.getByText(/Choisissez votre rôle/i)).toBeVisible({ timeout: 10000 });

        const crewmateButton = page.getByRole("button", { name: /Crewmate/i });
        const impostorButton = page.getByRole("button", { name: /Imposteur/i });

        await expect(crewmateButton).toBeVisible();
        await expect(impostorButton).toBeVisible();

        const crewmateColor = await crewmateButton.evaluate((el) => 
            window.getComputedStyle(el).borderColor
        );
        expect(crewmateColor).toContain("45, 164, 78");

        const impostorColor = await impostorButton.evaluate((el) => 
            window.getComputedStyle(el).borderColor
        );
        expect(impostorColor).toContain("218, 54, 51");
    });

    test("should show transition animation with correct role color", async ({ page }) => {
        await page.goto("/");

        const createButton = page.getByRole("button", { name: /Créer une partie/i });
        await createButton.click();

        await expect(page).toHaveURL(/\/game\/.+/, { timeout: 10000 });

        await page.fill('input[placeholder="ENTER PSEUDO..."]', "TestPlayer");
        await page.click('button:has-text("REJOINDRE")');

        await expect(page.getByText("TestPlayer")).toBeVisible({ timeout: 5000 });

        const launchButton = page.getByRole("button", { name: /lancer la partie/i });
        await launchButton.click();

        await expect(page.getByText(/Choisissez votre rôle/i)).toBeVisible({ timeout: 10000 });

        const crewmateButton = page.getByRole("button", { name: /Crewmate/i });
        await crewmateButton.click();

        await expect(page.getByText(/Game Cockpit/i)).toBeVisible({ timeout: 5000 });
    });
});
