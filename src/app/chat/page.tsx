'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Send, Paperclip, Smile, MoreVertical } from 'lucide-react'
import Layout from '@/components/layout'
import { useSocket } from '@/contexts/SocketContext'
import { useSession } from 'next-auth/react'
import { extractMentionNames } from '@/lib/mention-utils'

interface Message {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  }
  project?: {
    id: string
    name: string
  }
  attachments: any[]
}

interface Project {
  id: string
  name: string
  users?: Array<{ user: { id: string; name: string; email: string } }>
}

interface User {
  id: string
  name: string
  email: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false)
  const [projectMentionSearch, setProjectMentionSearch] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const { socket, isConnected } = useSocket()

  const appendChatMessage = (message: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
  }

  const messageMatchesFilter = (message: Message, projectId: string) => {
    if (projectId) return message.project?.id === projectId
    return !message.project
  }
  const { data: session } = useSession()

  useEffect(() => {
    fetchProjects()
    fetchMessages()
    fetchAllUsers()
  }, [])

  useEffect(() => {
    fetchMessages()
  }, [selectedProject])

  // WebSocket для реального времени
  useEffect(() => {
    if (!socket || !isConnected) return

    if (selectedProject) {
      socket.emit('join-project', selectedProject)
    }

    const handleNewMessage = (message: Message) => {
      if (messageMatchesFilter(message, selectedProject)) {
        appendChatMessage(message)
      }
    }

    socket.on('new-message', handleNewMessage)

    // Слушаем индикатор печати
    socket.on('user-typing', (data: { userName: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          if (!prev.includes(data.userName)) {
            return [...prev, data.userName]
          }
          return prev
        })
      } else {
        setTypingUsers((prev) => prev.filter(name => name !== data.userName))
      }
      
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter(name => name !== data.userName))
      }, 3000)
    })

    // Cleanup
    return () => {
      if (selectedProject) {
        socket.emit('leave-project', selectedProject)
      }
      socket.off('new-message', handleNewMessage)
      socket.off('user-typing')
    }
  }, [socket, isConnected, selectedProject])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?limit=100')
      if (response.ok) {
        const data = await response.json()
        // Загружаем проекты с участниками для упоминаний
        const projectsWithUsers = await Promise.all(
          (data.projects || []).map(async (project: Project) => {
            try {
              const projectResponse = await fetch(`/api/projects/${project.id}`)
              if (projectResponse.ok) {
                const projectData = await projectResponse.json()
                return { ...project, users: projectData.users }
              }
              return project
            } catch {
              return project
            }
          })
        )
        setProjects(projectsWithUsers)
      }
    } catch (err) {
      console.error('Error fetching projects:', err)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=100')
      if (response.ok) {
        const data = await response.json()
        setAllUsers(data.users || [])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const fetchMessages = async () => {
    try {
      const url = selectedProject 
        ? `/api/chat?projectId=${selectedProject}`
        : '/api/chat'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        setIsOnline(true)
      } else {
        setIsOnline(false)
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
      setIsOnline(false)
    } finally {
      setLoading(false)
    }
  }

  // Обработка ввода сообщения с упоминаниями
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    
    setNewMessage(value)
    setCursorPosition(cursorPos)

    // Отправляем индикатор печати
    if (socket && selectedProject && value.trim()) {
      socket.emit('typing', {
        projectId: selectedProject,
        userName: session?.user?.name || 'Пользователь',
        isTyping: true
      })
    }

    // Упоминания: @ — сотрудники, # — проекты (какой символ ближе к курсору)
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    const lastHashIndex = textBeforeCursor.lastIndexOf('#')
    
    if (lastAtIndex > lastHashIndex) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('#')) {
        setMentionSearch(textAfterAt.toLowerCase())
        setShowMentionSuggestions(true)
        setShowProjectSuggestions(false)
      } else {
        setShowMentionSuggestions(false)
      }
    } else if (lastHashIndex > lastAtIndex) {
      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1)
      if (!textAfterHash.includes(' ') && !textAfterHash.includes('@')) {
        setProjectMentionSearch(textAfterHash.toLowerCase())
        setShowProjectSuggestions(true)
        setShowMentionSuggestions(false)
      } else {
        setShowProjectSuggestions(false)
      }
    } else {
      setShowMentionSuggestions(false)
      setShowProjectSuggestions(false)
    }
  }

  // Вставка упоминания сотрудника
  const insertMention = (userName: string) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition)
    const textAfterCursor = newMessage.substring(cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const newText = 
        textBeforeCursor.substring(0, lastAtIndex) + 
        `@${userName} ` + 
        textAfterCursor
      
      setNewMessage(newText)
      setShowMentionSuggestions(false)
      
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)
    }
  }

  // Вставка упоминания проекта
  const insertProjectMention = (projectName: string) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition)
    const textAfterCursor = newMessage.substring(cursorPosition)
    const lastHashIndex = textBeforeCursor.lastIndexOf('#')
    
    if (lastHashIndex !== -1) {
      const newText = 
        textBeforeCursor.substring(0, lastHashIndex) + 
        `#${projectName} ` + 
        textAfterCursor
      
      setNewMessage(newText)
      setShowProjectSuggestions(false)
      
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 0)
    }
  }

  // Подсказки для упоминания сотрудников (поиск по имени/email, до 10 результатов)
  const getMentionSuggestions = () => {
    const search = mentionSearch.trim()
    if (selectedProject) {
      const currentProject = projects.find(p => p.id === selectedProject)
      if (!currentProject?.users) return []
      const filtered = currentProject.users
        .filter(member =>
          !search ||
          member.user.name.toLowerCase().includes(search) ||
          member.user.email.toLowerCase().includes(search)
        )
        .slice(0, 10)
      return filtered.map(m => ({ user: m.user }))
    }
    const filtered = allUsers
      .filter(user =>
        !search ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      )
      .slice(0, 10)
    return filtered.map(u => ({ user: u }))
  }

  // Подсказки для упоминания проектов (поиск по названию, до 10 результатов)
  const getProjectSuggestions = () => {
    const search = projectMentionSearch.trim()
    return projects
      .filter(p => !search || p.name.toLowerCase().includes(search))
      .slice(0, 10)
  }

  // Форматирование с упоминаниями (@сотрудники и #проекты)
  const formatMessageWithMentions = (content: string) => {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    // Сначала разбиваем по @ и #, обрабатываем по порядку
    const combinedRegex = /(@\S+(?:\s+\S+)*)|(#\S+(?:\s+\S+)*)/g
    let match
    while ((match = combinedRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        )
      }
      const full = match[0]
      if (full.startsWith('@')) {
        const name = full.slice(1).trim()
        const isMentioningMe = name === session?.user?.name
        parts.push(
          <span
            key={`mention-${match.index}`}
            className={`${
              isMentioningMe
                ? 'bg-blue-200 text-blue-900 font-semibold'
                : 'bg-blue-100 text-blue-700 font-medium'
            } px-1 rounded`}
          >
            @{name}
          </span>
        )
      } else {
        const projectName = full.slice(1).trim()
        parts.push(
          <span
            key={`project-${match.index}`}
            className="bg-emerald-100 text-emerald-800 font-medium px-1 rounded"
          >
            #{projectName}
          </span>
        )
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex)}
        </span>
      )
    }
    return parts.length > 0 ? parts : content
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      // Останавливаем индикатор печати
      if (socket && selectedProject) {
        socket.emit('typing', {
          projectId: selectedProject,
          userName: session?.user?.name || 'Пользователь',
          isTyping: false
        })
      }

      const mentions = extractMentionNames(newMessage)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          projectId: selectedProject || null,
          mentions: mentions
        })
      })

      if (response.ok) {
        const message = await response.json()
        if (messageMatchesFilter(message, selectedProject)) {
          appendChatMessage(message)
        }
        setNewMessage('')
        setShowMentionSuggestions(false)
        setShowProjectSuggestions(false)
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера'
    } else {
      return date.toLocaleDateString('ru-RU')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Загрузка сообщений...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">Чат команды</h1>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500">
                {isOnline ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {selectedProject 
                ? `Проект: ${projects.find(p => p.id === selectedProject)?.name}`
                : 'Общий чат'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="p-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Общий чат</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет сообщений</h3>
              <p className="text-gray-500">Начните общение с командой</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const showDate = index === 0 || 
                formatDate(messages[index - 1].createdAt) !== formatDate(message.createdAt)
              
              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      {formatDate(message.createdAt)}
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {message.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{message.user.name}</span>
                        <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                        {message.project && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {message.project.name}
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm">{formatMessageWithMentions(message.content)}</p>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.attachments.map((attachment, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                                <Paperclip className="h-3 w-3" />
                                <span>{attachment.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t p-4">
          {/* Индикатор печати */}
          {typingUsers.length > 0 && (
            <div className="px-3 py-2 mb-2 text-xs text-gray-500 italic">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'печатает' : 'печатают'}...
            </div>
          )}
          
          {/* Индикатор WebSocket */}
          <div className="px-3 mb-2 flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-gray-500">
              {isConnected ? 'Подключено' : 'Подключение...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled title="Вложения — в разработке">
              <Paperclip className="h-4 w-4 opacity-40" />
            </Button>
            <Button variant="ghost" size="sm" disabled title="Эмодзи — в разработке">
              <Smile className="h-4 w-4 opacity-40" />
            </Button>
            <div className="flex-1 relative">
              {/* Подсказки: сотрудники (@) — с поиском по имени/email */}
              {showMentionSuggestions && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">Упомянуть сотрудника</p>
                    <p className="text-xs text-gray-400 mt-0.5">Введите имя или email для поиска</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {getMentionSuggestions().length === 0 ? (
                      <p className="px-3 py-4 text-sm text-gray-500">Никого не найдено</p>
                    ) : (
                      getMentionSuggestions().map((member) => (
                        <button
                          key={member.user.id}
                          type="button"
                          onClick={() => insertMention(member.user.name)}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 transition-colors"
                        >
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-white font-medium">
                              {member.user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.user.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {member.user.email}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              {/* Подсказки: проекты (#) — с поиском по названию */}
              {showProjectSuggestions && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">Упомянуть проект</p>
                    <p className="text-xs text-gray-400 mt-0.5">Введите название для поиска</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {getProjectSuggestions().length === 0 ? (
                      <p className="px-3 py-4 text-sm text-gray-500">Проектов не найдено</p>
                    ) : (
                      getProjectSuggestions().map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => insertProjectMention(project.name)}
                          className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                        >
                          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-white font-medium">#</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate flex-1">
                            {project.name}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              <Input
                ref={messageInputRef}
                value={newMessage}
                onChange={handleMessageChange}
                onKeyPress={handleKeyPress}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowMentionSuggestions(false)
                    setShowProjectSuggestions(false)
                  }
                }}
                placeholder="Напишите сообщение... (@ — сотрудник, # — проект)"
                disabled={sending}
              />
            </div>
            <Button 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim() || sending}
              className="flex items-center gap-2"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
              Отправить
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  )
}