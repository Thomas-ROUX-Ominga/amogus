import { test, expect } from "@playwright/test";

test.describe("Admin Authentication UI - Simple Tests", () => {
  test("should show login page elements", async ({ page }) => {
    await page.goto("/login");
    
    // Check login page elements
    await expect(page.locator('h1:has-text("Organizer Login")')).toBeVisible();
    await expect(page.locator('input[placeholder="ID..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="SECRET..."]')).toBeVisible();
    await expect(page.locator('button:has-text("INITIALIZE SESSION")')).toBeVisible();
  });

  test("should show registration page elements", async ({ page }) => {
    await page.goto("/register");
    
    // Check registration page elements
    await expect(page.locator('h1:has-text("Organizer Setup")')).toBeVisible();
    await expect(page.locator('input[placeholder="New_ID..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="Secret..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="Repeat..."]')).toBeVisible();
    await expect(page.locator('button:has-text("REGISTER OPERATOR")')).toBeVisible();
  });

  test("should validate login form inputs", async ({ page }) => {
    await page.goto("/login");
    
    const usernameInput = page.locator('input[placeholder="ID..."]');
    const passwordInput = page.locator('input[placeholder="SECRET..."]');
    const loginButton = page.locator('button:has-text("INITIALIZE SESSION")');
    
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
    await page.goto("/register");
    
    const usernameInput = page.locator('input[placeholder="New_ID..."]');
    const passwordInput = page.locator('input[placeholder="Secret..."]');
    const confirmPasswordInput = page.locator('input[placeholder="Repeat..."]');
    const registerButton = page.locator('button:has-text("REGISTER OPERATOR")');
    
    // Initially button should be disabled // Note: The new UI disables button based on input state
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
    await page.goto("/register");
    
    const passwordInput = page.locator('input[placeholder="Secret..."]');
    
    // Find the eye icon button inside the input group
    // The structure is div.relative > input + button
    const toggleButton = page.locator('button:has(svg.lucide-eye), button:has(svg.lucide-eye-off)');
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute("type", "password");
    
    // Toggle password visibility
    if (await toggleButton.count() > 0) {
      await toggleButton.first().click();
      await expect(passwordInput).toHaveAttribute("type", "text");
      
      await toggleButton.first().click();
      await expect(passwordInput).toHaveAttribute("type", "password");
    }
  });

  test("should have proper login form attributes", async ({ page }) => {
    await page.goto("/login");
    
    // Check form attributes
    const usernameInput = page.locator('input[placeholder="ID..."]');
    const passwordInput = page.locator('input[placeholder="SECRET..."]');
    
    await expect(usernameInput).toHaveAttribute("autocomplete", "username");
    await expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    await expect(usernameInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("should display security notices", async ({ page }) => {
    await page.goto("/register");
    
    // Check for security notice section
    await expect(page.locator('text=[SECURITY_PROTOCOL]')).toBeVisible();
    await expect(page.locator('text=Passwords are hashed')).toBeVisible();
    await expect(page.locator('text=Sessions expire automatically')).toBeVisible();
  });

  test("should have proper terminal styling", async ({ page }) => {
    await page.goto("/login");
    
    // Check for styling elements specific to the layout
    await expect(page.locator('.min-h-screen.bg-black')).toBeVisible();
    await expect(page.locator('text=System: ORGANIZER_PORTAL_V2')).toBeVisible();
    await expect(page.locator('text=Protocol: SECURE_LOGIN')).toBeVisible();
  });
});
