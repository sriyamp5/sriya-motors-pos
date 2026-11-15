# Releases and automatic updates

The installed app updates itself from **GitHub Releases** (free). After you fix a bug and publish a release, the shop laptop downloads it in the background the next time it is online and shows a green banner: **Update vX is ready → Restart and update**. If nobody clicks, the update is installed automatically when the app is closed.

## How it works

- `electron/updater.js` uses `electron-updater`. It checks 15 seconds after start-up and then every 4 hours.
- The update downloads in the background while the shop keeps selling.
- Offline is normal. It is logged and not shown as an error.
- Admins can also click **Settings → Updates → Check for updates**.
- When the new version starts, any new database migrations run automatically after a `pre-update` backup.

## One-time setup

1. Create a GitHub repository, for example `sriya-motors-pos`.
   - The simplest option is a **public** repository, or a separate public repository used only for releases (for example `sriya-motors-pos-releases`) while the source stays private. A private release repository would require a GitHub token on the shop laptop, which is not recommended.
2. In `package.json` → `build.publish`, set `owner` to your GitHub user or organisation and `repo` to the repository that holds the releases.
3. Create a GitHub **personal access token** with permission to write releases (classic token with `repo` scope, or a fine-grained token with *Contents: Read and write* on that repository).

## Publishing a fix

```powershell
# 1. Make the fix, then run the tests
npm test

# 2. Increase the version (patch = bug fix, minor = new feature)
npm version patch          # 1.0.0 -> 1.0.1, creates a git commit and tag

# 3. Build and upload the installer
$env:GH_TOKEN = "<your token>"
npm run release
```

`npm run release` builds `release/SriyaMotorsPOS-Setup-1.0.1.exe` and `latest.yml`, and uploads them to a **draft** release for tag `v1.0.1`.

4. On GitHub, open **Releases**, check the draft, add release notes, and click **Publish release**. Shop laptops pick it up from that moment.

> The version in `package.json` must be higher than the installed version, otherwise the update is ignored.

## Database changes in an update

Add a new migration file (`server/db/migrations/002_....sql`). Never change released migrations. See [DATABASE.md](DATABASE.md#migrations).

## Rolling back

electron-updater only moves forward. To undo a bad release, publish a new version (for example `1.0.2`) containing the previous code. If a migration damaged data, restore the automatic `pre-update` backup from **Settings → Backup**.

## Code signing (optional)

The installer is not signed, so Windows SmartScreen warns on the first manual install. Updates still work. If you buy a code-signing certificate later, add it to the `build.win` section of `package.json` (see the electron-builder documentation) and the warning disappears.
