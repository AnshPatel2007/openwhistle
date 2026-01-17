import cron from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import { config } from '../config/env';

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/backups';
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || '/app/data/whistle.db';
const RETENTION_DAYS = 30;

/**
 * Create a backup of the SQLite database
 */
async function createBackup(): Promise<void> {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 16); // YYYY-MM-DDTHH-MM

    const backupFileName = `backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    try {
        // Ensure backup directory exists
        await fs.ensureDir(BACKUP_DIR);

        // Check if database file exists
        if (!(await fs.pathExists(DB_PATH))) {
            console.log('[Backup] Database file not found, skipping backup');
            return;
        }

        // Copy database file
        await fs.copy(DB_PATH, backupPath);
        console.log(`[Backup] Created: ${backupFileName}`);

        // Clean up old backups
        await cleanupOldBackups();
    } catch (error) {
        console.error('[Backup] Failed to create backup:', error);
    }
}

/**
 * Delete backups older than RETENTION_DAYS
 */
async function cleanupOldBackups(): Promise<void> {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const now = Date.now();
        const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.startsWith('backup-') || !file.endsWith('.db')) {
                continue;
            }

            const filePath = path.join(BACKUP_DIR, file);
            const stats = await fs.stat(filePath);
            const age = now - stats.mtime.getTime();

            if (age > maxAge) {
                await fs.remove(filePath);
                console.log(`[Backup] Deleted old backup: ${file}`);
            }
        }
    } catch (error) {
        console.error('[Backup] Failed to cleanup old backups:', error);
    }
}

/**
 * Initialize the backup scheduler
 * Runs every day at 03:00 AM
 */
export function initBackupScheduler(): void {
    // Only run in production or if explicitly enabled
    if (config.nodeEnv !== 'production' && !process.env.ENABLE_BACKUPS) {
        console.log('[Backup] Disabled in development. Set ENABLE_BACKUPS=true to enable.');
        return;
    }

    // Schedule: Every day at 03:00 AM
    cron.schedule('0 3 * * *', async () => {
        console.log('[Backup] Starting scheduled backup...');
        await createBackup();
    });

    console.log('[Backup] Scheduler initialized. Backups will run daily at 03:00 AM.');
}

/**
 * Manually trigger a backup (for testing or on-demand)
 */
export async function triggerBackup(): Promise<void> {
    console.log('[Backup] Manual backup triggered...');
    await createBackup();
}
