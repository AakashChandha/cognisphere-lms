#!/usr/bin/env sh
# One-time preparation of a fresh Ubuntu 24.04 Lightsail instance.
# Safe to re-run. Run as root:  sudo scripts/server-setup.sh
#
# What it does:
#   1. Installs Docker Engine + the compose plugin from Docker's apt repo
#   2. Turns on container log rotation (so logs can never fill the disk)
#   3. Adds a 6 GB swapfile (`next build` peaks near 2 GB; this is the
#      headroom that lets it finish on a 2 GB instance)
#   4. Sets the timezone to Asia/Kolkata and enables unattended security
#      updates with an automatic reboot at 04:00 if a kernel update needs it
#   5. Installs the AWS CLI (used by backup.sh to talk to the Lightsail bucket)
#   6. Installs the nightly backup cron job (02:30)

set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

LMS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "==> Base packages"
apt-get update -q
apt-get install -y -q ca-certificates curl git gnupg unzip unattended-upgrades

echo "==> Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Let the login user run docker without sudo (takes effect on next login).
if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
fi

echo "==> Container log rotation"
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl enable docker >/dev/null
systemctl restart docker

# journald defaults to 10% of the disk (about 6 GB here); 200 MB is weeks of logs.
echo "==> System log cap (200 MB)"
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/lms.conf <<'CONF'
[Journal]
SystemMaxUse=200M
CONF
systemctl restart systemd-journald

# Sized for the frontend build, not for runtime: `next build` alone peaks near
# 2 GB, so a 2 GB instance needs real swap to get through a deploy. Steady
# state uses far less. Override on a bigger box with SWAP_GB=2.
SWAP_GB="${SWAP_GB:-6}"
echo "==> Swap (${SWAP_GB} GB)"
want_bytes=$((SWAP_GB * 1024 * 1024 * 1024))
have_bytes=0
[ -f /swapfile ] && have_bytes="$(stat -c %s /swapfile)"
if [ "$have_bytes" -lt "$want_bytes" ]; then
  # Re-runnable: grow an existing, smaller swapfile instead of leaving it.
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Prefer RAM; only spill to swap under real pressure.
sysctl -q -w vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

echo "==> Timezone + unattended security updates"
timedatectl set-timezone Asia/Kolkata
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
cat > /etc/apt/apt.conf.d/52lms-unattended <<'APT'
// Reboot automatically (04:00 IST) when a kernel update requires it.
// Docker restarts every container on boot (restart: unless-stopped).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
APT

echo "==> AWS CLI"
if ! command -v aws >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  arch="$(uname -m)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip" -o "$tmp/awscli.zip"
  unzip -q "$tmp/awscli.zip" -d "$tmp"
  "$tmp/aws/install" >/dev/null
  rm -rf "$tmp"
fi

echo "==> Backup directory + nightly cron"
mkdir -p /var/backups/lms
chmod +x "$LMS_ROOT"/scripts/*.sh
cat > /etc/cron.d/lms-backup <<CRON
# Nightly database dump + upload sync to the Lightsail bucket (see scripts/backup.sh)
SHELL=/bin/sh
PATH=/usr/local/bin:/usr/bin:/bin
30 2 * * * root $LMS_ROOT/scripts/backup.sh >> /var/log/lms-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/lms-backup

echo
echo "Server setup complete."
echo "Next: cp .env.example .env && nano .env   (then)   sudo scripts/deploy.sh"
