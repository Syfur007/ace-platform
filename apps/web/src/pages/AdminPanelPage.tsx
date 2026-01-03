import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  adminApproveQuestion,
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
  adminRequestQuestionChanges,
  adminRestoreUser,
  adminTerminateExamSession,
  adminUpdateUser,
  instructorArchiveQuestion,
  instructorCreateQuestion,
  instructorCreateQuestionPackage,
  adminGetUserSessionLimit,
  instructorCreateQuestionTopic,
  adminListSessionGroups,
  instructorDeleteQuestionPackage,
  instructorDeleteQuestionTopic,
  instructorDraftQuestion,
  adminListUserAuthSessions,
  adminListUserSessionGroups,
  adminRevokeAllUserAuthSessions,
  adminRevokeUserAuthSession,
  adminSetUserSessionLimit,
  adminAddSessionGroupMember,
  adminRemoveSessionGroupMember,
  adminCreateSessionGroup,
  adminUpdateSessionGroup,
  instructorGetQuestion,
  instructorListQuestionDifficulties,
  instructorListQuestionPackages,
  instructorListQuestionTopics,
  instructorListQuestions,
  instructorPublishQuestion,
  instructorReplaceChoices,
  instructorSubmitQuestionForReview,
  instructorUpdateQuestionDifficulty,
  instructorUpdateQuestionPackage,
  instructorUpdateQuestionTopic,
  instructorUpdateQuestion,
} from '@/api/endpoints'
import { clearAllAccessTokens } from '@/auth/token'

type CreateQuestionFormState = {
  packageId: string
  topicId: string
  difficultyId: string
  prompt: string
  explanation: string
  choicesText: string[]
  correctChoiceIndex: number
}

type EditQuestionFormState = {
  packageId: string
  topicId: string
  difficultyId: string
  prompt: string
  explanation: string
  choicesText: string[]
  correctChoiceIndex: number
}

function compactStatusLabel(status?: string) {
  if (!status) return ''
  if (status === 'draft') return 'Draft'
  if (status === 'in_review') return 'In review'
  if (status === 'needs_changes') return 'Needs changes'
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return status
}

function examStatusLabel(status?: string) {
  if (!status) return ''
  if (status === 'active') return 'Active'
  if (status === 'finished') return 'Finished'
  if (status === 'terminated') return 'Terminated'
  if (status === 'invalid') return 'Invalid'
  return status
}

export type AdminTab = 'questionBank' | 'users' | 'examIntegrity'

export type AdminPanelPageProps = {
  tab: AdminTab
}

