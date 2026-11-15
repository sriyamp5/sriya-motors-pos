# Troubleshooting

| Problem | What to do |
| --- | --- |
| **"Starting the system" does not finish** | MySQL is not running. Press `Win + R`, type `services.msc`, find **MySQL84** (or similar) and click **Start**. Set its startup type to **Automatic**. The POS connects by itself. |
| **Database setup screen appears after it worked before** | The MySQL password was changed or MySQL was reinstalled. Enter the correct details. Your data is still in MySQL. |
| **Scanner does nothing** | Open Notepad and scan: if no text appears, check the USB cable or try another port. If text appears without a new line, configure the scanner to send *Enter* (CR) after the code (see its manual). Meanwhile, search items by name. |
| **Scanned item "not found"** | The barcode is not saved on any item. Admins are offered the new-item form with the barcode filled in. Otherwise edit the item and scan into its Barcode box. |
| **Receipt does not print** | The sale is saved; reprint from Sales history. Check the printer is on and has paper, then **Settings → Printer → Print a test receipt**. Make sure the right printer is selected. |
| **Receipt is too wide or cut off** | Set the paper size to 80 mm roll in the printer driver (Windows → Printers → Printing preferences). |
| **"Not enough stock"** | The stock in the system is lower than the bill. An admin should receive the stock or correct it with a stock adjustment. |
| **"Price is below the minimum allowed"** | A cashier tried to sell below the buying price. An admin can make the sale, or allow it in **Settings → Shop**. |
| **Account locked** | Wait 5 minutes, or ask an admin to reset the password. |
| **Backup folder warning** | The pen drive is not connected. Plug it in; until then backups go to the default folder. |
| **Update not appearing** | The laptop must be online. Check **Settings → Updates**. The published version must be higher than the installed one, and the GitHub release must be published (not a draft). |
| **Screen shows "This screen had a problem"** | Click **Reload**. No data is lost. Send the log file (see below) to support if it happens again. |

## Log files

- Server log: `%APPDATA%\Sriya Motors POS\logs\server-YYYY-MM-DD.log`
- Desktop log: `%APPDATA%\Sriya Motors POS\logs\main.log`

**Settings → About → Open data folder** opens the folder.
