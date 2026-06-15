# Развёртывание Manexa

> **Актуальное руководство:** [`docs/PRODUCTION.md`](PRODUCTION.md)

Этот файл — краткая навигация. Полная инструкция по VPS, PM2, Caddy, PgBouncer, Redis и бэкапам — в **PRODUCTION.md**.

**Дорожная карта, баги и идеи:** [`docs/ROADMAP_AND_ISSUES.md`](ROADMAP_AND_ISSUES.md)

## Архитектура

Manexa запускается как **Node.js-процесс** (`node server.js`), не serverless:

- Next.js App Router
- Socket.IO (WebSocket)
- In-process cron (или внешний worker при PM2 cluster)

**Vercel и чистый `next start` без `server.js` не поддерживаются.**

## Быстрый старт (локально / пилот)

```bash
cp .env.example .env
# Заполните DATABASE_URL, NEXTAUTH_SECRET, CRON_SECRET, MinIO

docker compose up -d          # postgres, pgbouncer, redis, minio
npm ci
npx prisma db push
npm run db:seed               # опционально
npm run dev                   # http://localhost:3000
```

## Production checklist

- [ ] `NODE_ENV=production`, секреты ≥ 32 символов (`openssl rand -base64 32`)
- [ ] `ALLOW_PUBLIC_REGISTRATION=false` для закрытой регистрации
- [ ] HTTPS (Caddy/Nginx) — см. `deploy/Caddyfile.example`
- [ ] PM2: `npm run build && npm run start:pm2`
- [ ] Ежедневные бэкапы: `scripts/backup-db.sh`, `scripts/backup-minio.sh`
- [ ] CI: lint + build на каждый push (`.github/workflows/deploy.yml`)

## Переменные окружения

См. [`.env.example`](../.env.example) — все ключи с комментариями.

## CI/CD

GitHub Actions выполняет `lint`, `npm test` (smoke-проверки) и `build`.  
Деплой на VPS — через SSH + PM2 (шаблон закомментирован в workflow).

## Устаревшие разделы

Ранее здесь описывались Vercel, пароли по умолчанию `12345` и app-контейнер в compose — **это больше не актуально**. Используйте PRODUCTION.md.
