#!/usr/bin/env bash
#
# Деплой Manexa на офисный сервер (manexa-linux).
#
# Использование:
#   ./scripts/deploy.sh              # полный деплой: rsync + build на сервере + db push + pm2
#   ./scripts/deploy.sh --sync-next  # fallback: собрать локально и залить .next (если build на сервере падает)
#
# Требования:
#   - SSH-алиас manexa-linux в ~/.ssh/config (ключ, без пароля)
#   - .env уже настроен на сервере (скрипт его не трогает)
#
# DNS на сервере (если npm install падает с EAI_AGAIN):
#   ssh manexa-linux
#   sudo bash ~/manexa/scripts/fix-server-dns.sh

set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="manexa-linux"
REMOTE_DIR="~/manexa"
SYNC_NEXT=false

if [[ "${1:-}" == "--sync-next" ]]; then
  SYNC_NEXT=true
fi

RSYNC_EXCLUDES=(
  --exclude 'node_modules'
  --exclude '.next'
  --exclude '.git'
  --exclude 'tmp'
  --exclude '.tmp'
  --exclude 'backups'
  --exclude 'logs'
  --exclude '.env'
  --exclude '.DS_Store'
)

remote_npm_install() {
  ssh "$REMOTE" "cd ${REMOTE_DIR} && npm install --no-audit --no-fund 2>&1"
}

sync_node_modules_from_local() {
  echo "==> Локальный npm install"
  (cd "$LOCAL_DIR" && npm install --no-audit --no-fund)
  echo "==> Rsync node_modules на сервер (обход проблем DNS на сервере)"
  rsync -az --delete \
    --exclude '.cache' \
    "${LOCAL_DIR}/node_modules/" "${REMOTE}:${REMOTE_DIR}/node_modules/"
}

check_server_dns() {
  ssh "$REMOTE" "getent hosts registry.npmjs.org >/dev/null 2>&1"
}

echo "==> Rsync кода на ${REMOTE}:${REMOTE_DIR}"
rsync -az --delete-after "${RSYNC_EXCLUDES[@]}" \
  --filter='P node_modules' --filter='P .next' --filter='P .env' --filter='P logs' --filter='P backups' \
  "${LOCAL_DIR}/" "${REMOTE}:${REMOTE_DIR}/"

echo "==> Проверка DNS на сервере"
if ! check_server_dns; then
  echo "WARN: на сервере не резолвится registry.npmjs.org"
  echo "      Выполните один раз: ssh ${REMOTE} 'sudo bash ${REMOTE_DIR}/scripts/fix-server-dns.sh'"
  echo "      Сейчас: npm install локально + rsync node_modules"
  sync_node_modules_from_local
else
  echo "==> npm install на сервере"
  if ! remote_npm_install; then
    echo "WARN: npm install на сервере не удался — синхронизируем node_modules с локальной машины"
    sync_node_modules_from_local
  fi
fi

echo "==> prisma generate + db push"
ssh "$REMOTE" "cd ${REMOTE_DIR} && npx prisma generate >/dev/null && npx prisma db push 2>&1 | tail -3"

if [[ "$SYNC_NEXT" == true ]]; then
  echo "==> Локальная сборка"
  (cd "$LOCAL_DIR" && npm run build)
  echo "==> Rsync .next на сервер"
  rsync -az --delete "${LOCAL_DIR}/.next/" "${REMOTE}:${REMOTE_DIR}/.next/"
else
  echo "==> Сборка на сервере"
  if ! ssh "$REMOTE" "cd ${REMOTE_DIR} && NODE_OPTIONS='--max-old-space-size=3072' npm run build 2>&1"; then
    echo "WARN: сборка на сервере не удалась — локальная сборка + rsync .next"
    (cd "$LOCAL_DIR" && npm run build)
    rsync -az --delete "${LOCAL_DIR}/.next/" "${REMOTE}:${REMOTE_DIR}/.next/"
  fi
fi

echo "==> PM2 restart"
ssh "$REMOTE" "cd ${REMOTE_DIR} && pm2 restart all --update-env >/dev/null && pm2 save >/dev/null && pm2 status"

echo "==> Healthcheck"
sleep 3
CODE=$(ssh "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/")
if [[ "$CODE" =~ ^(200|307|308)$ ]]; then
  echo "OK: приложение отвечает (HTTP $CODE)"
else
  echo "WARN: приложение вернуло HTTP $CODE — проверьте: ssh $REMOTE 'pm2 logs manexa --lines 30 --nostream'"
  exit 1
fi

echo "==> Деплой завершён: http://192.168.100.2:3000"