export function AdminPanelPage(props: AdminPanelPageProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const activeTab = props.tab

  const [packageName, setPackageName] = useState('')
  const [topicName, setTopicName] = useState('')
  const [topicPackageId, setTopicPackageId] = useState('')

  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [editPackageName, setEditPackageName] = useState('')
  const [editPackageIsHidden, setEditPackageIsHidden] = useState(false)

  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [editTopicName, setEditTopicName] = useState('')
  const [editTopicIsHidden, setEditTopicIsHidden] = useState(false)

  const [selectedDifficultyId, setSelectedDifficultyId] = useState('')
  const [editDifficultyDisplayName, setEditDifficultyDisplayName] = useState('')

  const [questionFilters, setQuestionFilters] = useState<{
    status: '' | 'draft' | 'in_review' | 'needs_changes' | 'published' | 'archived'
    packageId: string
    topicId: string
    difficultyId: string
  }>({ status: 'draft', packageId: '', topicId: '', difficultyId: '' })

  const [createQuestion, setCreateQuestion] = useState<CreateQuestionFormState>({
    packageId: '',
    topicId: '',
    difficultyId: '',
    prompt: '',
    explanation: '',
    choicesText: ['', '', '', ''],
    correctChoiceIndex: 0,
  })

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('')
  const [editQuestion, setEditQuestion] = useState<EditQuestionFormState | null>(null)

  const [reviewRequestNote, setReviewRequestNote] = useState('')

  const packages = useQuery({
    queryKey: ['questionBank', 'packages'],
    queryFn: instructorListQuestionPackages,
  })

  const topics = useQuery({
    queryKey: ['questionBank', 'topics'],
    queryFn: () => instructorListQuestionTopics(),
  })

  const difficulties = useQuery({
    queryKey: ['questionBank', 'difficulties'],
    queryFn: instructorListQuestionDifficulties,
  })

  const questions = useQuery({
    queryKey: ['questionBank', 'questions', questionFilters],
    queryFn: () =>
      instructorListQuestions({
        limit: 50,
        offset: 0,
        status: questionFilters.status || undefined,
        packageId: questionFilters.packageId || undefined,
        topicId: questionFilters.topicId || undefined,
        difficultyId: questionFilters.difficultyId || undefined,
      }),
  })

  const selectedQuestion = useQuery({
    queryKey: ['questionBank', 'question', selectedQuestionId],
    queryFn: () => instructorGetQuestion(selectedQuestionId),
    enabled: Boolean(selectedQuestionId),
  })

  const visibleTopics = useMemo(() => {
    const items = (topics.data?.items ?? []).filter((t: any) => !t.isHidden)
    if (questionFilters.packageId) return items.filter((t) => t.packageId === questionFilters.packageId)
    return items
  }, [topics.data?.items, questionFilters.packageId])

  const visibleTopicsForCreate = useMemo(() => {
    const items = (topics.data?.items ?? []).filter((t: any) => !t.isHidden)
    if (createQuestion.packageId) return items.filter((t) => t.packageId === createQuestion.packageId)
    return items
  }, [topics.data?.items, createQuestion.packageId])

  const visiblePackagesForSelect = useMemo(() => {
    return (packages.data?.items ?? []).filter((p: any) => !p.isHidden)
  }, [packages.data?.items])

  const difficultiesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of difficulties.data?.items ?? []) map.set(d.id, d.displayName)
    return map
  }, [difficulties.data?.items])

  const createPackageMutation = useMutation({
    mutationFn: instructorCreateQuestionPackage,
    onSuccess: async () => {
      setPackageName('')
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'packages'] })
    },
  })

  const createTopicMutation = useMutation({
    mutationFn: instructorCreateQuestionTopic,
    onSuccess: async () => {
      setTopicName('')
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
    },
  })

  const createQuestionMutation = useMutation({
    mutationFn: instructorCreateQuestion,
    onSuccess: async (data) => {
      setCreateQuestion({
        packageId: '',
        topicId: '',
        difficultyId: '',
        prompt: '',
        explanation: '',
        choicesText: ['', '', '', ''],
        correctChoiceIndex: 0,
      })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      setSelectedQuestionId(data.id)
    },
  })

  const updateQuestionMutation = useMutation({
    mutationFn: async (input: { questionId: string; body: any }) => instructorUpdateQuestion(input.questionId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', selectedQuestionId] })
    },
  })

  const replaceChoicesMutation = useMutation({
    mutationFn: async (input: { questionId: string; body: any }) => instructorReplaceChoices(input.questionId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', selectedQuestionId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (input: { action: 'publish' | 'archive' | 'draft'; questionId: string }) => {
      if (input.action === 'publish') return instructorPublishQuestion(input.questionId)
      if (input.action === 'archive') return instructorArchiveQuestion(input.questionId)
      return instructorDraftQuestion(input.questionId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', selectedQuestionId] })
    },
  })

  const submitForReviewMutation = useMutation({
    mutationFn: async (questionId: string) => instructorSubmitQuestionForReview(questionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', selectedQuestionId] })
    },
  })

  const approveQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => adminApproveQuestion(questionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', selectedQuestionId] })
    },
  })

  const requestChangesMutation = useMutation({
    mutationFn: async (input: { questionId: string; note: string }) =>
      adminRequestQuestionChanges(input.questionId, { note: input.note.trim() || undefined }),
    onSuccess: async () => {
      setReviewRequestNote('')
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', selectedQuestionId] })
    },
  })

  const updatePackageMutation = useMutation({
    mutationFn: async (input: { packageId: string; body: { name?: string; isHidden?: boolean } }) =>
      instructorUpdateQuestionPackage(input.packageId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'packages'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
    },
  })

  const deletePackageMutation = useMutation({
    mutationFn: instructorDeleteQuestionPackage,
    onSuccess: async () => {
      setSelectedPackageId('')
      setEditPackageName('')
      setEditPackageIsHidden(false)
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'packages'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
    },
  })

  const updateTopicMutation = useMutation({
    mutationFn: async (input: { topicId: string; body: { name?: string; isHidden?: boolean } }) =>
      instructorUpdateQuestionTopic(input.topicId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
    },
  })

  const deleteTopicMutation = useMutation({
    mutationFn: instructorDeleteQuestionTopic,
    onSuccess: async () => {
      setSelectedTopicId('')
      setEditTopicName('')
      setEditTopicIsHidden(false)
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
    },
  })

  const updateDifficultyMutation = useMutation({
    mutationFn: async (input: { difficultyId: string; displayName: string }) =>
      instructorUpdateQuestionDifficulty(input.difficultyId, { displayName: input.displayName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'difficulties'] })
    },
  })

  useEffect(() => {
    if (createQuestion.difficultyId) return
    const first = (difficulties.data?.items ?? [])[0]
    if (!first) return
    setCreateQuestion((s) => (s.difficultyId ? s : { ...s, difficultyId: first.id }))
  }, [difficulties.data?.items, createQuestion.difficultyId])

  useEffect(() => {
    const pkg = (packages.data?.items ?? []).find((p: any) => p.id === selectedPackageId)
    if (!pkg) return
    setEditPackageName(pkg.name ?? '')
    setEditPackageIsHidden(Boolean((pkg as any).isHidden))
  }, [packages.data?.items, selectedPackageId])

  useEffect(() => {
    const top = (topics.data?.items ?? []).find((t: any) => t.id === selectedTopicId)
    if (!top) return
    setEditTopicName(top.name ?? '')
    setEditTopicIsHidden(Boolean((top as any).isHidden))
  }, [topics.data?.items, selectedTopicId])

  useEffect(() => {
    const diff = (difficulties.data?.items ?? []).find((d) => d.id === selectedDifficultyId)
    if (!diff) return
    setEditDifficultyDisplayName(diff.displayName ?? '')
  }, [difficulties.data?.items, selectedDifficultyId])

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

  // Keep edit form in sync when selection changes.
  useEffect(() => {
    if (!selectedQuestion.data) return
    const q = selectedQuestion.data
    const correctIndex = Math.max(0, q.choices.findIndex((c) => c.id === q.correctChoiceId))
    setEditQuestion({
      packageId: q.packageId ?? '',
      topicId: q.topicId ?? '',
      difficultyId: q.difficultyId,
      prompt: q.prompt,
      explanation: q.explanation,
      choicesText: q.choices.map((c) => c.text),
      correctChoiceIndex: correctIndex,
    })
  }, [selectedQuestionId, selectedQuestion.data])

  const selectedQuestionStatus = selectedQuestion.data?.status

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {activeTab === 'questionBank' ? 'Question Bank' : activeTab === 'users' ? 'Users' : 'Exam Integrity'}
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

      {activeTab === 'questionBank' ? (
      <div className="rounded border border-slate-200 p-4">
        <div className="space-y-1">
          <div className="font-medium">Question Bank</div>
          <div className="text-sm text-slate-600">Create packages, topics, and manage questions (review workflow supported).</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="font-medium">Packages</div>
              <div className="flex gap-2">
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  placeholder="New package name"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                />
                <button
                  className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  type="button"
                  disabled={createPackageMutation.isPending || packageName.trim() === ''}
                  onClick={() => createPackageMutation.mutate({ name: packageName.trim() })}
                >
                  Create
                </button>
              </div>
              {createPackageMutation.isError && (
                <div className="text-sm text-red-600">Failed to create package.</div>
              )}

              <div className="max-h-44 overflow-auto rounded border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {(packages.data?.items ?? []).map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      className={
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                        (selectedPackageId === p.id ? 'bg-slate-50' : '')
                      }
                      onClick={() => setSelectedPackageId(p.id)}
                    >
                      <div className="truncate">
                        {p.name}
                        {p.isHidden ? <span className="ml-2 text-xs text-slate-500">(hidden)</span> : null}
                      </div>
                      <div className="text-xs text-slate-500">{p.id}</div>
                    </button>
                  ))}
                  {packages.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
                  {packages.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
                </div>
              </div>

              <div className="rounded border border-slate-200 p-3">
                <div className="font-medium">Edit package</div>
                {!selectedPackageId ? <div className="mt-1 text-sm text-slate-600">Select a package above.</div> : null}
                {selectedPackageId ? (
                  <div className="mt-3 grid gap-2">
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editPackageName}
                      onChange={(e) => setEditPackageName(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editPackageIsHidden}
                        onChange={(e) => setEditPackageIsHidden(e.target.checked)}
                      />
                      Hidden (students won’t see it)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={updatePackageMutation.isPending || editPackageName.trim() === ''}
                        onClick={() =>
                          updatePackageMutation.mutate({
                            packageId: selectedPackageId,
                            body: { name: editPackageName.trim(), isHidden: editPackageIsHidden },
                          })
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={deletePackageMutation.isPending}
                        onClick={() => {
                          if (!confirm('Delete this package? Topics/questions will be detached.')) return
                          deletePackageMutation.mutate(selectedPackageId)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    {updatePackageMutation.isError || deletePackageMutation.isError ? (
                      <div className="text-sm text-red-600">Package action failed.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Topics</div>
              <div className="grid grid-cols-1 gap-2">
                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={topicPackageId}
                  onChange={(e) => setTopicPackageId(e.target.value)}
                >
                  <option value="">No package (global)</option>
                  {(packages.data?.items ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.isHidden ? ' (hidden)' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder="New topic name"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                  />
                  <button
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    type="button"
                    disabled={createTopicMutation.isPending || topicName.trim() === ''}
                    onClick={() =>
                      createTopicMutation.mutate({
                        name: topicName.trim(),
                        packageId: topicPackageId ? topicPackageId : null,
                      })
                    }
                  >
                    Create
                  </button>
                </div>
                {createTopicMutation.isError && <div className="text-sm text-red-600">Failed to create topic.</div>}
              </div>

              <div className="max-h-44 overflow-auto rounded border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {(topics.data?.items ?? []).map((t: any) => (
                    <button
                      key={t.id}
                      type="button"
                      className={
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                        (selectedTopicId === t.id ? 'bg-slate-50' : '')
                      }
                      onClick={() => setSelectedTopicId(t.id)}
                    >
                      <div className="truncate">
                        {t.name}
                        {t.isHidden ? <span className="ml-2 text-xs text-slate-500">(hidden)</span> : null}
                      </div>
                      <div className="text-xs text-slate-500">{t.packageId ?? '—'}</div>
                    </button>
                  ))}
                  {topics.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
                  {topics.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
                </div>
              </div>

              <div className="rounded border border-slate-200 p-3">
                <div className="font-medium">Edit topic</div>
                {!selectedTopicId ? <div className="mt-1 text-sm text-slate-600">Select a topic above.</div> : null}
                {selectedTopicId ? (
                  <div className="mt-3 grid gap-2">
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editTopicName}
                      onChange={(e) => setEditTopicName(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editTopicIsHidden}
                        onChange={(e) => setEditTopicIsHidden(e.target.checked)}
                      />
                      Hidden (students won’t see it)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={updateTopicMutation.isPending || editTopicName.trim() === ''}
                        onClick={() =>
                          updateTopicMutation.mutate({
                            topicId: selectedTopicId,
                            body: { name: editTopicName.trim(), isHidden: editTopicIsHidden },
                          })
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={deleteTopicMutation.isPending}
                        onClick={() => {
                          if (!confirm('Delete this topic? Questions will be detached.')) return
                          deleteTopicMutation.mutate(selectedTopicId)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    {updateTopicMutation.isError || deleteTopicMutation.isError ? (
                      <div className="text-sm text-red-600">Topic action failed.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Difficulties</div>

              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={selectedDifficultyId}
                onChange={(e) => setSelectedDifficultyId(e.target.value)}
              >
                <option value="">Select difficulty</option>
                {(difficulties.data?.items ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName} ({d.id})
                  </option>
                ))}
              </select>

              <div className="grid gap-2 rounded border border-slate-200 p-3">
                <div className="font-medium">Edit difficulty label</div>
                {!selectedDifficultyId ? <div className="text-sm text-slate-600">Select a difficulty above.</div> : null}
                {selectedDifficultyId ? (
                  <>
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editDifficultyDisplayName}
                      onChange={(e) => setEditDifficultyDisplayName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={updateDifficultyMutation.isPending || editDifficultyDisplayName.trim() === ''}
                      onClick={() =>
                        updateDifficultyMutation.mutate({
                          difficultyId: selectedDifficultyId,
                          displayName: editDifficultyDisplayName.trim(),
                        })
                      }
                    >
                      Save label
                    </button>
                    {updateDifficultyMutation.isError ? (
                      <div className="text-sm text-red-600">Failed to update label.</div>
                    ) : null}
                  </>
                ) : null}
              </div>

              {difficulties.isLoading ? <div className="text-sm text-slate-600">Loading…</div> : null}
              {difficulties.isError ? <div className="text-sm text-red-600">Failed to load difficulties.</div> : null}
            </div>

            <div className="space-y-3">
              <div className="font-medium">Create Question</div>

              <div className="grid grid-cols-1 gap-2">
                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={createQuestion.packageId}
                  onChange={(e) => setCreateQuestion((s) => ({ ...s, packageId: e.target.value, topicId: '' }))}
                >
                  <option value="">No package</option>
                  {visiblePackagesForSelect.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={createQuestion.topicId}
                  onChange={(e) => setCreateQuestion((s) => ({ ...s, topicId: e.target.value }))}
                >
                  <option value="">No topic</option>
                  {visibleTopicsForCreate.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={createQuestion.difficultyId}
                  onChange={(e) => setCreateQuestion((s) => ({ ...s, difficultyId: e.target.value }))}
                >
                  <option value="">Select difficulty</option>
                  {(difficulties.data?.items ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.displayName}
                    </option>
                  ))}
                </select>

                <textarea
                  className="min-h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Prompt"
                  value={createQuestion.prompt}
                  onChange={(e) => setCreateQuestion((s) => ({ ...s, prompt: e.target.value }))}
                />
                <textarea
                  className="min-h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Explanation"
                  value={createQuestion.explanation}
                  onChange={(e) => setCreateQuestion((s) => ({ ...s, explanation: e.target.value }))}
                />

                <div className="space-y-2">
                  <div className="text-sm font-medium">Choices</div>
                  {createQuestion.choicesText.map((text, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="h-4 w-4"
                        type="radio"
                        name="createCorrect"
                        checked={createQuestion.correctChoiceIndex === i}
                        onChange={() => setCreateQuestion((s) => ({ ...s, correctChoiceIndex: i }))}
                      />
                      <input
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                        placeholder={`Choice ${i + 1}`}
                        value={text}
                        onChange={(e) =>
                          setCreateQuestion((s) => {
                            const next = [...s.choicesText]
                            next[i] = e.target.value
                            return { ...s, choicesText: next }
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <button
                  className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  type="button"
                  disabled={
                    createQuestionMutation.isPending ||
                    createQuestion.prompt.trim() === '' ||
                    createQuestion.difficultyId.trim() === ''
                  }
                  onClick={() =>
                    createQuestionMutation.mutate({
                      packageId: createQuestion.packageId ? createQuestion.packageId : null,
                      topicId: createQuestion.topicId ? createQuestion.topicId : null,
                      difficultyId: createQuestion.difficultyId,
                      prompt: createQuestion.prompt,
                      explanation: createQuestion.explanation,
                      choices: createQuestion.choicesText.filter((t) => t.trim() !== '').map((t) => ({ text: t })),
                      correctChoiceIndex: createQuestion.correctChoiceIndex,
                    })
                  }
                >
                  Create Draft
                </button>
                {createQuestionMutation.isError && <div className="text-sm text-red-600">Failed to create question.</div>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="font-medium">Questions</div>

              <div className="grid grid-cols-1 gap-2">
                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={questionFilters.status}
                  onChange={(e) =>
                    setQuestionFilters((s) => ({ ...s, status: e.target.value as any }))
                  }
                >
                  <option value="">Any status</option>
                  <option value="draft">Draft</option>
                  <option value="in_review">In review</option>
                  <option value="needs_changes">Needs changes</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={questionFilters.packageId}
                  onChange={(e) => setQuestionFilters((s) => ({ ...s, packageId: e.target.value, topicId: '' }))}
                >
                  <option value="">Any package</option>
                  {visiblePackagesForSelect.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={questionFilters.topicId}
                  onChange={(e) => setQuestionFilters((s) => ({ ...s, topicId: e.target.value }))}
                >
                  <option value="">Any topic</option>
                  {visibleTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={questionFilters.difficultyId}
                  onChange={(e) => setQuestionFilters((s) => ({ ...s, difficultyId: e.target.value }))}
                >
                  <option value="">Any difficulty</option>
                  {(difficulties.data?.items ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-56 overflow-auto rounded border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {(questions.data?.items ?? []).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className={
                        'block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                        (selectedQuestionId === q.id ? 'bg-slate-50' : '')
                      }
                      onClick={() => {
                        setSelectedQuestionId(q.id)
                        setEditQuestion(null)
                      }}
                    >
                      <div className="truncate font-medium">{q.prompt}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        id={q.id} difficulty={difficultiesById.get(q.difficultyId) ?? q.difficultyId}
                      </div>
                    </button>
                  ))}
                  {questions.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
                  {questions.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Selected Question</div>
                  <div className="text-sm text-slate-600">
                    {selectedQuestionId ? `Status: ${compactStatusLabel(selectedQuestionStatus)}` : 'Pick a question.'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    type="button"
                    disabled={!selectedQuestionId || statusMutation.isPending}
                    onClick={() => selectedQuestionId && statusMutation.mutate({ action: 'draft', questionId: selectedQuestionId })}
                  >
                    Draft
                  </button>
                  <button
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    type="button"
                    disabled={!selectedQuestionId || statusMutation.isPending}
                    onClick={() => selectedQuestionId && statusMutation.mutate({ action: 'publish', questionId: selectedQuestionId })}
                  >
                    Publish
                  </button>
                  <button
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    type="button"
                    disabled={!selectedQuestionId || statusMutation.isPending}
                    onClick={() => selectedQuestionId && statusMutation.mutate({ action: 'archive', questionId: selectedQuestionId })}
                  >
                    Archive
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2">
                <div className="text-sm font-medium">Review workflow</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={!selectedQuestionId || submitForReviewMutation.isPending}
                    onClick={() => selectedQuestionId && submitForReviewMutation.mutate(selectedQuestionId)}
                  >
                    Submit for review
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={!selectedQuestionId || approveQuestionMutation.isPending}
                    onClick={() => selectedQuestionId && approveQuestionMutation.mutate(selectedQuestionId)}
                  >
                    Approve
                  </button>
                </div>

                <div className="grid gap-2">
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Request changes note (optional)"
                    value={reviewRequestNote}
                    onChange={(e) => setReviewRequestNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    disabled={!selectedQuestionId || requestChangesMutation.isPending}
                    onClick={() => selectedQuestionId && requestChangesMutation.mutate({ questionId: selectedQuestionId, note: reviewRequestNote })}
                  >
                    Request changes
                  </button>
                </div>

                {(submitForReviewMutation.isError || approveQuestionMutation.isError || requestChangesMutation.isError) ? (
                  <div className="text-sm text-red-600">Review action failed (check state/permissions).</div>
                ) : null}
              </div>

              {selectedQuestion.isLoading && <div className="text-sm text-slate-600">Loading…</div>}
              {selectedQuestion.isError && <div className="text-sm text-red-600">Failed to load question.</div>}

              {editQuestion && (
                <div className="space-y-3">
                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editQuestion.packageId}
                    onChange={(e) => setEditQuestion((s) => (s ? { ...s, packageId: e.target.value, topicId: '' } : s))}
                  >
                    <option value="">No package</option>
                    {visiblePackagesForSelect.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editQuestion.topicId}
                    onChange={(e) => setEditQuestion((s) => (s ? { ...s, topicId: e.target.value } : s))}
                  >
                    <option value="">No topic</option>
                    {(topics.data?.items ?? [])
                      .filter((t: any) => !t.isHidden)
                      .filter((t) => (editQuestion.packageId ? t.packageId === editQuestion.packageId : true))
                      .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editQuestion.difficultyId}
                    onChange={(e) => setEditQuestion((s) => (s ? { ...s, difficultyId: e.target.value } : s))}
                  >
                    <option value="">Select difficulty</option>
                    {(difficulties.data?.items ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.displayName}
                      </option>
                    ))}
                  </select>

                  <textarea
                    className="min-h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editQuestion.prompt}
                    onChange={(e) => setEditQuestion((s) => (s ? { ...s, prompt: e.target.value } : s))}
                  />
                  <textarea
                    className="min-h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    value={editQuestion.explanation}
                    onChange={(e) => setEditQuestion((s) => (s ? { ...s, explanation: e.target.value } : s))}
                  />

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Choices</div>
                    {editQuestion.choicesText.map((text, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          className="h-4 w-4"
                          type="radio"
                          name="editCorrect"
                          checked={editQuestion.correctChoiceIndex === i}
                          onChange={() => setEditQuestion((s) => (s ? { ...s, correctChoiceIndex: i } : s))}
                        />
                        <input
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          value={text}
                          onChange={(e) =>
                            setEditQuestion((s) => {
                              if (!s) return s
                              const next = [...s.choicesText]
                              next[i] = e.target.value
                              return { ...s, choicesText: next }
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      type="button"
                      disabled={!selectedQuestionId || updateQuestionMutation.isPending}
                      onClick={() => {
                        if (!selectedQuestionId || !editQuestion) return
                        updateQuestionMutation.mutate({
                          questionId: selectedQuestionId,
                          body: {
                            packageId: editQuestion.packageId ? editQuestion.packageId : null,
                            topicId: editQuestion.topicId ? editQuestion.topicId : null,
                            difficultyId: editQuestion.difficultyId,
                            prompt: editQuestion.prompt,
                            explanation: editQuestion.explanation,
                          },
                        })
                      }}
                    >
                      Save Fields
                    </button>
                    <button
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      type="button"
                      disabled={!selectedQuestionId || replaceChoicesMutation.isPending}
                      onClick={() => {
                        if (!selectedQuestionId || !editQuestion) return
                        replaceChoicesMutation.mutate({
                          questionId: selectedQuestionId,
                          body: {
                            choices: editQuestion.choicesText.filter((t) => t.trim() !== '').map((t) => ({ text: t })),
                            correctChoiceIndex: editQuestion.correctChoiceIndex,
                          },
                        })
                      }}
                    >
                      Save Choices
                    </button>
                  </div>

                  {(updateQuestionMutation.isError || replaceChoicesMutation.isError || statusMutation.isError) && (
                    <div className="text-sm text-red-600">Update failed (check permissions / validation).</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
