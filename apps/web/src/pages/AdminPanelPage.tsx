import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import {
  getHealthz,
  instructorArchiveQuestion,
  instructorCreateQuestion,
  instructorCreateQuestionPackage,
  instructorCreateQuestionTopic,
  instructorDraftQuestion,
  instructorGetQuestion,
  instructorListQuestionPackages,
  instructorListQuestionTopics,
  instructorListQuestions,
  instructorPublishQuestion,
  instructorReplaceChoices,
  instructorUpdateQuestion,
  listQuestionDifficulties,
} from '@/api/endpoints'

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
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return status
}

export function AdminPanelPage() {
  const queryClient = useQueryClient()

  const health = useQuery({
    queryKey: ['healthz'],
    queryFn: getHealthz,
    refetchInterval: 15_000,
  })

  const [packageName, setPackageName] = useState('')
  const [topicName, setTopicName] = useState('')
  const [topicPackageId, setTopicPackageId] = useState('')

  const [questionFilters, setQuestionFilters] = useState<{
    status: '' | 'draft' | 'published' | 'archived'
    packageId: string
    topicId: string
    difficultyId: string
  }>({ status: 'draft', packageId: '', topicId: '', difficultyId: '' })

  const [createQuestion, setCreateQuestion] = useState<CreateQuestionFormState>({
    packageId: '',
    topicId: '',
    difficultyId: 'easy',
    prompt: '',
    explanation: '',
    choicesText: ['', '', '', ''],
    correctChoiceIndex: 0,
  })

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('')
  const [editQuestion, setEditQuestion] = useState<EditQuestionFormState | null>(null)

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
    queryFn: listQuestionDifficulties,
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
    const items = topics.data?.items ?? []
    if (questionFilters.packageId) return items.filter((t) => t.packageId === questionFilters.packageId)
    return items
  }, [topics.data?.items, questionFilters.packageId])

  const visibleTopicsForCreate = useMemo(() => {
    const items = topics.data?.items ?? []
    if (createQuestion.packageId) return items.filter((t) => t.packageId === createQuestion.packageId)
    return items
  }, [topics.data?.items, createQuestion.packageId])

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
        difficultyId: 'easy',
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

  // Keep edit form in sync when selection changes.
  if (selectedQuestion.data && editQuestion == null) {
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
  }

  const selectedQuestionStatus = selectedQuestion.data?.status

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Admin Panel</h2>
        <p className="text-sm text-slate-600">System monitoring and export hooks (contract-first).</p>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">API Gateway Health</div>
            <div className="mt-1 text-sm text-slate-600">
              {health.isLoading && 'Loading…'}
              {health.isError && 'Error contacting gateway.'}
              {health.data && `status=${health.data.status} ts=${health.data.ts}`}
            </div>
          </div>
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            type="button"
            onClick={() => alert('Export endpoint scaffolded in OpenAPI; wire when backend is ready.')}
          >
            Export Data
          </button>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="font-medium">Monitoring</div>
        <div className="mt-1 text-sm text-slate-600">Next: surface metrics, queue depth, and active sessions.</div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="space-y-1">
          <div className="font-medium">Question Bank</div>
          <div className="text-sm text-slate-600">Create packages, topics, and manage questions.</div>
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
                  {(packages.data?.items ?? []).map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="truncate">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.id}</div>
                    </div>
                  ))}
                  {packages.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
                  {packages.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
                </div>
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
                  {(packages.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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
                  {(topics.data?.items ?? []).map((t) => (
                    <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="truncate">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.packageId ?? '—'}</div>
                    </div>
                  ))}
                  {topics.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
                  {topics.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
                </div>
              </div>
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
                  {(packages.data?.items ?? []).map((p) => (
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
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={questionFilters.packageId}
                  onChange={(e) => setQuestionFilters((s) => ({ ...s, packageId: e.target.value, topicId: '' }))}
                >
                  <option value="">Any package</option>
                  {(packages.data?.items ?? []).map((p) => (
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
                      <div className="mt-1 text-xs text-slate-500">id={q.id} difficulty={q.difficultyId}</div>
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
                    {(packages.data?.items ?? []).map((p) => (
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
                    {(topics.data?.items ?? []).filter((t) => (editQuestion.packageId ? t.packageId === editQuestion.packageId : true)).map((t) => (
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
    </div>
  )
}
