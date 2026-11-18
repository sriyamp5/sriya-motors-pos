# User guide

For cashiers and admins at Sriya Motors.

## Signing in

Enter your user name and password. The first time, you are asked to choose your own password. If you forget it, ask an admin to reset it.

After 5 wrong passwords the account is locked for 5 minutes.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| **F1** | New sale (from any screen) |
| **F2** | Jump to the search / scan box |
| **F9** | Charge (open payment) |
| **Enter** | Confirm payment / start next sale |
| **Esc** | Close a window |
| **F11** | Full screen |

## Making a sale

1. Click **New sale** (or press **F1**).
2. **Scan** each part with the barcode scanner. Scanning the same part again increases the quantity.
   - No barcode? Type the name, part number, brand or vehicle (for example "axio") in the search box and choose the item. You can also type the item code (SM00012) or part number and press Enter.
3. Change the **quantity**, **price** or **discount** on a line if needed.
   - A changed price shows **Price changed** with the system price crossed out. This is allowed and is recorded for the owner.
   - You cannot sell below the minimum price. If you see that message, ask an admin.
4. Optional: add a **bill discount** on the right.
5. Press **Charge** (**F9**). Check the bill with the customer.
6. Choose the payment:
   - **Cash**: type the cash received (or click **Exact** or a note amount). The change is shown in large figures.
   - **Card**: optionally enter the last 4 digits or approval code.
   - **Credit**: choose an existing customer or enter a name and phone number. The amount is added to their balance.
7. Press **Confirm** (or Enter). The receipt prints and stock is reduced.
8. Press **Enter** for the next customer.

The bill on screen is saved automatically. If the computer restarts in the middle of a bill, it is still there when you come back.

## Reprinting a receipt

**Sales history** → click the invoice → **Reprint**. Reprints are marked "REPRINT".

## Returns

1. **Returns** → type the invoice number from the receipt (for example `INV-000123`, or just `123`) → **Find invoice**.
2. Click **Return items**.
3. Enter the quantity for each returned part. Untick **Back to stock** if the part is damaged.
4. Choose the refund method and reason, then **Confirm return**.

The refund is calculated automatically, including any discounts on the original bill.

## Customers and credit

**Customers** lists customers and their balance due. Click the book icon to see the account and **Receive payment**.

## Admin tasks

| Task | Where |
| --- | --- |
| Add or edit items, set buying and selling prices, markup | Items → Add item / click an item |
| Record a delivery from a supplier | Receive stock → Receive stock |
| Correct stock after counting or damage | Stock adjustments → New adjustment |
| See an item's stock history | Items → clock icon |
| Sales, profit, price changes, staff, stock value | Reports |
| What to order, and from which supplier | Reports → Reorder list |
| Items that are not selling | Reports → Not selling |
| Count cash at closing time | Day end |
| Add cashiers or admins, reset passwords, deactivate staff | Users |
| Who did what | Activity log |
| Shop details, printer, backups, updates | Settings |

### Markup

In the item form, enter the buying price, type a markup % (for example 50) and click **Apply**. Rs. 1,000 at 50% becomes Rs. 1,500. When receiving stock you can also enter a new selling price for each line.

### Low stock

Each item has a **Low stock alert at** level. The red number next to **Items** in the menu and the **Needs restocking** list on the dashboard show items at or below that level. Use the stock filter on the Items screen to see them all.

**Reports → Reorder list** turns this into an order list. It groups the items by the supplier they were last bought from and suggests an order quantity: enough to reach twice the low stock level, or the last 30 days of sales if that is more. It also shows the estimated cost at the last buying price. Use **Export to Excel (CSV)** to send it to a supplier.

### Items that are not selling

**Reports → Not selling** lists items in stock that have had no sale in the last 30, 60, 90, 180 or 365 days. The items holding the most money come first. It shows the rack, the units in stock, the money held at buying price and the date of the last sale. Items added during the period are left out until the period has passed. Use it to decide what to discount, return to the supplier or stop ordering.

### Your stock at a glance

| Question | Where to look |
| --- | --- |
| What items do we have, and how many of each? | Items (stock column, filter by category or brand) |
| Where is each item kept? | Items → Rack column |
| What does each item cost? | Items → buying price (admins only) |
| How much profit does each item make? | Reports → Profit by item (choose the dates) |
| What needs to be ordered? | Reports → Reorder list |
| What is not selling? | Reports → Not selling |
| How much money is held in stock? | Reports → Stock value |

## Updates

When an update has been downloaded, a green bar appears at the top: click **Restart and update** at a quiet moment (it takes about a minute), or simply close the POS at the end of the day and the update installs by itself.
