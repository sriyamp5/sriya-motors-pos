# Backup and restore

## Automatic backups

- A backup is taken **once a day** while the POS is open (checked every hour, and 30 seconds after start-up).
- A backup is taken **before every database update** (`pre-update`) and **before every restore** (`pre-restore`).
- The newest *N* backups are kept (default 30, set under **Settings → Backup**).

Backups are gzip-compressed SQL files named `sriya-pos-YYYYMMDD-HHMMSS-<reason>.sql.gz`. They are produced by the application itself, so MySQL client tools are not required.

## Where backups are stored

- Default: `%APPDATA%\Sriya Motors POS\backups`
- Recommended: a folder on a pen drive or external disk, chosen under **Settings → Backup → Browse**

If the chosen folder is not available (for example the pen drive is unplugged), the backup is written to the default folder and the admin sees a warning. No backup is skipped.

For extra safety, copy a recent backup file to another place (Google Drive, email to yourself) once a week.

## Manual backup

**Settings → Backup → Back up now**

## Restore

1. **Settings → Backup**.
2. Click **Restore** next to a backup in the list, or **Restore from file…** to pick a file from a pen drive.
3. Type `RESTORE` and confirm.

The current data is backed up first, then the database is replaced, and any newer database updates are applied. Everyone must sign in again.

## Technical notes

- `server/modules/backup/backupService.js` writes `DROP TABLE` / `CREATE TABLE` / `INSERT` statements for every table, including `schema_migrations`, so a restored older backup is upgraded by the normal migration step.
- A backup is written to a `.partial` file and renamed when complete, so an interrupted backup never looks valid.
