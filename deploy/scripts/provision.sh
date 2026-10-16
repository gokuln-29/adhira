#!/usr/bin/env bash
# One-time Ubuntu 22.04/24.04 provisioning. Run as root on a fresh Hostinger VPS:
#   sudo bash provision.sh
# KEEP YOUR CURRENT SSH SESSION OPEN and test a second login before closing it.
# Password SSH login is only disabled when DISABLE_SSH_PASSWORDS=1 AND an
# authorized_keys file exists for the deploy user.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
DEBIAN_FRONTEND=noninteractive apt-get -y install \
  nginx certbot mysql-server ufw fail2ban unattended-upgrades curl git ca-certificates \
  restic rclone logrotate

# Node.js LTS (pin the major; keep in sync with the version you build/test with).
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get -y install nodejs
fi

timedatectl set-timezone Asia/Dubai   # logs/cron in local time; the DB stores UTC.

# Service account (no login) and deploy user.
id adhira >/dev/null 2>&1 || useradd --system --home /srv/adhira --shell /usr/sbin/nologin adhira
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG adhira deploy
install -d -o deploy -g adhira -m 0755 /srv/adhira /srv/adhira/releases
install -d -o adhira -g adhira -m 0750 /var/cache/adhira
install -d -o root -g adhira -m 0750 /etc/adhira
install -d -m 0755 /var/www/certbot /var/log/adhira
echo 'deploy ALL=(root) NOPASSWD: /bin/systemctl restart adhira, /bin/systemctl status adhira' > /etc/sudoers.d/adhira
chmod 440 /etc/sudoers.d/adhira

# Firewall: default-deny inbound; 3306 is never opened.
ufw default deny incoming
ufw default allow outgoing
if [ -n "${SSH_ALLOW_FROM:-}" ]; then ufw allow from "$SSH_ALLOW_FROM" to any port 22 proto tcp
else ufw allow OpenSSH; fi
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Automatic security updates (+ reboot window for kernel fixes).
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat > /etc/apt/apt.conf.d/52adhira-unattended <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF

# SSH hardening (drop-in; reload only after validating).
cat > /etc/ssh/sshd_config.d/99-adhira.conf <<'CONF'
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
CONF
if [ "${DISABLE_SSH_PASSWORDS:-0}" = "1" ]; then
  if [ -s /home/deploy/.ssh/authorized_keys ] || [ -s /root/.ssh/authorized_keys ]; then
    echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config.d/99-adhira.conf
  else echo "NOT disabling SSH passwords: no authorized_keys found."; fi
fi
sshd -t && systemctl reload ssh

systemctl enable --now fail2ban unattended-upgrades

# MySQL: loopback only (config copied from the repo), then verify.
install -m 0644 "$(dirname "$0")/../mysql/adhira.cnf" /etc/mysql/mysql.conf.d/adhira.cnf
systemctl restart mysql
if ss -ltn | grep ':3306' | grep -vq '127.0.0.1'; then echo "ERROR: MySQL is listening on a public address"; exit 1; fi

echo "Done. Next: create DB users (deploy/mysql/create-users.sql), write /etc/adhira/env,"
echo "install nginx config + snippet, certbot, systemd units, backup + monitoring (see docs/DEPLOYMENT.md)."
