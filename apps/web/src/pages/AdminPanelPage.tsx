import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  adminCreateExamFlag,
  adminCreateUser,
  adminDeleteUser,
  adminForceSubmitExamSession,
  adminGetExamSession,
  adminGetUser,
  adminInvalidateExamSession,
  adminListExamEvents,
  adminListExamSessions,
  adminListUsers,
  adminRestoreUser,
  adminTerminateExamSession,
  adminUpdateUser,
  adminGetUserSessionLimit,
  adminListSessionGroups,
  adminListUserAuthSessions,
  adminListUserSessionGroups,
  adminRevokeAllUserAuthSessions,
  adminRevokeUserAuthSession,
  adminSetUserSessionLimit,
  adminAddSessionGroupMember,
  adminRemoveSessionGroupMember,
  adminCreateSessionGroup,
  adminUpdateSessionGroup,
} from '@/api/endpoints'
import { clearAllAccessTokens } from '@/auth/token'
import { QuestionBankTab } from '@/pages/admin/QuestionBankTab'
import { PracticeTemplatesManager } from '@/pages/shared/PracticeTemplatesManager'

function examStatusLabel(status?: string) {
  if (!status) return ''
  if (status === 'active') return 'Active'
  if (status === 'finished') return 'Finished'
  if (status === 'terminated') return 'Terminated'
  if (status === 'invalid') return 'Invalid'
  return status
}

export type AdminTab = 'questionBank' | 'practiceTemplates' | 'users' | 'examIntegrity'

export type AdminPanelPageProps = {
  tab: AdminTab
}

