import { writeFile, appendFile, mkdir } from 'fs/promises'
import { join } from 'path'

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: any
  userId?: string
  requestId?: string
  duration?: number
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private logDir: string
  private maxFileSize: number = 10 * 1024 * 1024 // 10MB
  private maxFiles: number = 5

  constructor() {
    this.logDir = join(process.cwd(), 'logs')
    this.ensureLogDirectory()
  }

  private async ensureLogDirectory() {
    try {
      await mkdir(this.logDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create log directory:', error)
    }
  }

  private getLogFileName(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0]
    return join(this.logDir, `${level.toLowerCase()}-${date}.log`)
  }

  private async rotateLogFile(filePath: string) {
    try {
      const stats = await import('fs').then(fs => fs.promises.stat(filePath))
      if (stats.size > this.maxFileSize) {
        const timestamp = Date.now()
        const newPath = `${filePath}.${timestamp}`
        await import('fs').then(fs => fs.promises.rename(filePath, newPath))
      }
    } catch (error) {
      // Файл ещё не создан (первая запись за день) — это норма, не ошибка
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return
      console.error('Failed to rotate log file:', error)
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const logLine = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.duration && { duration: `${entry.duration}ms` }),
      ...(entry.error && { error: entry.error })
    }

    return JSON.stringify(logLine) + '\n'
  }

  private async writeLog(level: LogLevel, message: string, context?: any, userId?: string, requestId?: string, duration?: number, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId,
      requestId,
      duration,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    const logFile = this.getLogFileName(level)
    
    try {
      await this.rotateLogFile(logFile)
      await appendFile(logFile, this.formatLogEntry(entry))
    } catch (err) {
      console.error('Failed to write log:', err)
    }

    // Также выводим в консоль для разработки
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level}] ${message}`, context || '')
    }
  }

  async error(message: string, context?: any, userId?: string, requestId?: string, error?: Error) {
    await this.writeLog(LogLevel.ERROR, message, context, userId, requestId, undefined, error)
  }

  async warn(message: string, context?: any, userId?: string, requestId?: string) {
    await this.writeLog(LogLevel.WARN, message, context, userId, requestId)
  }

  async info(message: string, context?: any, userId?: string, requestId?: string, duration?: number) {
    await this.writeLog(LogLevel.INFO, message, context, userId, requestId, duration)
  }

  async debug(message: string, context?: any, userId?: string, requestId?: string) {
    await this.writeLog(LogLevel.DEBUG, message, context, userId, requestId)
  }

  // Метрики производительности
  async performance(operation: string, duration: number, context?: any, userId?: string, requestId?: string) {
    await this.writeLog(LogLevel.INFO, `Performance: ${operation}`, { operation, ...context }, userId, requestId, duration)
  }

  // Безопасность
  async security(event: string, context?: any, userId?: string, requestId?: string) {
    await this.writeLog(LogLevel.WARN, `Security: ${event}`, { event, ...context }, userId, requestId)
  }

  // Бизнес-логика
  async business(event: string, context?: any, userId?: string, requestId?: string) {
    await this.writeLog(LogLevel.INFO, `Business: ${event}`, { event, ...context }, userId, requestId)
  }
}

export const logger = new Logger()

// Утилиты для быстрого логирования
export const logError = (message: string, error?: Error, context?: any) => 
  logger.error(message, context, undefined, undefined, error)

export const logWarn = (message: string, context?: any) => 
  logger.warn(message, context)

export const logInfo = (message: string, context?: any) => 
  logger.info(message, context)

export const logPerformance = (operation: string, duration: number, context?: any) => 
  logger.performance(operation, duration, context)

export const logSecurity = (event: string, context?: any) => 
  logger.security(event, context)

export const logBusiness = (event: string, context?: any) => 
  logger.business(event, context)
