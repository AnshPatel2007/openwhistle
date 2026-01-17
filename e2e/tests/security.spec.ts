import { test, expect } from '@playwright/test';

/**
 * OpenWhistle Security Tests
 * Tests for authentication, authorization, and XSS prevention
 */

test.setTimeout(30000);

test.describe('Authentication & Authorization', () => {
    test('Unauthorized access to admin dashboard is blocked', async ({ page }) => {
        // Clear any existing session
        await page.context().clearCookies();
        await page.evaluate(() => localStorage.clear());

        // Try to access admin dashboard directly
        await page.goto('/admin/dashboard');
        await page.waitForLoadState('networkidle');

        // Should be redirected to admin login
        expect(page.url()).toContain('/admin');
        await expect(page.getByRole('heading', { name: 'Meldestellen-Portal' })).toBeVisible();
        await expect(page.locator('#username')).toBeVisible();
    });

    test('Unauthorized access to admin settings is blocked', async ({ page }) => {
        await page.context().clearCookies();
        await page.evaluate(() => localStorage.clear());

        await page.goto('/admin/settings');
        await page.waitForLoadState('networkidle');

        // Should redirect to login
        expect(page.url()).toContain('/admin');
        await expect(page.locator('#username')).toBeVisible();
    });

    test('Unauthorized access to user management is blocked', async ({ page }) => {
        await page.context().clearCookies();
        await page.evaluate(() => localStorage.clear());

        await page.goto('/admin/users');
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/admin');
        await expect(page.locator('#username')).toBeVisible();
    });
});

test.describe('Session Security', () => {
    test('Logout terminates session completely', async ({ page }) => {
        // Login first
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');
        await page.getByRole('button', { name: 'Anmelden' }).click();
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });

        // Verify logged in
        await expect(page.locator('text=Alle Hinweise')).toBeVisible();

        // Logout
        await page.getByRole('button', { name: 'Abmelden' }).click();
        await page.waitForURL('/admin');

        // Try to navigate back using direct URL
        await page.goto('/admin/dashboard');
        await page.waitForLoadState('networkidle');

        // Should be redirected to login (session terminated)
        expect(page.url()).toContain('/admin');
        await expect(page.locator('#username')).toBeVisible();
    });

    test('Token is cleared from localStorage on logout', async ({ page }) => {
        // Login
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');
        await page.getByRole('button', { name: 'Anmelden' }).click();
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });

        // Check token exists
        const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
        expect(tokenBefore).not.toBeNull();

        // Logout
        await page.getByRole('button', { name: 'Abmelden' }).click();
        await page.waitForURL('/admin');

        // Token should be cleared
        const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
        expect(tokenAfter).toBeNull();
    });
});

test.describe('XSS Prevention', () => {
    test('Script tags in report content are not executed', async ({ page }) => {
        // Flag to detect if XSS is executed
        let xssTriggered = false;

        // Listen for any dialog that might be triggered by XSS
        page.on('dialog', async (dialog) => {
            xssTriggered = true;
            await dialog.dismiss();
        });

        // Submit a report with XSS payload
        await page.goto('/submit');
        await page.waitForLoadState('networkidle');

        await page.selectOption('#category', 'Sonstiges');
        await page.fill('#content', '<script>alert("XSS Attack!")</script> This is malicious content with <img src=x onerror=alert("XSS2")>');
        await page.getByRole('button', { name: 'Hinweis abgeben' }).click();
        await page.waitForURL('/credentials', { timeout: 15000 });

        // Get credentials
        const caseIdElement = page.locator('code').first();
        const caseId = await caseIdElement.textContent();

        // Login as admin to view the report
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');
        await page.getByRole('button', { name: 'Anmelden' }).click();
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });

        // Find and click on the report with XSS content
        await page.waitForLoadState('networkidle');
        const reportLink = page.locator(`text=${caseId}`).first();

        if (await reportLink.isVisible()) {
            await reportLink.click();
            await page.waitForLoadState('networkidle');

            // Wait for content to render - XSS would trigger here if vulnerable
            await page.waitForTimeout(2000);
        }

        // XSS should NOT have been triggered
        expect(xssTriggered).toBe(false);
    });

    test('HTML entities are properly escaped in displayed content', async ({ page }) => {
        // Submit report with HTML content
        await page.goto('/submit');
        await page.waitForLoadState('networkidle');

        const htmlPayload = '<b>Bold</b> and <i>italic</i> and <a href="evil.com">link</a>';

        await page.selectOption('#category', 'Datenschutz');
        await page.fill('#content', htmlPayload);
        await page.getByRole('button', { name: 'Hinweis abgeben' }).click();
        await page.waitForURL('/credentials', { timeout: 15000 });

        // Save case ID for later verification
        const caseIdElement = page.locator('code').first();
        const caseId = await caseIdElement.textContent();

        // Login as admin
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');
        await page.getByRole('button', { name: 'Anmelden' }).click();
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        // Navigate to the case
        const reportLink = page.locator(`text=${caseId}`).first();
        if (await reportLink.isVisible()) {
            await reportLink.click();
            await page.waitForLoadState('networkidle');

            // The HTML should be displayed as text, not rendered
            // Check that no <b> or <i> tags are actually rendering bold/italic
            const pageContent = await page.content();

            // The raw HTML should appear as text content, not be parsed
            // React escapes by default, so the tags should be visible as text
            expect(pageContent).not.toContain('<b>Bold</b>');
        }
    });
});

test.describe('API Security', () => {
    test('Admin API returns 401 without token', async ({ request }) => {
        const response = await request.get('/api/admin/reports');
        expect(response.status()).toBe(401);
    });

    test('Admin API rejects invalid token', async ({ request }) => {
        const response = await request.get('/api/admin/reports', {
            headers: {
                'Authorization': 'Bearer invalid-token-here'
            }
        });
        expect(response.status()).toBe(401);
    });
});
