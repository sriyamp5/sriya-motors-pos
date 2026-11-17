# Hosting the POS online (Hetzner + Cloudflare)

This guide puts the Sriya Motors POS on the internet at an address such as `https://pos.sriyamotors.com`. The shop and the owner can then open it in a browser from any computer.

- **Server:** Hetzner Cloud. It is low cost and reliable, and a small server is enough for 3–4 users.
- **Domain, DNS and HTTPS:** Cloudflare. Domains are sold at cost price, DNS is free, and it gives a free 15-year certificate for the server.

The desktop app is **not affected**. The same code still builds the Windows installer, and that installer still works without internet ([INSTALLATION.md](INSTALLATION.md)). The online version is a second way to run the same system.

Plan for about **1.5–2 hours** the first time. Do the parts in order.

---

## Contents

1. [Before you start: online vs desktop (read this)](#1-before-you-start-online-vs-desktop)
2. [What you need](#2-what-you-need)
3. [Cloudflare: account and domain](#3-cloudflare-account-and-domain)
4. [Hetzner: create the server](#4-hetzner-create-the-server)
5. [First login and basic security](#5-first-login-and-basic-security)
6. [Install Node.js, MySQL and Caddy](#6-install-nodejs-mysql-and-caddy)
7. [Create the database](#7-create-the-database)
8. [Install the POS application](#8-install-the-pos-application)
9. [Run it as a service](#9-run-it-as-a-service)
10. [Connect the domain and turn on HTTPS](#10-connect-the-domain-and-turn-on-https)
11. [First sign-in (do this immediately)](#11-first-sign-in-do-this-immediately)
12. [Move existing data from the shop laptop (optional)](#12-move-existing-data-from-the-shop-laptop-optional)
13. [Set up the shop computers](#13-set-up-the-shop-computers)
14. [Updating the online system](#14-updating-the-online-system)
15. [Backups](#15-backups)
16. [Routine maintenance](#16-routine-maintenance)
17. [Troubleshooting](#17-troubleshooting)

Throughout this guide, replace:

| Placeholder | Replace with |
|---|---|
| `sriyamotors.com` | the domain you register |
| `pos.sriyamotors.com` | the address the POS will use |
| `SERVER_IP` | the IPv4 address Hetzner gives your server |
| `posadmin` | the login name you choose for yourself on the server |

---

## 1. Before you start: online vs desktop

The online version needs internet. Read this section before deciding to use it.

| | Desktop app (shop laptop) | Online version |
|---|---|---|
| Works with no internet | **Yes** | **No** |
| Open from another computer or a phone | No (only on the shop network) | Yes, from anywhere |
| Data stored | On the shop laptop | On the server in the data centre |
| If the laptop is stolen or breaks | Data is lost unless backed up | Data is safe on the server |
| Monthly cost | None | Server + domain |

### What happens in the online version when the internet goes down

The system has been built to handle this safely:

- **A red banner appears at the top of every screen:** *"No connection to the server. Sales cannot be saved until the internet is back…"*
- **The current bill is not lost.** Items already scanned stay on the New sale screen, even if the page is refreshed or the browser is closed.
- **Pressing Confirm while offline shows a clear message.** The bill is not saved, and the cashier is told to press Confirm again when the connection returns.
- **A bill is never saved twice.** Sometimes the internet drops at the exact moment the sale is saved, so the server saved it but the till never got the reply. Pressing Confirm again then returns the same invoice number. It does not create a second sale or reduce stock twice.
- **The banner disappears by itself** when the connection is back.

What the shop **cannot** do while offline: save new sales, look up stock, print new receipts or run reports.

### Recommendations for the shop

1. Keep a **backup internet connection**, such as a 4G router or a phone hotspot, so the cashier can switch over in a minute.
2. Keep a **paper bill book** for long outages. Enter those bills into the system once the internet is back.
3. Do **not** run the desktop app and the online version for the same shop at the same time. They use separate databases, so the stock would split into two different numbers.

---

## 2. What you need

- A computer with internet. Windows 10 or 11 is fine; all commands below are typed in **PowerShell** on Windows or in the server terminal.
- A **debit or credit card** for Hetzner and Cloudflare. Both bill in USD or EUR.
- Access to the GitHub repository `sriyamp5/sriya-motors-pos`.
- A phone for two-factor authentication. Turn it on for both accounts; this system holds the shop's money records.

Approximate monthly cost:

| Item | Approx. |
|---|---|
| Hetzner server (2 vCPU, 4 GB RAM, 40 GB disk) + IPv4 | ≈ €4–5 / month |
| Hetzner automatic server backups (optional, recommended) | +20% of server price |
| Domain (`.com`) at Cloudflare | ≈ $10–11 / **year** |
| Cloudflare DNS, proxy and certificate | Free |

---

## 3. Cloudflare: account and domain

### 3.1 Create the account

1. Go to **https://dash.cloudflare.com/sign-up** and create an account with the shop's (or your) email address.
2. Verify the email address.
3. Open **My Profile → Authentication** (top right) and turn on **Two-Factor Authentication**.

### 3.2 Register the domain

1. In the left menu open **Domain Registration → Register Domains**.
2. Search for the name you want, e.g. `sriyamotors`.
3. Pick a `.com` (or `.net`, `.lk` is **not** sold by Cloudflare) and click **Purchase**.
4. Fill in the registrant contact details. WHOIS privacy is free and switched on automatically.
5. Pay. Turn on **Auto-renew** so the domain never expires.

The domain now appears under **Websites** (Account home). Its DNS is already managed by Cloudflare. Nothing else is needed yet.

> **Already have a domain somewhere else (e.g. a `.lk` domain)?**
> Click **Add a domain** in Cloudflare, enter the domain, choose the **Free** plan, and Cloudflare shows two nameservers (like `xxx.ns.cloudflare.com`). Log in to the company where the domain was bought and replace its nameservers with these two. It becomes active within a few hours. Everything else in this guide is the same.

---

## 4. Hetzner: create the server

### 4.1 Create the account

1. Go to **https://accounts.hetzner.com/signUp** and register.
2. Hetzner may ask for identity verification (photo ID or a small card payment). This is normal and usually takes minutes to a few hours.
3. Turn on two-factor authentication under **Account → Security**.
4. Open **https://console.hetzner.cloud** and create a new **Project** named `Sriya Motors POS`.

### 4.2 Create an SSH key on your Windows computer

The SSH key is how you log in to the server securely (no password).

Open **PowerShell** and run:

```powershell
ssh-keygen -t ed25519 -C "sriya-pos-admin"
```

Press **Enter** to accept the default file location, then type a passphrase you will remember. Show the public key:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

Copy the whole line that starts with `ssh-ed25519`.

> Keep the file `id_ed25519` (without `.pub`) private and backed up. Anyone with it, and its passphrase, can log in to the server.

### 4.3 Create a firewall

In the project, open **Firewalls → Create Firewall**, name it `sriya-pos-fw` and set these **inbound** rules (delete any others):

| Protocol | Port | Source |
|---|---|---|
| TCP | 22 | Any IPv4, Any IPv6 |
| TCP | 80 | Any IPv4, Any IPv6 |
| TCP | 443 | Any IPv4, Any IPv6 |

Leave outbound rules empty (all outgoing traffic allowed). Click **Create Firewall**.

### 4.4 Create the server

In the project, click **Add Server** (or **Create Resource → Servers**) and choose:

| Setting | Choose |
|---|---|
| Location | **Helsinki**, **Falkenstein** or **Nuremberg** (cheapest). **Singapore** is closer to Sri Lanka, so pages respond a little faster, but it costs more. |
| Image | **Ubuntu 24.04** |
| Type | **Shared vCPU → x86**, the smallest plan with **2 vCPU and 4 GB RAM** (for example **CX23**; the name may differ slightly) |
| Networking | **Public IPv4** ✔ and **Public IPv6** ✔ |
| SSH keys | **Add SSH key** → paste the line from step 4.2, name it `my-laptop` |
| Volumes | none |
| Firewalls | select `sriya-pos-fw` |
| Backups | ✔ **Enable** (recommended, about 20% extra) |
| Name | `sriya-pos` |

Click **Create & Buy now**. After about 30 seconds the server is running. Copy its **IPv4 address**; this is your `SERVER_IP`.

---

## 5. First login and basic security

### 5.1 Log in as root

In PowerShell on your computer:

```powershell
ssh root@SERVER_IP
```

Type `yes` when asked about the fingerprint, then your key passphrase. You are now on the server; the prompt looks like `root@sriya-pos:~#`.

### 5.2 Update the system and set the time zone

Bills, reports and day close must use **Sri Lankan time**, so set it before installing anything else:

```bash
apt update && apt -y upgrade
timedatectl set-timezone Asia/Colombo
timedatectl          # "Time zone: Asia/Colombo (+0530)" should be shown
```

### 5.3 Create your own admin login

Logging in as `root` all the time is risky. Create a personal admin user (replace `posadmin` with a name you like):

```bash
adduser posadmin                 # choose a strong password; it is used for "sudo"
usermod -aG sudo posadmin
rsync --archive --chown=posadmin:posadmin ~/.ssh /home/posadmin
```

**Keep this window open.** Open a **second** PowerShell window and check that the new login works:

```powershell
ssh posadmin@SERVER_IP
sudo whoami                      # must print "root" after you type the password
```

### 5.4 Turn off password and root logins

Only do this after step 5.3 works. In the `posadmin` window:

```bash
sudo nano /etc/ssh/sshd_config.d/99-hardening.conf
```

Paste these two lines, then save with **Ctrl+O, Enter** and exit with **Ctrl+X**:

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

From now on, always log in with `ssh posadmin@SERVER_IP`.

### 5.5 Local firewall and protection against password guessing

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo apt install -y fail2ban unattended-upgrades
```

`unattended-upgrades` installs Ubuntu security updates automatically every day.

---

## 6. Install Node.js, MySQL and Caddy

All commands from here on are run as `posadmin` on the server.

### 6.1 Node.js (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git
node -v          # v24.x
```

### 6.2 MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo systemctl restart mysql      # so MySQL picks up the Asia/Colombo time zone
```

MySQL listens only on the server itself (127.0.0.1), so it cannot be reached from the internet.

### 6.3 Caddy (web server that provides HTTPS)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

---

## 7. Create the database

First create a long random password for the database user and **copy it somewhere safe** (a password manager):

```bash
openssl rand -base64 24
```

Open MySQL:

```bash
sudo mysql
```

Paste the following, replacing `PASTE_DB_PASSWORD` with the password you just created (keep the quotes):

```sql
CREATE DATABASE sriya_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sriya_pos'@'localhost' IDENTIFIED BY 'PASTE_DB_PASSWORD';
CREATE USER 'sriya_pos'@'127.0.0.1' IDENTIFIED BY 'PASTE_DB_PASSWORD';
GRANT ALL PRIVILEGES ON sriya_pos.* TO 'sriya_pos'@'localhost';
GRANT ALL PRIVILEGES ON sriya_pos.* TO 'sriya_pos'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

The POS creates all tables itself on first start.

---

## 8. Install the POS application

### 8.1 Create a separate user for the application

The application runs as its own user, `sriya`, which cannot log in. If something were ever wrong in the app, it could not touch the rest of the server.

```bash
sudo useradd --system --create-home --home-dir /home/sriya --shell /usr/sbin/nologin sriya
sudo mkdir -p /opt/sriya-pos /var/lib/sriya-pos/backups
sudo chown -R sriya:sriya /opt/sriya-pos /var/lib/sriya-pos
```

### 8.2 Give the server read-only access to the GitHub repository

If the repository is **public**, skip to 8.3 and use the `https://github.com/...` address.

For a **private** repository, use a *deploy key* that can only read this one repository:

```bash
sudo -u sriya mkdir -p -m 700 /home/sriya/.ssh
sudo -u sriya ssh-keygen -t ed25519 -N "" -f /home/sriya/.ssh/id_ed25519 -C "sriya-pos-server"
sudo cat /home/sriya/.ssh/id_ed25519.pub
```

Copy the printed line. On GitHub open the repository → **Settings → Deploy keys → Add deploy key**. Enter the title `Hetzner server`, paste the key, leave **Allow write access unticked**, and click **Add key**.

### 8.3 Download the code

```bash
sudo -u sriya git clone git@github.com:sriyamp5/sriya-motors-pos.git /opt/sriya-pos
```

Type `yes` when asked to trust github.com. For a public repository use `https://github.com/sriyamp5/sriya-motors-pos.git` instead.

### 8.4 Create the settings file

```bash
sudo -u sriya cp /opt/sriya-pos/deploy/env.production.example /opt/sriya-pos/.env
openssl rand -hex 48              # copy the output: this is the JWT_SECRET
sudo -u sriya nano /opt/sriya-pos/.env
```

Change these two lines and save (Ctrl+O, Enter, Ctrl+X):

- `DB_PASSWORD=`: the database password from step 7
- `JWT_SECRET=`: the long value from `openssl rand -hex 48`

Then make the file readable only by the application:

```bash
sudo chmod 600 /opt/sriya-pos/.env
```

### 8.5 Install packages and build the user interface

```bash
cd /opt/sriya-pos
sudo -u sriya -H env ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund
sudo -u sriya -H npm run build:client
```

`ELECTRON_SKIP_BINARY_DOWNLOAD=1` skips downloading Electron, which is only needed for the desktop app.

---

## 9. Run it as a service

The service starts the POS automatically when the server boots and restarts it if it ever stops.

```bash
sudo cp /opt/sriya-pos/deploy/sriya-pos.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sriya-pos
```

Check that it is working (wait about 10 seconds after starting):

```bash
sudo systemctl status sriya-pos --no-pager     # "active (running)"
curl http://127.0.0.1:4600/api/system/status
```

The second command must print something containing `"mode":"web"` and `"status":"ready"`. If not, see the log:

```bash
sudo journalctl -u sriya-pos -n 50 --no-pager
```

---

## 10. Connect the domain and turn on HTTPS

The connection is encrypted in two places:

```
Shop browser ──HTTPS (Cloudflare certificate)──► Cloudflare ──HTTPS (Origin certificate)──► Caddy on the server ──► POS (127.0.0.1:4600)
```

### 10.1 Point the address at the server (Cloudflare DNS)

In Cloudflare open your domain → **DNS → Records → Add record**:

| Type | Name | IPv4 address | Proxy status | TTL |
|---|---|---|---|---|
| A | `pos` | `SERVER_IP` | **Proxied** (orange cloud) | Auto |

Click **Save**. The orange cloud hides the server's real address and protects it against attacks.

### 10.2 Set the SSL mode

Open **SSL/TLS → Overview** → **Configure**. Choose **Full (strict)** and save.

### 10.3 Create the Origin Certificate (free, valid 15 years)

1. Open **SSL/TLS → Origin Server → Create Certificate**.
2. Keep **"Generate private key and CSR with Cloudflare"**, key type **RSA (2048)**.
3. Hostnames: keep `*.sriyamotors.com` and `sriyamotors.com`.
4. Certificate validity: **15 years**. Click **Create**.
5. Two boxes are shown, **Origin Certificate** and **Private Key**. **Leave this page open.** The private key is shown only once.

On the server create the two files:

```bash
sudo mkdir -p /etc/caddy/certs
sudo nano /etc/caddy/certs/origin.pem
```

Paste the **Origin Certificate** (including the `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines), then save and exit.

```bash
sudo nano /etc/caddy/certs/origin.key
```

Paste the **Private Key** (including the `BEGIN` and `END` lines), then save and exit. Then protect the files:

```bash
sudo chown -R root:caddy /etc/caddy/certs
sudo chmod 640 /etc/caddy/certs/origin.key
sudo chmod 644 /etc/caddy/certs/origin.pem
```

### 10.4 Configure Caddy

```bash
sudo cp /opt/sriya-pos/deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/pos.example.com/pos.sriyamotors.com/' /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

`caddy validate` must end with **"Valid configuration"**.

### 10.5 Recommended Cloudflare settings

In Cloudflare, for the domain:

- **SSL/TLS → Edge Certificates**:
  - **Always Use HTTPS**: On
  - **Minimum TLS Version**: TLS 1.2
  - **Automatic HTTPS Rewrites**: On
- **Security → Settings**: Security level **Medium**. Keep **Bot Fight Mode** **Off**, because it can block the POS's own requests.
- **Caching → Configuration**: keep the default. The POS controls its own caching (the app files are cached, the data never is).

### 10.6 Test

Open **https://pos.sriyamotors.com** in a browser. The padlock appears and the Sriya Motors sign-in screen loads. A new DNS record can take a few minutes to start working.

### 10.7 (Recommended) Allow web traffic only through Cloudflare

This stops anyone from going around Cloudflare by using the server's IP address directly.

In **Hetzner → Firewalls → sriya-pos-fw**, edit the **80** and **443** rules. Replace "Any IPv4 / Any IPv6" with the Cloudflare address ranges listed at **https://www.cloudflare.com/ips/** (paste each IPv4 and IPv6 range). Keep port **22** as it is. Check that the site still opens after saving.

---

## 11. First sign-in (do this immediately)

The system is now on the internet with the default login, so change it right away:

1. Open `https://pos.sriyamotors.com`.
2. Sign in with **admin / admin123**.
3. The system forces a new password. Use a strong one (12+ characters, not used anywhere else).
4. Open **Settings → Shop** and check the shop name, address and phone numbers on the receipt.
5. Open **Users** and create a login for each cashier. Never share the admin login.

After 5 wrong passwords an account is locked for 5 minutes. Too many attempts from one internet address are also blocked for a while.

---

## 12. Move existing data from the shop laptop (optional)

Do this if the shop has already been using the desktop app and the data should move online.

1. On the shop laptop open **Settings → Backup → Back up now**, then **Open folder**. Note the newest file, e.g. `sriya-pos-20261117-180000-manual.sql.gz`.
2. Copy it to a computer that has your SSH key, then in PowerShell upload it:

   ```powershell
   scp "C:\path\to\sriya-pos-20261117-180000-manual.sql.gz" posadmin@SERVER_IP:/tmp/
   ```

3. On the server, move it into the backup folder:

   ```bash
   sudo mv /tmp/sriya-pos-*.sql.gz /var/lib/sriya-pos/backups/
   sudo chown sriya:sriya /var/lib/sriya-pos/backups/*.sql.gz
   ```

4. In the online system open **Settings → Backup**. The file appears in **Available backups**. Click **Restore**, type `RESTORE` and confirm.
5. Sign in again. The users and passwords are now the ones from the laptop.
6. Stop using the desktop app for sales from this moment (see section 1).

---

## 13. Set up the shop computers

### 13.1 Install as an app (desktop icon)

In **Google Chrome** or **Microsoft Edge** open `https://pos.sriyamotors.com`, then:

- **Chrome:** menu **⋮ → Cast, save and share → Install page as app…** → **Install**
- **Edge:** menu **… → Apps → Install this site as an app** → **Install**

A **Sriya Motors POS** icon appears on the desktop and in the Start menu. It opens in its own window like the desktop program.

### 13.2 Receipt printer and silent printing

1. Install the receipt printer's Windows driver and make it the **default printer**: Windows **Settings → Bluetooth & devices → Printers & scanners** → printer → **Set as default**. If the "Let Windows manage my default printer" option is on, turn it off.
2. For printing **without the print dialog** (like the desktop app), create a special shortcut:
   - Right-click the desktop → **New → Shortcut**.
   - Location (one line, for Chrome):

     ```
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://pos.sriyamotors.com
     ```

     For Edge use `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"` instead.
   - Name it **Sriya Motors POS** and use this shortcut every day.
   - The flag only takes effect when **all** windows of that browser were closed first.
3. In the POS open **Settings → Printer → Print test receipt**.

Without the special shortcut, the normal print dialog appears; choose the receipt printer and press **Print**.

### 13.3 Barcode scanner and cash drawer

- The USB barcode scanner works exactly as in the desktop app. No setup is needed.
- A cash drawer connected to the receipt printer is opened by the printer driver. In the printer's **Printing preferences**, set the cash drawer to open *before/after printing* (the option name depends on the printer brand).

### 13.4 The owner's phone or home computer

The owner can sign in from anywhere at `https://pos.sriyamotors.com` with their admin login to see the dashboard, reports and stock.

---

## 14. Updating the online system

When a new version is ready on GitHub (pushed to `main`):

```powershell
ssh posadmin@SERVER_IP
```

```bash
sudo bash /opt/sriya-pos/deploy/update.sh
```

The script downloads the latest code, installs packages, rebuilds the interface and restarts the service. It then checks that the system answers. Database changes are applied automatically on start, **after an automatic safety backup**. The whole update takes about 1–2 minutes; do it outside shop hours.

Users press **F5** (reload) afterwards to load the new version. **Settings → Updates** shows the running version.

To install a specific version (e.g. a Git tag) instead of the latest: `sudo bash /opt/sriya-pos/deploy/update.sh v1.0.2`.

> The desktop app is still released with `npm run release` ([RELEASES_AND_UPDATES.md](RELEASES_AND_UPDATES.md)). The two are independent.

### Rolling back a bad update

```bash
cd /opt/sriya-pos
sudo -u sriya git log --oneline -5          # find the previous good commit
sudo bash deploy/update.sh <commit-or-tag>
```

If the update changed the database, restore the `pre-update` backup from **Settings → Backup** afterwards.

---

## 15. Backups

There are three layers. Keep all of them.

| Backup | Where | How often | Kept |
|---|---|---|---|
| POS database backups | `/var/lib/sriya-pos/backups` on the server | Daily (automatic), before every update and restore, and on **Back up now** | Last 30 (set in **Settings → Backup**) |
| Hetzner server backups | Hetzner (whole server) | Daily | Last 7 |
| Copy outside the server | Shop or office computer, pen drive | **Weekly**: **Settings → Backup → Download** | As many as you like |

- **Restore a POS backup:** **Settings → Backup → Restore** next to the file. A backup of the current data is taken first, so a wrong restore can be undone.
- **Whole server lost or broken:** Hetzner console → server → **Backups** → **Restore**, or create a new server from a backup.

---

## 16. Routine maintenance

| When | What |
|---|---|
| Weekly | Download a backup (section 15). |
| Monthly | `sudo apt update && sudo apt -y upgrade`, then `sudo reboot` outside shop hours. The POS starts by itself after the reboot. |
| Monthly | Check disk space: `df -h /` (stay below 80%). |
| Yearly | Check the domain auto-renew and the card in Cloudflare. |

Useful commands:

```bash
sudo systemctl status sriya-pos             # is it running?
sudo systemctl restart sriya-pos            # restart the POS
sudo journalctl -u sriya-pos -f             # live log (Ctrl+C to stop)
ls /var/lib/sriya-pos/logs                  # application log files
sudo systemctl status caddy mysql           # web server and database
```

---

## 17. Troubleshooting

| What you see | Likely cause | Fix |
|---|---|---|
| Cloudflare page **"Error 521: Web server is down"** | Caddy is stopped, or the firewall blocks 443 | `sudo systemctl restart caddy`; check the firewall rules (sections 4.3, 10.7) |
| **"Error 502 Bad Gateway"** | The POS service is not running | `sudo systemctl restart sriya-pos`, then check `sudo journalctl -u sriya-pos -n 50` |
| **"Error 526: Invalid SSL certificate"** | Origin certificate missing or wrong, or the hostname is not covered | Repeat section 10.3; the certificate must include `*.sriyamotors.com` |
| **"Too many redirects"** | SSL mode is Flexible | Set **SSL/TLS → Full (strict)** (section 10.2) |
| The page stays on **"Starting the system"** | MySQL is stopped or the `.env` database settings are wrong | `sudo systemctl status mysql`; check `DB_PASSWORD` in `/opt/sriya-pos/.env`; `sudo journalctl -u sriya-pos -n 50` |
| Service fails with **"Missing required settings"** | A value is empty in `.env` | Fill it in (section 8.4), then `sudo systemctl restart sriya-pos` |
| Bills or day close show the **wrong time or date** | Time zone not set | `sudo timedatectl set-timezone Asia/Colombo`, `sudo systemctl restart mysql sriya-pos` |
| Red **"No connection to the server"** banner in the shop | The shop's internet is down | Switch to the backup connection; the bill on screen is kept (section 1) |
| Receipt print dialog appears every time | Not opened with the `--kiosk-printing` shortcut, or the browser was already open | Close all browser windows and open the special shortcut (section 13.2) |
| **"Too many sign-in attempts"** | Many wrong logins from the shop's address | Wait 15 minutes |
| `update.sh` fails at `git pull` | Files were changed by hand on the server | `cd /opt/sriya-pos && sudo -u sriya git status`; undo the local change with `sudo -u sriya git checkout -- <file>` |

For general application problems see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
