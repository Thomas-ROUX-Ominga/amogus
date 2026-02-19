import { test, expect } from '@playwright/test';

test.describe('QR & Localization Flow', () => {
  test('should allow admin to manage quest locations and generate PDF', async ({ page }) => {
    const username = `OrgQR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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

    await expect(page).toHaveURL(/\/(admin\/batches|admin\/dashboard)/);
    
    // 2. Create a new batch
    const createButton = page.getByRole('button', { name: /Create New Batch/i });
    await expect(createButton).toBeVisible();
    await createButton.click();
    
    const questInput = page.locator('input[type="number"]');
    await expect(questInput).toBeVisible();
    await questInput.fill('6');
    await page.getByRole('button', { name: /CREATE BATCH/i }).click();
    
    // Wait for the list to refresh
    await expect(page.locator('a[title="Manage batch"]').first()).toBeVisible({ timeout: 10000 });
    
    // 3. Find the newly created batch and click "Manage"
    const manageButton = page.locator('a[title="Manage batch"]').first();
    await manageButton.click();
    
    // 4. Verify we are on the batch detail page
    await expect(page).toHaveURL(/\/admin\/batches\/[a-zA-Z0-9-]+/);
    await expect(page.getByRole('heading', { name: /BATCH-/ })).toBeVisible();
    
    // 5. Edit a location
    const editButton = page.locator('button[title="Edit location"]').first();
    await editButton.click();
    
    const locationInput = page.locator('input[placeholder="Enter location..."]');
    await expect(locationInput).toBeVisible();
    await locationInput.fill('E2E Test Location');
    await page.keyboard.press('Enter');
    
    // 6. Save locations
    const saveButton = page.getByRole('button', { name: /SAVE LOCATIONS/i });
    await saveButton.click();
    
    // 7. Verify success message
    await expect(page.locator('text=Locations saved successfully')).toBeVisible();
    
    // 8. Click Generate PDF (check the button is enabled)
    const generateButton = page.getByRole('button', { name: /GENERATE PDF/i });
    await expect(generateButton).toBeEnabled();
  });
});
