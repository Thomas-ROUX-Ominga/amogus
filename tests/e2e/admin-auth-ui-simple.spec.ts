import { test, expect } from "@playwright/test";

test.describe("Admin Authentication UI - Simple Tests", () => {
  test("should show login page elements", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Check login page elements - use more specific selectors
    await expect(page.locator('h1:has-text("Admin Access")')).toBeVisible();
    await expect(page.locator('input[placeholder="USERNAME..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="PASSWORD..."]')).toBeVisible();
    await expect(page.locator('button:has-text("SECURE LOGIN")')).toBeVisible();
  });

  test("should show registration page elements", async ({ page }) => {
    await page.goto("/admin/register");
    
    // Check registration page elements - use more specific selectors
    await expect(page.locator('h1:has-text("ADMIN SETUP")')).toBeVisible();
    await expect(page.locator('input[placeholder="admin_username..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="secure_password..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="confirm_password..."]')).toBeVisible();
    await expect(page.locator('button:has-text("CREATE ADMIN ACCOUNT")')).toBeVisible();
  });

  test("should validate login form inputs", async ({ page }) => {
    await page.goto("/admin/login");
    
    const usernameInput = page.locator('input[placeholder="USERNAME..."]');
    const passwordInput = page.locator('input[placeholder="PASSWORD..."]');
    const loginButton = page.locator('button:has-text("SECURE LOGIN")');
    
    // Initially button should be disabled
    await expect(loginButton).toBeDisabled();
    
    // Fill username only
    await usernameInput.fill("testadmin");
    await expect(loginButton).toBeDisabled();
    
    // Fill password
    await passwordInput.fill("password123");
    await expect(loginButton).toBeEnabled();
    
    // Clear username
    await usernameInput.clear();
    await expect(loginButton).toBeDisabled();
  });

  test("should validate registration form inputs", async ({ page }) => {
    await page.goto("/admin/register");
    
    const usernameInput = page.locator('input[placeholder="admin_username..."]');
    const passwordInput = page.locator('input[placeholder="secure_password..."]');
    const confirmPasswordInput = page.locator('input[placeholder="confirm_password..."]');
    const registerButton = page.locator('button:has-text("CREATE ADMIN ACCOUNT")');
    
    // Initially button should be disabled
    await expect(registerButton).toBeDisabled();
    
    // Fill username only
    await usernameInput.fill("testadmin");
    await expect(registerButton).toBeDisabled();
    
    // Fill password
    await passwordInput.fill("password123");
    await expect(registerButton).toBeDisabled();
    
    // Fill confirm password
    await confirmPasswordInput.fill("password123");
    await expect(registerButton).toBeEnabled();
    
    // Mismatch passwords
    await confirmPasswordInput.fill("different");
    await expect(registerButton).toBeDisabled();
  });

  test("should show password visibility toggle functionality", async ({ page }) => {
    await page.goto("/admin/register");
    
    const passwordInput = page.locator('input[placeholder="secure_password..."]');
    
    // Find the eye icons for password fields
    const passwordEyeIcon = passwordInput.locator('xpath=../button[contains(@class, "eye")]');
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute("type", "password");
    
    // Toggle password visibility
    if (await passwordEyeIcon.isVisible()) {
      await passwordEyeIcon.click();
      await expect(passwordInput).toHaveAttribute("type", "text");
      
      await passwordEyeIcon.click();
      await expect(passwordInput).toHaveAttribute("type", "password");
    }
  });

  test("should have proper form attributes", async ({ page }) => {
    await page.goto("/admin/register");
    
    // Check form attributes
    const passwordInput = page.locator('input[placeholder="secure_password..."]');
    const confirmPasswordInput = page.locator('input[placeholder="confirm_password..."]');
    
    // Note: These forms use JavaScript validation instead of HTML5 required
    await expect(passwordInput).toHaveAttribute("minlength", "8");
    await expect(confirmPasswordInput).toHaveAttribute("minlength", "8");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(confirmPasswordInput).toHaveAttribute("type", "password");
  });

  test("should have proper login form attributes", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Check form attributes
    const usernameInput = page.locator('input[placeholder="USERNAME..."]');
    const passwordInput = page.locator('input[placeholder="PASSWORD..."]');
    
    // Note: These forms use JavaScript validation instead of HTML5 required
    await expect(usernameInput).toHaveAttribute("autocomplete", "username");
    await expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    await expect(usernameInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("should display security notices", async ({ page }) => {
    await page.goto("/admin/register");
    
    // Check for security notice section
    await expect(page.locator('text=[SECURITY NOTICE]')).toBeVisible();
    await expect(page.locator('text=Use a strong password (8+ chars)')).toBeVisible();
    await expect(page.locator('text=Store credentials securely')).toBeVisible();
    await expect(page.locator('text=This account cannot be reset')).toBeVisible();
  });

  test("should have proper terminal styling", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Check for terminal-style elements - be more specific to avoid layout wrapper
    await expect(page.locator('.min-h-screen.bg-black.flex')).toBeVisible();
    await expect(page.locator('text=Auth_Type: ADMIN_ONLY')).toBeVisible();
    await expect(page.locator('text=Sec_Level: MAXIMUM')).toBeVisible();
  });
});
