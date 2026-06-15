import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { authenticator } from "otplib"
import { prisma } from "./prisma"
import { checkRateLimit } from "./rate-limit"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Спец-ветка: вход по одноразовому impersonation-токену (выдаёт PLATFORM_ADMIN)
        if (credentials.email === '__impersonation__') {
          const impersonationToken = await prisma.impersonationToken.findUnique({
            where: { token: credentials.password },
          })
          if (
            !impersonationToken ||
            impersonationToken.usedAt ||
            impersonationToken.expiresAt < new Date()
          ) {
            return null
          }

          const targetUser = await prisma.user.findUnique({
            where: { id: impersonationToken.targetUserId },
            include: { company: true },
          })
          if (!targetUser || !targetUser.isActive) {
            return null
          }

          await prisma.impersonationToken.update({
            where: { id: impersonationToken.id },
            data: { usedAt: new Date() },
          })

          return {
            id: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            role: targetUser.role,
            companyId: targetUser.companyId,
            company: targetUser.company,
            phone: targetUser.phone,
            address: targetUser.address,
            mustChangePassword: false, // в режиме поддержки смену пароля не требуем
            totpEnabled: targetUser.totpEnabled,
            impersonatedBy: impersonationToken.issuedById,
          } as any
        }

        const rateLimit = await checkRateLimit(
          `login:${credentials.email.toLowerCase()}`,
          10,
          15 * 60 * 1000
        )
        if (!rateLimit.allowed) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          },
          include: {
            company: true
          }
        })

        if (!user || !user.password) {
          return null
        }

        // Деактивированный пользователь не может войти
        if (!user.isActive) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // 2FA (TOTP) — обязательная проверка, если включена у пользователя
        if (user.totpEnabled && user.totpSecret) {
          if (!credentials.totpCode) {
            throw new Error('TOTP_REQUIRED')
          }
          const codeValid = authenticator.verify({
            token: credentials.totpCode.replace(/\s/g, ''),
            secret: user.totpSecret,
          })
          if (!codeValid) {
            throw new Error('TOTP_INVALID')
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          company: user.company,
          phone: user.phone,
          address: user.address,
          mustChangePassword: user.mustChangePassword,
          totpEnabled: user.totpEnabled
        } as any
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // При первом входе сохраняем данные пользователя
      if (user) {
        token.name = user.name
        token.role = user.role
        token.companyId = user.companyId
        token.company = user.company
        token.phone = user.phone
        token.address = user.address
        token.mustChangePassword = (user as any).mustChangePassword || false
        token.totpEnabled = (user as any).totpEnabled || false
        token.impersonatedBy = (user as any).impersonatedBy || null
        // Метка времени входа — для ограничения сессии платформенных ролей
        token.loginAt = Date.now()
      }

      // При обновлении сессии (trigger === 'update') подтягиваем свежие данные из БД
      if (trigger === 'update' && token.sub) {
        const updatedUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: {
            company: true // Загружаем полную информацию о компании с реквизитами
          }
        })

        if (updatedUser) {
          token.name = updatedUser.name
          token.phone = updatedUser.phone
          token.address = updatedUser.address
          token.role = updatedUser.role
          token.companyId = updatedUser.companyId
          token.company = updatedUser.company
          token.mustChangePassword = updatedUser.mustChangePassword
          token.totpEnabled = updatedUser.totpEnabled
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.name = token.name as string
        session.user.role = token.role as string
        session.user.companyId = token.companyId as string
        session.user.company = token.company as any
        session.user.phone = token.phone as string
        session.user.address = token.address as string
        ;(session.user as any).mustChangePassword = Boolean(token.mustChangePassword)
        ;(session.user as any).totpEnabled = Boolean(token.totpEnabled)
        ;(session.user as any).loginAt = token.loginAt as number | undefined
        ;(session.user as any).impersonatedBy = (token.impersonatedBy as string | null) || null

        // Добавляем реквизиты компании в сессию для использования в шаблонах
        if (token.company && typeof token.company === 'object') {
          session.user.company = {
            ...token.company,
            name: token.company.name,
            // Реквизиты теперь доступны в сессии
            inn: token.company.inn,
            legalName: token.company.legalName,
            directorName: token.company.directorName,
            directorPosition: token.company.directorPosition,
            contactEmail: token.company.contactEmail,
            contactPhone: token.company.contactPhone,
            bankAccount: token.company.bankAccount,
            bankName: token.company.bankName,
            bankBik: token.company.bankBik,
            correspondentAccount: token.company.correspondentAccount,
            legalAddress: token.company.legalAddress,
            actualAddress: token.company.actualAddress
          }
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}
