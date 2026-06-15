/**
 * Заполнение справочника тарифов (idempotent — upsert по code).
 *
 * Использование: npx tsx scripts/seed-plans.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PLANS = [
  {
    code: 'TRIAL',
    name: 'Пробный',
    description: 'Полный доступ на 14 дней',
    priceMonthly: 0,
    maxUsers: 5,
    maxProjects: 3,
    maxStorageMb: 1024,
    sortOrder: 0,
  },
  {
    code: 'BASIC',
    name: 'Базовый',
    description: 'Для небольших команд',
    priceMonthly: 5000,
    maxUsers: 10,
    maxProjects: 10,
    maxStorageMb: 5120,
    sortOrder: 1,
  },
  {
    code: 'STANDARD',
    name: 'Стандарт',
    description: 'Все функции + приоритетная поддержка',
    priceMonthly: 15000,
    maxUsers: 30,
    maxProjects: 50,
    maxStorageMb: 20480,
    sortOrder: 2,
  },
  {
    code: 'PREMIUM',
    name: 'Премиум',
    description: 'Безлимит + персональный менеджер',
    priceMonthly: 30000,
    maxUsers: null,
    maxProjects: null,
    maxStorageMb: null,
    sortOrder: 3,
  },
]

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    })
    console.log(`Тариф ${plan.code} — OK`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
