'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout'
import { Plus, Search, Edit, Trash2, X, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PermissionGuard, PermissionButton } from '@/components/permission-guard'
import { UserRole } from '@/lib/permissions'

interface User {
  id: string
  name: string
  email: string
  role: string
  position?: string
  createdAt: string
  _count: {
    Project: number
    Task: number
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'USER',
    position: '',
    password: ''
  })
  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: 'USER',
    position: ''
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const userData = await response.json()
        
        if (editingUser) {
          // Update existing user in the list
          setUsers(users.map(u => u.id === editingUser.id ? userData : u))
          setSuccess('Пользователь успешно обновлен')
        } else {
          // Add new user to the list
          setUsers([userData, ...users])
          setSuccess('Пользователь успешно создан')
        }
        
        setShowModal(false)
        setEditingUser(null)
        setFormData({ name: '', email: '', role: 'USER', position: '', password: '' })
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Ошибка ${editingUser ? 'обновления' : 'создания'} пользователя`)
      }
    } catch (err) {
      setError(`Ошибка ${editingUser ? 'обновления' : 'создания'} пользователя`)
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteData)
      })

      if (response.ok) {
        const result = await response.json()
        setUsers([result.user, ...users])
        setShowInviteModal(false)
        setInviteData({ name: '', email: '', role: 'USER', position: '' })
        if (result.emailSent) {
          setSuccess(`Пользователь ${result.user.name} приглашён. Письмо с паролем отправлено на ${result.user.email}.`)
        } else if (result.tempPassword) {
          setSuccess(`Пользователь ${result.user.name} приглашён. Временный пароль (dev): ${result.tempPassword}`)
        } else {
          setSuccess(`Пользователь ${result.user.name} приглашён.`)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Ошибка приглашения пользователя')
      }
    } catch (err) {
      setError('Ошибка приглашения пользователя')
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      position: user.position || '',
      password: ''
    })
    setShowModal(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId))
        setSuccess('Пользователь успешно удален')
        return
      }

      const data = await response.json().catch(() => ({}))

      // Пользователь создал данные — предлагаем деактивацию вместо удаления
      if (response.status === 409 && data.canDeactivate) {
        if (confirm(`${data.error}\n\nДеактивировать пользователя сейчас?`)) {
          const deactivate = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false }),
          })
          if (deactivate.ok) {
            setSuccess('Пользователь деактивирован — доступ закрыт, данные сохранены')
            fetchUsers()
          } else {
            const d = await deactivate.json().catch(() => ({}))
            setError(d.error || 'Не удалось деактивировать пользователя')
          }
        }
        return
      }

      setError(data.error || 'Ошибка удаления пользователя')
    } catch (err) {
      setError('Ошибка удаления пользователя')
    }
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      'OWNER': 'Владелец',
      'ADMIN': 'Администратор',
      'MANAGER': 'Менеджер',
      'USER': 'Пользователь'
    }
    return labels[role] || role
  }

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      'OWNER': 'bg-purple-100 text-purple-800',
      'ADMIN': 'bg-red-100 text-red-800',
      'MANAGER': 'bg-blue-100 text-blue-800',
      'USER': 'bg-gray-100 text-gray-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Загрузка пользователей...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PermissionGuard
        permission="canManageUsers"
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">У вас нет доступа к разделу пользователей</p>
          </div>
        }
      >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
            <p className="text-sm text-gray-600 mt-1">{users.length} пользователей</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowInviteModal(true)} variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Пригласить
            </Button>
            <PermissionButton
              permission="canCreateUsers"
              onClick={() => setShowModal(true)}
            >
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить пользователя
              </Button>
            </PermissionButton>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Поиск пользователей..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Список пользователей</CardTitle>
            <CardDescription>
              Управление пользователями и их правами доступа
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Пользователь</th>
                    <th className="text-left py-3 px-4">Роль</th>
                    <th className="text-left py-3 px-4">Должность</th>
                    <th className="text-left py-3 px-4">Проекты</th>
                    <th className="text-left py-3 px-4">Задачи</th>
                    <th className="text-left py-3 px-4">Дата создания</th>
                    <th className="text-left py-3 px-4">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="py-3 px-4">{user.position || '-'}</td>
                        <td className="py-3 px-4">{user._count?.Project || 0}</td>
                        <td className="py-3 px-4">{user._count?.Task || 0}</td>
                        <td className="py-3 px-4">{formatDate(user.createdAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <PermissionButton
                              permission="canEditUsers"
                              onClick={() => handleEditUser(user)}
                            >
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </PermissionButton>
                            <PermissionButton
                              permission="canDeleteUsers"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Create User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>{editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}</CardTitle>
                <CardDescription>
                  {editingUser ? 'Измените данные пользователя' : 'Создайте нового пользователя'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Имя</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Введите имя"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Введите email"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Роль</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="USER">Пользователь</option>
                      <option value="MANAGER">Менеджер</option>
                      <option value="ADMIN">Администратор</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="position">Должность</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="Введите должность"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Пароль {editingUser ? '(оставьте пустым, чтобы не менять)' : ''}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? "Введите новый пароль (необязательно)" : "Введите пароль"}
                      required={!editingUser}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowModal(false)
                        setEditingUser(null)
                        setFormData({ name: '', email: '', role: 'USER', position: '', password: '' })
                      }}
                    >
                      Отмена
                    </Button>
                    <Button type="submit">
                      {editingUser ? 'Сохранить' : 'Создать'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invite User Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Пригласить пользователя</CardTitle>
                <CardDescription>
                  Пригласите нового пользователя в вашу компанию
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div>
                    <Label htmlFor="invite-name">Имя</Label>
                    <Input
                      id="invite-name"
                      value={inviteData.name}
                      onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                      placeholder="Введите имя"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                      placeholder="Введите email"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="invite-role">Роль</Label>
                    <select
                      id="invite-role"
                      value={inviteData.role}
                      onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="USER">Пользователь</option>
                      <option value="MANAGER">Менеджер</option>
                      <option value="ADMIN">Администратор</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="invite-position">Должность</Label>
                    <Input
                      id="invite-position"
                      value={inviteData.position}
                      onChange={(e) => setInviteData({ ...inviteData, position: e.target.value })}
                      placeholder="Введите должность"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowInviteModal(false)
                        setInviteData({ name: '', email: '', role: 'USER', position: '' })
                      }}
                    >
                      Отмена
                    </Button>
                    <Button type="submit">
                      Пригласить
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </PermissionGuard>
    </Layout>
  )
}