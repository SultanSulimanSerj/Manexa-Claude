#!/usr/bin/env bash
#
# Одноразовая настройка DNS и шлюза на сервере manexa-linux.
# Запускать НА СЕРВЕРЕ с root-правами:
#   sudo bash scripts/fix-server-dns.sh
#
# Проблема: enp1s0 без шлюза и DNS → npm install не может достучаться до registry.npmjs.org

set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash $0"
  exit 1
fi

GATEWAY="${MANEXA_GATEWAY:-192.168.100.1}"
DNS_SERVERS="${MANEXA_DNS:-192.168.100.1 8.8.8.8 1.1.1.1}"

CONN=$(nmcli -t -f NAME,DEVICE con show --active | awk -F: '$2=="enp1s0"{print $1; exit}')
if [[ -z "$CONN" ]]; then
  echo "Не найдено активное подключение для enp1s0"
  exit 1
fi

echo "==> Подключение: $CONN"
echo "==> Шлюз: $GATEWAY"
echo "==> DNS: $DNS_SERVERS"

nmcli con mod "$CONN" ipv4.method manual
nmcli con mod "$CONN" ipv4.gateway "$GATEWAY"
nmcli con mod "$CONN" ipv4.dns "$DNS_SERVERS"
nmcli con mod "$CONN" ipv4.ignore-auto-dns yes
nmcli con up "$CONN"

mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/manexa-dns.conf <<EOF
[Resolve]
DNS=$DNS_SERVERS
FallbackDNS=8.8.4.4 1.0.0.1
EOF

systemctl restart systemd-resolved

sleep 2
echo "==> Проверка"
resolvectl status enp1s0 | head -12 || true
if getent hosts registry.npmjs.org >/dev/null; then
  echo "OK: registry.npmjs.org резолвится"
else
  echo "WARN: registry.npmjs.org всё ещё не резолвится — проверьте доступ в интернет с роутера $GATEWAY"
  exit 1
fi

if curl -s --connect-timeout 5 -o /dev/null -w '' https://registry.npmjs.org/; then
  echo "OK: registry.npmjs.org доступен по HTTPS"
else
  echo "WARN: DNS работает, но HTTPS до registry.npmjs.org недоступен (нет NAT/файрвол?)"
fi

echo "==> Готово"
