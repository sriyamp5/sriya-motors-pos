#!/usr/bin/env bash
# Updates the hosted Sriya Motors POS to the latest code on the main branch,
# or to a given branch, tag or commit.
#
# Run on the server from the admin login:   sudo bash /opt/sriya-pos/deploy/update.sh [main|v1.0.2|<commit>]
#
# The application backs up the database by itself before applying any
# database change, so no manual backup step is needed here.
set -euo pipefail

APP_DIR=/opt/sriya-pos
APP_USER=sriya
BRANCH="${1:-main}"

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo:  sudo bash $APP_DIR/deploy/update.sh" >&2
  exit 1
fi

# Code and packages belong to the application user, never to root.
as_app() { sudo -u "$APP_USER" -H env ELECTRON_SKIP_BINARY_DOWNLOAD=1 "$@"; }

cd "$APP_DIR"

echo "==> Fetching the latest code ($BRANCH)"
as_app git fetch --tags origin
if as_app git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  # A branch: move to its newest commit.
  as_app git checkout "$BRANCH"
  as_app git pull --ff-only origin "$BRANCH"
else
  # A tag or commit, e.g. to install a specific version or roll back.
  as_app git checkout --detach "$BRANCH"
fi

echo "==> Installing packages"
# Electron is only needed for the desktop app; its large download is skipped on the server.
as_app npm ci --no-audit --no-fund

echo "==> Building the user interface"
as_app npm run build:client

echo "==> Restarting the service"
systemctl restart sriya-pos

for _ in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:4600/api/system/status > /dev/null 2>&1; then
    echo "==> Done. Running version $(node -p "require('./package.json').version")"
    exit 0
  fi
  sleep 2
done

echo "!! The service did not answer. Check the log:  sudo journalctl -u sriya-pos -n 50" >&2
exit 1
