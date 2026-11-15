# Installing on the shop laptop

Allow about 30 minutes. An internet connection is needed only to download the installers.

## 1. Hardware

| Device | Connection | Notes |
| --- | --- | --- |
| Laptop (8 GB RAM, SSD, Windows 10/11) | | |
| USB barcode scanner | USB | Works like a keyboard. No driver or setting is needed. Scanners send Enter after the code by default; keep that setting. |
| 80 mm thermal receipt printer | USB | Install the manufacturer's Windows driver and set the paper to 80 mm (roll). |
| UPS | | Recommended to avoid losing work in a power cut. |
| Pen drive / external disk | USB | For a second copy of the daily backups. |

## 2. Install MySQL Server

1. Download **MySQL Installer for Windows** (Community, free) from <https://dev.mysql.com/downloads/installer/>.
2. Choose **Server only** and install MySQL Server 8.4 (LTS).
3. Keep the defaults: *Development Computer*, port **3306**, *Strong password encryption*.
4. Set a **root password** and write it down somewhere safe. The POS needs it once during setup.
5. Keep **Configure MySQL Server as a Windows Service** and **Start the MySQL Server at System Startup** ticked.
6. Finish the installer.

## 3. Install the printer

1. Install the printer driver from the manufacturer.
2. In Windows **Printers & scanners**, print a test page.
3. Optional: set it as the default printer.

## 4. Install Sriya Motors POS

1. Run `SriyaMotorsPOS-Setup-x.y.z.exe`.
   - Windows SmartScreen may say *Windows protected your PC* because the installer is not code-signed. Click **More info → Run anyway**.
2. Accept the defaults. A **Sriya Motors POS** icon is created on the desktop.

## 5. First start

1. Open **Sriya Motors POS**.
2. The **Database setup** screen appears. Enter:
   - Host `127.0.0.1`, port `3306`
   - User `root` and the password from step 2
   - Database name `sriya_pos` (created automatically)
3. Click **Connect**. The system creates the tables and the default admin account.
4. Sign in with **admin / admin123** and choose a new password. Keep it safe.

## 6. Set up the shop

As admin:

1. **Settings → Shop**: shop name, address, phone, receipt footer.
2. **Settings → Printer**: select the receipt printer, turn on **Print without asking**, then click **Print a test receipt**.
3. **Settings → Backup**: insert the pen drive, click **Browse**, choose a folder on it, and click **Save settings**. Then click **Back up now** to test.
4. **Users → Add user**: create an account for each cashier (and other admins). Each person chooses their own password the first time they sign in.
5. **Catalogue**: check the categories and vehicle makes, and add brands and models as needed.
6. **Inventory → Suppliers**: add suppliers.
7. **Items → Add item**: add stock. Scan the barcode into the barcode box. Opening stock is entered when the item is created.

## 7. Daily use

- Switch on the laptop and open the POS. If MySQL is still starting, the POS waits by itself.
- Close the POS at the end of the day. Use **Day end** to count the cash first.

## Moving to another laptop

1. On the old laptop: **Settings → Backup → Back up now**, and copy the newest `.sql.gz` file to a pen drive.
2. On the new laptop: follow steps 2–5.
3. Sign in, go to **Settings → Backup → Restore from file…**, choose the copied file and type `RESTORE`.
4. Sign in again with the accounts from the old laptop.
