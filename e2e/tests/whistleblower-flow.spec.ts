import { test, expect } from '@playwright/test';

/**
 * OpenWhistle E2E Test Suite (German UI)
 * Tests the complete whistleblower flow from submission to admin review
 */

// Increase default timeout for stability
test.setTimeout(30000);

test.describe('Whistleblower Flow', () => {
    test('1. Landing page loads with German text', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check German UI elements - use first() to avoid strict mode violations
        await expect(page.locator('text=Hinweis abgeben').first()).toBeVisible();
        await expect(page.locator('text=Postfach abrufen').first()).toBeVisible();
        // Use heading role for more specific selection
        await expect(page.getByRole('heading', { name: 'Interne Meldestelle' })).toBeVisible();
    });

    test('2. Submit report with category and attachment', async ({ page }) => {
        await page.goto('/submit');
        await page.waitForLoadState('networkidle');

        // Verify form title
        await expect(page.getByRole('heading', { name: 'Hinweis abgeben' })).toBeVisible();

        // Select category using the id selector (most reliable)
        await page.selectOption('#category', 'Korruption');

        // Fill in description
        await page.fill('#content', 'Dies ist ein automatisierter Testbericht für E2E-Tests. Es geht um einen Verdacht auf Korruption in der Einkaufsabteilung. Datum: ' + new Date().toISOString());

        // Upload test file
        const fileBuffer = Buffer.from('Test Anhang für automatisierten E2E-Test');
        await page.setInputFiles('input[type="file"]', {
            name: 'test-anhang.txt',
            mimeType: 'text/plain',
            buffer: fileBuffer,
        });

        // Verify file is shown in list
        await expect(page.locator('text=test-anhang.txt')).toBeVisible();

        // Wait for any API calls to complete before submitting
        await page.waitForLoadState('networkidle');

        // Submit the form - use button role with exact name
        await page.getByRole('button', { name: 'Hinweis abgeben' }).click();

        // Wait for navigation to credentials page
        await page.waitForURL('/credentials', { timeout: 15000 });

        // Verify we're on credentials page with German text
        await expect(page.locator('text=Hinweis erfolgreich übermittelt')).toBeVisible();
    });

    test('3. Credentials page displays access data in German', async ({ page }) => {
        // Submit a quick report to get credentials
        await page.goto('/submit');
        await page.waitForLoadState('networkidle');

        await page.selectOption('#category', 'Sonstiges');
        await page.fill('#content', 'Kurzer Test für Zugangsdaten-Anzeige.');
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: 'Hinweis abgeben' }).click();
        await page.waitForURL('/credentials', { timeout: 15000 });

        // Verify German labels - use label role or getByText with exact match
        await expect(page.getByText('Zugriffsschlüssel', { exact: true })).toBeVisible();
        await expect(page.getByText('Sicherheits-PIN', { exact: true })).toBeVisible();
        await expect(page.locator('text=Wichtig: Zugangsdaten sichern')).toBeVisible();

        // Verify case ID format (WH-XXX-XXX) in code element
        const caseIdElement = page.locator('code').first();
        const caseId = await caseIdElement.textContent();
        expect(caseId).toMatch(/WH-\d{3}-\d{3}/);

        // Verify action buttons
        await expect(page.getByRole('link', { name: 'Zum Postfach' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Zur Startseite' })).toBeVisible();
    });

    test('4. Admin login with German UI', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Verify German labels using getByRole and getByText
        await expect(page.getByRole('heading', { name: 'Meldestellen-Portal' })).toBeVisible();
        await expect(page.getByText('Benutzername', { exact: true })).toBeVisible();
        await expect(page.getByText('Passwort', { exact: true })).toBeVisible();

        // Fill login form using id selectors
        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');

        await page.waitForLoadState('networkidle');

        // Click login button
        await page.getByRole('button', { name: 'Anmelden' }).click();

        // Wait for dashboard
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });

        // Verify dashboard loaded
        await expect(page.locator('text=Alle Hinweise')).toBeVisible();
    });

    test('5. Admin sees reports in dashboard', async ({ page }) => {
        // Login first
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');
        await page.getByRole('button', { name: 'Anmelden' }).click();
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        // Check dashboard elements
        await expect(page.locator('text=Meldestellen-Portal').first()).toBeVisible();
        await expect(page.locator('text=Alle Hinweise')).toBeVisible();

        // Look for case ID pattern
        const caseLinks = page.locator('a[href*="/admin/case/"]');

        // Wait a moment for data to load
        await page.waitForTimeout(1000);
        const count = await caseLinks.count();

        if (count > 0) {
            // Click on first case
            await caseLinks.first().click();

            // Verify case detail page loads
            await page.waitForLoadState('networkidle');
            await expect(page.locator('text=Vorgang:').first()).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Admin Features', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.fill('#username', 'admin');
        await page.fill('#password', process.env.ADMIN_PASSWORD || '0E66ibCE4UAulR6c');
        await page.getByRole('button', { name: 'Anmelden' }).click();
        await page.waitForURL('/admin/dashboard', { timeout: 15000 });
        await page.waitForLoadState('networkidle');
    });

    test('Settings page accessible', async ({ page }) => {
        // Navigate to settings
        await page.getByRole('link', { name: 'Einstellungen' }).click();
        await page.waitForURL('/admin/settings');
        await page.waitForLoadState('networkidle');

        // Verify settings page German text
        await expect(page.locator('text=Whitelabeling')).toBeVisible();
        await expect(page.locator('#companyName')).toBeVisible();
        await expect(page.locator('#welcomeText')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Einstellungen speichern' })).toBeVisible();
    });

    test('User management accessible', async ({ page }) => {
        // Navigate to user management
        await page.getByRole('link', { name: 'Benutzer' }).click();
        await page.waitForURL('/admin/users');
        await page.waitForLoadState('networkidle');

        // Verify page loaded
        await expect(page.locator('text=Benutzerverwaltung')).toBeVisible();
    });

    test('Logout works', async ({ page }) => {
        // Click logout button
        await page.getByRole('button', { name: 'Abmelden' }).click();

        // Should redirect to login page
        await page.waitForURL('/admin');
        await expect(page.getByRole('heading', { name: 'Meldestellen-Portal' })).toBeVisible();
        await expect(page.locator('#username')).toBeVisible();
    });
});
