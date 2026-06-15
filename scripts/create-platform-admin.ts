/**
 * Создание администратора платформы.
 *
 * Использование:
 *   npx tsx scripts/create-platform-admin.ts admin@manexa.ru "СильныйПароль123" "Имя Фамилия"
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const [email, password, name] = process.argv.slice(2)

  if (!email || !password) {
    console.error('Использование: npx tsx scripts/create-platform-admin.ts <email> <пароль> [имя]')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Пароль должен содержать минимум 8 символов')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role === 'PLATFORM_ADMIN') {
      console.log(`Пользователь ${email} уже является администратором платформы`)
      return
    }
    console.error(`Пользователь ${email} уже существует с ролью ${existing.role}. Удалите его или используйте другой email.`)
    process.exit(1)
  }

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      name: name || 'Администратор платформы',
      password: hashed,
      role: 'PLATFORM_ADMIN',
      companyId: null,
      isActive: true,
    },
  })

  console.log('Создан администратор платформы:')
  console.log(`  id:    ${user.id}`)
  console.log(`  email: ${user.email}`)
  console.log('Вход: /auth/signin → после входа доступна панель /platform')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