export function AdminPanelPage(props: AdminPanelPageProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const activeTab = props.tab

  // Users (IAM)
  const [userFilters, setUserFilters] = useState<{ role: '' | 'student' | 'instructor' | 'admin'; includeDeleted: boolean }>(
    { role: '', includeDeleted: false },
  )
  const users = useQuery({
    queryKey: ['admin', 'users', userFilters],
    queryFn: () =>
      adminListUsers({
        limit: 50,
        offset: 0,
        role: userFilters.role ? (userFilters.role as any) : undefined,
        includeDeleted: userFilters.includeDeleted,
      }),
    enabled: activeTab === 'users',
  })

  const [createUserForm, setCreateUserForm] = useState<{ email: string; password: string; role: 'student' | 'instructor' | 'admin' }>(
    { email: '', password: '', role: 'student' },
  )
  const createUserMutation = useMutation({
    mutationFn: adminCreateUser,
    onSuccess: async () => {
      setCreateUserForm({ email: '', password: '', role: 'student' })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const [selectedUserId, setSelectedUserId] = useState('')
  const selectedUser = useQuery({
    queryKey: ['admin', 'users', 'detail', selectedUserId],
    queryFn: () => adminGetUser(selectedUserId),
    enabled: activeTab === 'users' && Boolean(selectedUserId),
  })

  const [editUserForm, setEditUserForm] = useState<{ email: string; role: 'student' | 'instructor' | 'admin'; password: string } | null>(
    null,
  )

  useEffect(() => {
    if (!selectedUser.data) return
    setEditUserForm({
      email: selectedUser.data.email,
      role: selectedUser.data.role,
      password: '',
    })
  }, [selectedUser.data])

  const updateUserMutation = useMutation({
    mutationFn: async (input: { userId: string; body: any }) => adminUpdateUser(input.userId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', selectedUserId] })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', selectedUserId] })
    },
  })

  const restoreUserMutation = useMutation({
    mutationFn: adminRestoreUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'detail', selectedUserId] })
    },
  })

  const userSessionLimit = useQuery({
    queryKey: ['admin', 'users', 'sessionLimit', selectedUserId],
    queryFn: () => adminGetUserSessionLimit(selectedUserId),
    enabled: activeTab === 'users' && Boolean(selectedUserId),
  })

  const [editUserLimit, setEditUserLimit] = useState<string>('')
  useEffect(() => {
    if (!userSessionLimit.data) return
    setEditUserLimit(userSessionLimit.data.userMaxActiveSessions != null ? String(userSessionLimit.data.userMaxActiveSessions) : '')
  }, [userSessionLimit.data])

  const setUserLimitMutation = useMutation({
    mutationFn: async (input: { userId: string; max: number | null }) => adminSetUserSessionLimit(input.userId, input.max),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionLimit', selectedUserId] })
    },
  })

  const userSessions = useQuery({
    queryKey: ['admin', 'users', 'sessions', selectedUserId],
    queryFn: () => adminListUserAuthSessions(selectedUserId, { limit: 50, offset: 0, includeRevoked: true }),
    enabled: activeTab === 'users' && Boolean(selectedUserId),
  })

  const revokeSessionMutation = useMutation({
    mutationFn: async (input: { userId: string; sessionId: string }) => adminRevokeUserAuthSession(input.userId, input.sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessions', selectedUserId] })
    },
  })

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async (userId: string) => adminRevokeAllUserAuthSessions(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessions', selectedUserId] })
    },
  })

  const sessionGroups = useQuery({
    queryKey: ['admin', 'sessionGroups'],
    queryFn: () => adminListSessionGroups(),
    enabled: activeTab === 'users',
  })

  const userGroups = useQuery({
    queryKey: ['admin', 'users', 'sessionGroups', selectedUserId],
    queryFn: () => adminListUserSessionGroups(selectedUserId),
    enabled: activeTab === 'users' && Boolean(selectedUserId),
  })

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupLimit, setNewGroupLimit] = useState('')

  const createGroupMutation = useMutation({
    mutationFn: async (input: { name: string; max: number | null }) => adminCreateSessionGroup({ name: input.name, maxActiveSessions: input.max }),
    onSuccess: async () => {
      setNewGroupName('')
      setNewGroupLimit('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sessionGroups'] })
    },
  })

  const updateGroupLimitMutation = useMutation({
    mutationFn: async (input: { groupId: string; max: number }) => adminUpdateSessionGroup(input.groupId, { maxActiveSessions: input.max }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sessionGroups'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionGroups', selectedUserId] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionLimit', selectedUserId] })
    },
  })

  const addUserToGroupMutation = useMutation({
    mutationFn: async (input: { groupId: string; userId: string }) => adminAddSessionGroupMember(input.groupId, input.userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionGroups', selectedUserId] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionLimit', selectedUserId] })
    },
  })

  const removeUserFromGroupMutation = useMutation({
    mutationFn: async (input: { groupId: string; userId: string }) => adminRemoveSessionGroupMember(input.groupId, input.userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionGroups', selectedUserId] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'sessionLimit', selectedUserId] })
    },
  })

  // Exam integrity
  const [examFilters, setExamFilters] = useState<{ status: '' | 'active' | 'finished' | 'terminated' | 'invalid' }>({ status: '' })
  const examSessions = useQuery({
    queryKey: ['admin', 'examSessions', examFilters],
    queryFn: () =>
      adminListExamSessions({
        limit: 50,
        offset: 0,
        status: examFilters.status ? (examFilters.status as any) : undefined,
      }),
    enabled: activeTab === 'examIntegrity',
  })

  const [selectedExamSession, setSelectedExamSession] = useState<{ userId: string; sessionId: string } | null>(null)
  const examSessionDetail = useQuery({
    queryKey: ['admin', 'examSessions', 'detail', selectedExamSession?.userId, selectedExamSession?.sessionId],
    queryFn: () => adminGetExamSession(selectedExamSession!.userId, selectedExamSession!.sessionId),
    enabled: activeTab === 'examIntegrity' && Boolean(selectedExamSession),
  })

  const examEvents = useQuery({
    queryKey: ['admin', 'examSessions', 'events', selectedExamSession?.userId, selectedExamSession?.sessionId],
    queryFn: () => adminListExamEvents(selectedExamSession!.userId, selectedExamSession!.sessionId, { limit: 50, offset: 0 }),
    enabled: activeTab === 'examIntegrity' && Boolean(selectedExamSession),
  })

  const [terminateReason, setTerminateReason] = useState('')
  const [invalidateReason, setInvalidateReason] = useState('')
  const [flagForm, setFlagForm] = useState<{ flagType: string; note: string }>({ flagType: '', note: '' })

  const forceSubmitMutation = useMutation({
    mutationFn: async (input: { userId: string; sessionId: string }) => adminForceSubmitExamSession(input.userId, input.sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions', 'detail', selectedExamSession?.userId, selectedExamSession?.sessionId] })
    },
  })

  const terminateMutation = useMutation({
    mutationFn: async (input: { userId: string; sessionId: string; reason: string }) =>
      adminTerminateExamSession(input.userId, input.sessionId, { reason: input.reason.trim() || undefined }),
    onSuccess: async () => {
      setTerminateReason('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions', 'detail', selectedExamSession?.userId, selectedExamSession?.sessionId] })
    },
  })

  const invalidateMutation = useMutation({
    mutationFn: async (input: { userId: string; sessionId: string; reason: string }) =>
      adminInvalidateExamSession(input.userId, input.sessionId, { reason: input.reason.trim() || undefined }),
    onSuccess: async () => {
      setInvalidateReason('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions', 'detail', selectedExamSession?.userId, selectedExamSession?.sessionId] })
    },
  })

  const createFlagMutation = useMutation({
    mutationFn: async (input: { userId: string; sessionId: string; flagType: string; note: string }) =>
      adminCreateExamFlag(input.userId, input.sessionId, { flagType: input.flagType.trim(), note: input.note.trim() || undefined }),
    onSuccess: async () => {
      setFlagForm({ flagType: '', note: '' })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'examSessions'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {activeTab === 'questionBank'
              ? 'Question Bank'
              : activeTab === 'practiceTemplates'
                ? 'Practice Templates'
                : activeTab === 'users'
                  ? 'Users'
                  : 'Exam Integrity'}
          </h2>
          <p className="text-sm text-slate-600">Admin tools.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => navigate('/admin')}
          >
            Back to dashboard
          </button>
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => {
              clearAllAccessTokens()
              navigate('/admin/auth')
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {activeTab === 'questionBank' ? <QuestionBankTab /> : null}

      {activeTab === 'practiceTemplates' ? (
        <PracticeTemplatesManager
          title="Practice Templates"
          subtitle="Create and publish reusable practice tests for each exam package."
        />
      ) : null}

      {activeTab === 'users' ? (
        <div className="rounded border border-slate-200 p-4">
          <div className="space-y-1">
            <div className="font-medium">Users (IAM)</div>
            <div className="text-sm text-slate-600">Create, update, soft-delete, and restore any user.</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="font-medium">Filters</div>
                <div className="grid gap-2">
                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={userFilters.role}
                    onChange={(e) => setUserFilters((s) => ({ ...s, role: e.target.value as any }))}
                  >
                    <option value="">Any role</option>
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={userFilters.includeDeleted}
                      onChange={(e) => setUserFilters((s) => ({ ...s, includeDeleted: e.target.checked }))}
                    />
                    Include deleted
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Create user</div>
                <div className="grid gap-2">
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder="email"
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm((s) => ({ ...s, email: e.target.value }))}
                    autoComplete="email"
                  />
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder="password"
                    type="password"
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm((s) => ({ ...s, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm((s) => ({ ...s, role: e.target.value as any }))}
                  >
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={createUserMutation.isPending || !createUserForm.email.trim() || !createUserForm.password}
                    onClick={() => createUserMutation.mutate({
                      email: createUserForm.email.trim(),
                      password: createUserForm.password,
                      role: createUserForm.role,
                    })}
                  >
                    Create
                  </button>
                  {createUserMutation.isError ? <div className="text-sm text-red-600">Failed to create user.</div> : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">User list</div>
                <div className="max-h-72 overflow-auto rounded border border-slate-200">
                  <div className="divide-y divide-slate-100">
                    {(users.data?.items ?? []).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className={
                          'block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                          (selectedUserId === u.id ? 'bg-slate-50' : '')
                        }
                        onClick={() => {
                          setSelectedUserId(u.id)
                          setEditUserForm(null)
                        }}
                      >
                        <div className="truncate font-medium">{u.email}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          role={u.role} id={u.id}{u.deletedAt ? ' (deleted)' : ''}
                        </div>
                      </button>
                    ))}
                    {users.isLoading ? <div className="px-3 py-2 text-sm text-slate-600">Loading…</div> : null}
                    {users.isError ? <div className="px-3 py-2 text-sm text-red-600">Failed to load users.</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded border border-slate-200 p-3">
              <div className="font-medium">Selected user</div>
              {!selectedUserId ? <div className="text-sm text-slate-600">Pick a user to view/edit.</div> : null}
              {selectedUser.isLoading ? <div className="text-sm text-slate-600">Loading…</div> : null}
              {selectedUser.isError ? <div className="text-sm text-red-600">Failed to load user.</div> : null}

              {editUserForm && selectedUser.data ? (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">id={selectedUser.data.id}</div>
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm((s) => (s ? { ...s, email: e.target.value } : s))}
                  />
                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm((s) => (s ? { ...s, role: e.target.value as any } : s))}
                  >
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder="New password (leave blank to keep)"
                    type="password"
                    value={editUserForm.password}
                    onChange={(e) => setEditUserForm((s) => (s ? { ...s, password: e.target.value } : s))}
                    autoComplete="new-password"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={updateUserMutation.isPending}
                      onClick={() => {
                        if (!selectedUserId || !editUserForm) return
                        updateUserMutation.mutate({
                          userId: selectedUserId,
                          body: {
                            email: editUserForm.email.trim(),
                            role: editUserForm.role,
                            password: editUserForm.password ? editUserForm.password : null,
                          },
                        })
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={deleteUserMutation.isPending}
                      onClick={() => selectedUserId && deleteUserMutation.mutate(selectedUserId)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={restoreUserMutation.isPending}
                      onClick={() => selectedUserId && restoreUserMutation.mutate(selectedUserId)}
                    >
                      Restore
                    </button>
                  </div>

                  {(updateUserMutation.isError || deleteUserMutation.isError || restoreUserMutation.isError) ? (
                    <div className="text-sm text-red-600">User action failed.</div>
                  ) : null}


                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="space-y-1">
                      <div className="font-medium">Session limits</div>
                      <div className="text-sm text-slate-600">
                        Effective: {userSessionLimit.data?.effectiveMaxActiveSessions ?? '—'}
                        {userSessionLimit.data?.roleMaxActiveSessions != null ? ` · role=${userSessionLimit.data.roleMaxActiveSessions}` : ''}
                        {userSessionLimit.data?.groupMaxActiveSessions != null ? ` · group=${userSessionLimit.data.groupMaxActiveSessions}` : ''}
                        {userSessionLimit.data?.userMaxActiveSessions != null ? ` · user=${userSessionLimit.data.userMaxActiveSessions}` : ''}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        className="w-40 rounded border border-slate-200 px-3 py-2 text-sm"
                        placeholder="user limit (blank=clear)"
                        inputMode="numeric"
                        value={editUserLimit}
                        onChange={(e) => setEditUserLimit(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={setUserLimitMutation.isPending || !selectedUserId}
                        onClick={() => {
                          if (!selectedUserId) return
                          const raw = editUserLimit.trim()
                          const max = raw === '' ? null : Number(raw)
                          if (max !== null && (!Number.isFinite(max) || max < 1)) return
                          setUserLimitMutation.mutate({ userId: selectedUserId, max })
                        }}
                      >
                        Save user limit
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={setUserLimitMutation.isPending || !selectedUserId}
                        onClick={() => {
                          if (!selectedUserId) return
                          setEditUserLimit('')
                          setUserLimitMutation.mutate({ userId: selectedUserId, max: null })
                        }}
                      >
                        Clear user limit
                      </button>
                    </div>

                    {setUserLimitMutation.isError ? <div className="mt-2 text-sm text-red-600">Failed to set limit.</div> : null}
                    {userSessionLimit.isError ? <div className="mt-2 text-sm text-red-600">Failed to load limits.</div> : null}
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="space-y-1">
                      <div className="font-medium">Session groups</div>
                      <div className="text-sm text-slate-600">Assign user to groups with optional limits.</div>
                    </div>

                    <div className="mt-2 grid gap-2">
                      <div className="text-sm font-medium">User groups</div>
                      <div className="flex flex-wrap gap-2">
                        {(userGroups.data?.items ?? []).map((g) => (
                          <div key={g.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-sm">
                            <div className="font-medium">{g.name}</div>
                            {g.maxActiveSessions != null ? <div className="text-xs text-slate-600">limit={g.maxActiveSessions}</div> : null}
                            <button
                              type="button"
                              className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              disabled={removeUserFromGroupMutation.isPending}
                              onClick={() => selectedUserId && removeUserFromGroupMutation.mutate({ groupId: g.id, userId: selectedUserId })}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        {!userGroups.data?.items?.length ? <div className="text-sm text-slate-600">No groups.</div> : null}
                      </div>

                      <div className="mt-2 text-sm font-medium">Add to group</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="rounded border border-slate-200 px-3 py-2 text-sm"
                          value={''}
                          onChange={(e) => {
                            const gid = e.target.value
                            if (!gid || !selectedUserId) return
                            addUserToGroupMutation.mutate({ groupId: gid, userId: selectedUserId })
                          }}
                        >
                          <option value="">Pick group…</option>
                          {(sessionGroups.data?.items ?? []).map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-2 text-sm font-medium">Create group</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="w-48 rounded border border-slate-200 px-3 py-2 text-sm"
                          placeholder="group name"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                        />
                        <input
                          className="w-40 rounded border border-slate-200 px-3 py-2 text-sm"
                          placeholder="group limit (optional)"
                          inputMode="numeric"
                          value={newGroupLimit}
                          onChange={(e) => setNewGroupLimit(e.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={createGroupMutation.isPending || !newGroupName.trim()}
                          onClick={() => {
                            const raw = newGroupLimit.trim()
                            const max = raw === '' ? null : Number(raw)
                            if (max !== null && (!Number.isFinite(max) || max < 1)) return
                            createGroupMutation.mutate({ name: newGroupName.trim(), max })
                          }}
                        >
                          Create
                        </button>
                      </div>

                      <div className="mt-2 text-sm font-medium">Update group limit</div>
                      <div className="grid gap-2">
                        {(sessionGroups.data?.items ?? []).map((g) => (
                          <div key={g.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                            <div className="min-w-[8rem] text-sm font-medium">{g.name}</div>
                            <div className="text-xs text-slate-600">current={g.maxActiveSessions ?? '—'}</div>
                            <input
                              className="w-32 rounded border border-slate-200 px-2 py-1 text-sm"
                              placeholder="new limit"
                              inputMode="numeric"
                              onChange={(e) => {
                                ;(e.currentTarget as any).dataset.value = e.target.value
                              }}
                            />
                            <button
                              type="button"
                              className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              disabled={updateGroupLimitMutation.isPending}
                              onClick={(e) => {
                                const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement | null)
                                const raw = (input?.value ?? '').trim()
                                const max = Number(raw)
                                if (!Number.isFinite(max) || max < 1) return
                                updateGroupLimitMutation.mutate({ groupId: g.id, max })
                                if (input) input.value = ''
                              }}
                            >
                              Save
                            </button>
                          </div>
                        ))}
                        {sessionGroups.isLoading ? <div className="text-sm text-slate-600">Loading groups…</div> : null}
                        {sessionGroups.isError ? <div className="text-sm text-red-600">Failed to load groups.</div> : null}
                        {createGroupMutation.isError ? <div className="text-sm text-red-600">Failed to create group.</div> : null}
                        {addUserToGroupMutation.isError ? <div className="text-sm text-red-600">Failed to add user to group.</div> : null}
                        {removeUserFromGroupMutation.isError ? <div className="text-sm text-red-600">Failed to remove user from group.</div> : null}
                        {updateGroupLimitMutation.isError ? <div className="text-sm text-red-600">Failed to update group limit.</div> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-medium">Auth sessions</div>
                        <div className="text-sm text-slate-600">Active and historic sessions for this user.</div>
                      </div>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={revokeAllSessionsMutation.isPending || !selectedUserId}
                        onClick={() => selectedUserId && revokeAllSessionsMutation.mutate(selectedUserId)}
                      >
                        Revoke all
                      </button>
                    </div>

                    <div className="mt-2 max-h-72 overflow-auto rounded border border-slate-200">
                      <div className="divide-y divide-slate-100">
                        {(userSessions.data?.items ?? []).map((s) => (
                          <div key={s.id} className="px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{s.id}</div>
                                <div className="mt-1 text-xs text-slate-600">
                                  role={s.role} lastSeen={new Date(s.lastSeenAt).toLocaleString()} expires={new Date(s.expiresAt).toLocaleString()}
                                  {s.revokedAt ? ` · revoked=${new Date(s.revokedAt).toLocaleString()} (${s.revokedReason || 'revoked'})` : ''}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 truncate">ip={s.ip} ua={s.userAgent}</div>
                              </div>
                              {!s.revokedAt ? (
                                <button
                                  type="button"
                                  className="rounded border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50"
                                  disabled={revokeSessionMutation.isPending || !selectedUserId}
                                  onClick={() => selectedUserId && revokeSessionMutation.mutate({ userId: selectedUserId, sessionId: s.id })}
                                >
                                  Revoke
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {userSessions.isLoading ? <div className="px-3 py-2 text-sm text-slate-600">Loading…</div> : null}
                        {userSessions.isError ? <div className="px-3 py-2 text-sm text-red-600">Failed to load sessions.</div> : null}
                      </div>
                    </div>
                    {(revokeSessionMutation.isError || revokeAllSessionsMutation.isError) ? (
                      <div className="mt-2 text-sm text-red-600">Session revoke failed.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'examIntegrity' ? (
        <div className="rounded border border-slate-200 p-4">
          <div className="space-y-1">
            <div className="font-medium">Exam Integrity</div>
            <div className="text-sm text-slate-600">Monitor sessions, review events, and take enforcement actions.</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="font-medium">Filters</div>
                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={examFilters.status}
                  onChange={(e) => setExamFilters({ status: e.target.value as any })}
                >
                  <option value="">Any status</option>
                  <option value="active">Active</option>
                  <option value="finished">Finished</option>
                  <option value="terminated">Terminated</option>
                  <option value="invalid">Invalid</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Sessions</div>
                <div className="max-h-72 overflow-auto rounded border border-slate-200">
                  <div className="divide-y divide-slate-100">
                    {(examSessions.data?.items ?? []).map((s) => (
                      <button
                        key={`${s.userId}:${s.sessionId}`}
                        type="button"
                        className={
                          'block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                          (selectedExamSession && selectedExamSession.userId === s.userId && selectedExamSession.sessionId === s.sessionId
                            ? 'bg-slate-50'
                            : '')
                        }
                        onClick={() => setSelectedExamSession({ userId: s.userId, sessionId: s.sessionId })}
                      >
                        <div className="truncate font-medium">{s.userEmail}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          session={s.sessionId} status={examStatusLabel(s.status)}
                        </div>
                      </button>
                    ))}
                    {examSessions.isLoading ? <div className="px-3 py-2 text-sm text-slate-600">Loading…</div> : null}
                    {examSessions.isError ? <div className="px-3 py-2 text-sm text-red-600">Failed to load sessions.</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded border border-slate-200 p-3">
              <div className="font-medium">Selected session</div>
              {!selectedExamSession ? <div className="text-sm text-slate-600">Pick a session to view details.</div> : null}
              {examSessionDetail.isLoading ? <div className="text-sm text-slate-600">Loading…</div> : null}
              {examSessionDetail.isError ? <div className="text-sm text-red-600">Failed to load session.</div> : null}

              {examSessionDetail.data && selectedExamSession ? (
                <div className="space-y-4">
                  <div className="text-sm">
                    <div className="font-medium">{examSessionDetail.data.userEmail}</div>
                    <div className="text-xs text-slate-500">
                      userId={examSessionDetail.data.userId} sessionId={examSessionDetail.data.sessionId}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">status={examStatusLabel(examSessionDetail.data.status)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={forceSubmitMutation.isPending}
                      onClick={() => forceSubmitMutation.mutate({ userId: selectedExamSession.userId, sessionId: selectedExamSession.sessionId })}
                    >
                      Force submit
                    </button>
                  </div>

                  <div className="grid gap-2">
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Terminate reason (optional)"
                      value={terminateReason}
                      onChange={(e) => setTerminateReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={terminateMutation.isPending}
                      onClick={() => terminateMutation.mutate({ userId: selectedExamSession.userId, sessionId: selectedExamSession.sessionId, reason: terminateReason })}
                    >
                      Terminate
                    </button>
                  </div>

                  <div className="grid gap-2">
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Invalidate reason (optional)"
                      value={invalidateReason}
                      onChange={(e) => setInvalidateReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={invalidateMutation.isPending}
                      onClick={() => invalidateMutation.mutate({ userId: selectedExamSession.userId, sessionId: selectedExamSession.sessionId, reason: invalidateReason })}
                    >
                      Invalidate
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Flag</div>
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="flagType (required)"
                      value={flagForm.flagType}
                      onChange={(e) => setFlagForm((s) => ({ ...s, flagType: e.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="note (optional)"
                      value={flagForm.note}
                      onChange={(e) => setFlagForm((s) => ({ ...s, note: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={createFlagMutation.isPending || !flagForm.flagType.trim()}
                      onClick={() => createFlagMutation.mutate({
                        userId: selectedExamSession.userId,
                        sessionId: selectedExamSession.sessionId,
                        flagType: flagForm.flagType,
                        note: flagForm.note,
                      })}
                    >
                      Create flag
                    </button>
                    {createFlagMutation.isError ? <div className="text-sm text-red-600">Failed to create flag.</div> : null}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Recent events</div>
                    <div className="max-h-44 overflow-auto rounded border border-slate-200">
                      <div className="divide-y divide-slate-100">
                        {(examEvents.data?.items ?? []).map((ev) => (
                          <div key={ev.id} className="px-3 py-2 text-sm">
                            <div className="font-medium">{ev.eventType}</div>
                            <div className="mt-1 text-xs text-slate-500">{ev.createdAt}</div>
                          </div>
                        ))}
                        {examEvents.isLoading ? <div className="px-3 py-2 text-sm text-slate-600">Loading…</div> : null}
                        {examEvents.isError ? <div className="px-3 py-2 text-sm text-red-600">Failed to load events.</div> : null}
                        {!examEvents.isLoading && (examEvents.data?.items?.length ?? 0) === 0 ? (
                          <div className="px-3 py-2 text-sm text-slate-600">No events.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Snapshot</div>
                    <pre className="max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
                      {JSON.stringify(examSessionDetail.data.snapshot ?? {}, null, 2)}
                    </pre>
                  </div>

                  {(forceSubmitMutation.isError || terminateMutation.isError || invalidateMutation.isError) ? (
                    <div className="text-sm text-red-600">Exam action failed.</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
