import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import {
  instructorCreatePracticeTemplate,
  instructorDeletePracticeTemplate,
  instructorListPracticeTemplates,
  instructorPublishPracticeTemplate,
  instructorUnpublishPracticeTemplate,
  instructorUpdateExamPackage,
  instructorUpdatePracticeTemplate,
  listExamPackages,
  listQuestionBanks,
  listQuestionDifficulties,
  listQuestionTopics,
  type PracticeTemplate,
} from '@/api/endpoints'

type TemplateFormState = {
  name: string
  section: string
  topicId: string
  difficultyId: string
  isTimed: boolean
  targetCount: string
  sortOrder: string
}

function clampInt(v: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function sortTemplates(a: PracticeTemplate, b: PracticeTemplate) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return String(a.createdAt).localeCompare(String(b.createdAt))
}

export function PracticeTemplatesManager(props: { title?: string; subtitle?: string }) {
  const queryClient = useQueryClient()

  const parseLines = (v: string) =>
    v
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

  const packagesQuery = useQuery({
    queryKey: ['exam-packages'],
    queryFn: () => listExamPackages(),
    refetchOnWindowFocus: false,
  })

  const questionBanksQuery = useQuery({
    queryKey: ['question-banks'],
    queryFn: () => listQuestionBanks(),
    refetchOnWindowFocus: false,
  })

  const [examPackageId, setExamPackageId] = useState('')

  useEffect(() => {
    if (examPackageId) return
    const first = packagesQuery.data?.items?.[0]
    if (first?.id) setExamPackageId(first.id)
  }, [examPackageId, packagesQuery.data])

  const questionBankId = useMemo(() => {
    if (!examPackageId) return ''
    const banks = questionBanksQuery.data?.items ?? []
    return banks.find((b) => b.examPackageId === examPackageId)?.id ?? ''
  }, [examPackageId, questionBanksQuery.data])

  const topicsQuery = useQuery({
    queryKey: ['question-topics', { questionBankId }],
    queryFn: () => listQuestionTopics({ questionBankId }),
    enabled: Boolean(questionBankId),
    refetchOnWindowFocus: false,
  })

  const difficultiesQuery = useQuery({
    queryKey: ['question-difficulties'],
    queryFn: () => listQuestionDifficulties(),
    refetchOnWindowFocus: false,
  })

  const templatesQuery = useQuery({
    queryKey: ['instructor', 'practice-templates', { examPackageId }],
    queryFn: () => instructorListPracticeTemplates({ examPackageId, includeUnpublished: true }),
    enabled: Boolean(examPackageId),
    refetchOnWindowFocus: false,
  })

  const templates = useMemo(() => {
    const items = templatesQuery.data?.items ?? []
    return [...items].sort(sortTemplates)
  }, [templatesQuery.data])

  const topicsById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; isHidden?: boolean }>()
    for (const t of topicsQuery.data?.items ?? []) map.set(t.id, t as any)
    return map
  }, [topicsQuery.data])

  const difficultiesById = useMemo(() => {
    const map = new Map<string, { id: string; displayName: string }>()
    for (const d of difficultiesQuery.data?.items ?? []) map.set(d.id, d as any)
    return map
  }, [difficultiesQuery.data])

  const [createForm, setCreateForm] = useState<TemplateFormState>({
    name: '',
    section: '',
    topicId: '',
    difficultyId: '',
    isTimed: false,
    targetCount: '20',
    sortOrder: '0',
  })
  const [createPublish, setCreatePublish] = useState(false)

  const createMutation = useMutation({
    mutationFn: async () => {
      const targetCount = clampInt(createForm.targetCount, 1, 50, 20)
      const sortOrder = clampInt(createForm.sortOrder, 0, 1_000_000, 0)

      const created = await instructorCreatePracticeTemplate({
        examPackageId,
        name: createForm.name.trim(),
        section: createForm.section.trim(),
        topicId: createForm.topicId ? createForm.topicId : null,
        difficultyId: createForm.difficultyId ? createForm.difficultyId : null,
        isTimed: createForm.isTimed,
        targetCount,
        sortOrder,
      })

      if (createPublish) {
        await instructorPublishPracticeTemplate(created.id)
      }

      return created
    },
    onSuccess: async () => {
      setCreateForm({
        name: '',
        section: '',
        topicId: '',
        difficultyId: '',
        isTimed: false,
        targetCount: '20',
        sortOrder: '0',
      })
      setCreatePublish(false)
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'practice-templates'] })
    },
  })

  const [editingTemplateId, setEditingTemplateId] = useState<string>('')
  const editingTemplate = useMemo(() => templates.find((t) => t.id === editingTemplateId) ?? null, [templates, editingTemplateId])

  const [editForm, setEditForm] = useState<TemplateFormState | null>(null)

  useEffect(() => {
    if (!editingTemplate) {
      setEditForm(null)
      return
    }

    setEditForm({
      name: editingTemplate.name ?? '',
      section: editingTemplate.section ?? '',
      topicId: editingTemplate.topicId ?? '',
      difficultyId: editingTemplate.difficultyId ?? '',
      isTimed: Boolean(editingTemplate.isTimed),
      targetCount: String(editingTemplate.targetCount ?? 20),
      sortOrder: String(editingTemplate.sortOrder ?? 0),
    })
  }, [editingTemplate])

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTemplate) throw new Error('No template selected')
      if (!editForm) throw new Error('No edit form')

      const targetCount = clampInt(editForm.targetCount, 1, 50, 20)
      const sortOrder = clampInt(editForm.sortOrder, 0, 1_000_000, 0)

      return instructorUpdatePracticeTemplate(editingTemplate.id, {
        name: editForm.name.trim(),
        section: editForm.section.trim(),
        topicId: editForm.topicId ? editForm.topicId : null,
        difficultyId: editForm.difficultyId ? editForm.difficultyId : null,
        isTimed: editForm.isTimed,
        targetCount,
        sortOrder,
      })
    },
    onSuccess: async () => {
      setEditingTemplateId('')
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'practice-templates'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => instructorDeletePracticeTemplate(templateId),
    onSuccess: async () => {
      setEditingTemplateId('')
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'practice-templates'] })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (templateId: string) => instructorPublishPracticeTemplate(templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'practice-templates'] })
      await queryClient.invalidateQueries({ queryKey: ['practice-templates'] })
    },
  })

  const unpublishMutation = useMutation({
    mutationFn: async (templateId: string) => instructorUnpublishPracticeTemplate(templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'practice-templates'] })
      await queryClient.invalidateQueries({ queryKey: ['practice-templates'] })
    },
  })

  const canCreate = Boolean(examPackageId) && createForm.name.trim() && createForm.section.trim()

  const selectedExamPackage = useMemo(() => {
    const items = packagesQuery.data?.items ?? []
    return items.find((p) => p.id === examPackageId) ?? null
  }, [examPackageId, packagesQuery.data])

  const [pkgSubtitle, setPkgSubtitle] = useState('')
  const [pkgOverview, setPkgOverview] = useState('')
  const [pkgModulesText, setPkgModulesText] = useState('')
  const [pkgHighlightsText, setPkgHighlightsText] = useState('')
  const [pkgModuleSectionsJson, setPkgModuleSectionsJson] = useState('[]')
  const [pkgModuleSectionsError, setPkgModuleSectionsError] = useState('')

  useEffect(() => {
    if (!selectedExamPackage) return
    setPkgSubtitle(String((selectedExamPackage as any).subtitle ?? ''))
    setPkgOverview(String((selectedExamPackage as any).overview ?? ''))
    setPkgModulesText(Array.isArray((selectedExamPackage as any).modules) ? (selectedExamPackage as any).modules.join('\n') : '')
    setPkgHighlightsText(
      Array.isArray((selectedExamPackage as any).highlights) ? (selectedExamPackage as any).highlights.join('\n') : '',
    )
    setPkgModuleSectionsJson(
      JSON.stringify(Array.isArray((selectedExamPackage as any).moduleSections) ? (selectedExamPackage as any).moduleSections : [], null, 2),
    )
    setPkgModuleSectionsError('')
  }, [selectedExamPackage?.id])

  const updatePackageMutation = useMutation({
    mutationFn: async () => {
      if (!examPackageId) throw new Error('No exam package selected')

      setPkgModuleSectionsError('')

      let moduleSections: any[] = []
      const raw = pkgModuleSectionsJson.trim()
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (!Array.isArray(parsed)) {
            setPkgModuleSectionsError('Module sections must be a JSON array.')
            throw new Error('Invalid module sections')
          }
          moduleSections = parsed
        } catch {
          setPkgModuleSectionsError('Module sections must be valid JSON.')
          throw new Error('Invalid module sections')
        }
      }

      return instructorUpdateExamPackage(examPackageId, {
        subtitle: pkgSubtitle.trim() ? pkgSubtitle.trim() : null,
        overview: pkgOverview.trim() ? pkgOverview.trim() : null,
        modules: parseLines(pkgModulesText),
        highlights: parseLines(pkgHighlightsText),
        moduleSections,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exam-packages'] })
    },
  })

  return (
    <div className="space-y-6">
      {props.title ? (
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{props.title}</h1>
          {props.subtitle ? <p className="text-sm text-slate-600">{props.subtitle}</p> : null}
        </div>
      ) : null}

      <div className="rounded border border-slate-200 p-4">
        <div className="space-y-2">
          <div className="font-medium">Exam package</div>
          {packagesQuery.isLoading ? <div className="text-sm text-slate-600">Loading packages…</div> : null}
          {packagesQuery.isError ? <div className="text-sm text-rose-700">Failed to load packages.</div> : null}
          {packagesQuery.data ? (
            <select
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={examPackageId}
              onChange={(e) => setExamPackageId(e.target.value)}
            >
              {(packagesQuery.data.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="text-xs text-slate-500">
            {questionBankId ? 'Topics are filtered by the linked question bank.' : 'No question bank is linked to this package (topics will be unavailable).'}
          </div>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="space-y-1">
          <div className="font-medium">Exam package content</div>
          <div className="text-sm text-slate-600">Edits are visible to students via the package details page.</div>
        </div>

        {!examPackageId ? <div className="mt-3 text-sm text-slate-600">Select an exam package above.</div> : null}

        {examPackageId ? (
          <div className="mt-4 grid gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Subtitle (optional)"
              value={pkgSubtitle}
              onChange={(e) => setPkgSubtitle(e.target.value)}
            />

            <textarea
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Overview (optional)"
              rows={4}
              value={pkgOverview}
              onChange={(e) => setPkgOverview(e.target.value)}
            />

            <textarea
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Modules (one per line)"
              rows={4}
              value={pkgModulesText}
              onChange={(e) => setPkgModulesText(e.target.value)}
            />

            <textarea
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Highlights (one per line)"
              rows={4}
              value={pkgHighlightsText}
              onChange={(e) => setPkgHighlightsText(e.target.value)}
            />

            <textarea
              className="w-full rounded border border-slate-200 px-3 py-2 font-mono text-sm"
              placeholder='Module sections JSON (e.g. [{"id":"reading","name":"Reading","description":"..."}])'
              rows={6}
              value={pkgModuleSectionsJson}
              onChange={(e) => setPkgModuleSectionsJson(e.target.value)}
            />
            {pkgModuleSectionsError ? <div className="text-sm text-rose-700">{pkgModuleSectionsError}</div> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={updatePackageMutation.isPending}
                onClick={() => updatePackageMutation.mutate()}
              >
                Save
              </button>
            </div>
            {updatePackageMutation.isError ? (
              <div className="text-sm text-rose-700">Failed to update exam package.</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="space-y-1">
          <div className="font-medium">Create practice test</div>
          <div className="text-sm text-slate-600">Defines a reusable practice configuration for students.</div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Name (e.g., Reading Test 1)"
            value={createForm.name}
            onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
          />

          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Section (e.g., Reading)"
            value={createForm.section}
            onChange={(e) => setCreateForm((s) => ({ ...s, section: e.target.value }))}
          />

          <select
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={createForm.topicId}
            onChange={(e) => setCreateForm((s) => ({ ...s, topicId: e.target.value }))}
            disabled={!questionBankId}
          >
            <option value="">Any topic</option>
            {(topicsQuery.data?.items ?? [])
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.isHidden ? ' (hidden)' : ''}
                </option>
              ))}
          </select>

          <select
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={createForm.difficultyId}
            onChange={(e) => setCreateForm((s) => ({ ...s, difficultyId: e.target.value }))}
          >
            <option value="">Any difficulty</option>
            {(difficultiesQuery.data?.items ?? [])
              .slice()
              .sort((a, b) => String((a as any).displayName ?? '').localeCompare(String((b as any).displayName ?? '')))
              .map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createForm.isTimed}
              onChange={(e) => setCreateForm((s) => ({ ...s, isTimed: e.target.checked }))}
            />
            Timed
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createPublish} onChange={(e) => setCreatePublish(e.target.checked)} />
            Publish immediately
          </label>

          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Question count (1-50)"
            inputMode="numeric"
            value={createForm.targetCount}
            onChange={(e) => setCreateForm((s) => ({ ...s, targetCount: e.target.value }))}
          />

          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Sort order (0+)"
            inputMode="numeric"
            value={createForm.sortOrder}
            onChange={(e) => setCreateForm((s) => ({ ...s, sortOrder: e.target.value }))}
          />
        </div>

        {createMutation.isError ? <div className="mt-3 text-sm text-rose-700">Failed to create practice test.</div> : null}

        <div className="mt-4">
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={createMutation.isPending || !canCreate}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Practice tests</div>
            <div className="mt-1 text-sm text-slate-600">Published items show up on the student Practice page.</div>
          </div>
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['instructor', 'practice-templates'] })}
            disabled={templatesQuery.isFetching}
          >
            Refresh
          </button>
        </div>

        {templatesQuery.isLoading ? <div className="mt-3 text-sm text-slate-600">Loading…</div> : null}
        {templatesQuery.isError ? <div className="mt-3 text-sm text-rose-700">Failed to load practice tests.</div> : null}

        {templates.length === 0 && templatesQuery.data ? <div className="mt-3 text-sm text-slate-600">No practice tests yet.</div> : null}

        {templates.length ? (
          <ul className="mt-4 space-y-2">
            {templates.map((t) => {
              const topicName = t.topicId ? topicsById.get(t.topicId)?.name ?? t.topicName : null
              const difficultyName = t.difficultyId ? difficultiesById.get(t.difficultyId)?.displayName ?? t.difficultyName : null

              const isEditing = t.id === editingTemplateId

              return (
                <li key={t.id} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium">{t.name}</div>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{t.section}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {t.isTimed ? 'Timed' : 'Untimed'} • {t.targetCount} Q
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Sort {t.sortOrder}</span>
                        {difficultyName ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{difficultyName}</span>
                        ) : null}
                        {topicName ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{topicName}</span>
                        ) : null}
                        <span
                          className={[
                            'rounded px-2 py-0.5 text-xs',
                            t.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700',
                          ].join(' ')}
                        >
                          {t.isPublished ? 'Published' : 'Unpublished'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Updated {new Date(t.updatedAt).toLocaleString()}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {t.isPublished ? (
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={unpublishMutation.isPending}
                          onClick={() => unpublishMutation.mutate(t.id)}
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(t.id)}
                        >
                          Publish
                        </button>
                      )}

                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => setEditingTemplateId((cur) => (cur === t.id ? '' : t.id))}
                        disabled={updateMutation.isPending}
                      >
                        {isEditing ? 'Close' : 'Edit'}
                      </button>

                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (!confirm('Delete this practice test?')) return
                          deleteMutation.mutate(t.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isEditing && editForm ? (
                    <div className="mt-4 rounded border border-slate-200 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          value={editForm.name}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, name: e.target.value } : s))}
                        />

                        <input
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          value={editForm.section}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, section: e.target.value } : s))}
                        />

                        <select
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          value={editForm.topicId}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, topicId: e.target.value } : s))}
                          disabled={!questionBankId}
                        >
                          <option value="">Any topic</option>
                          {(topicsQuery.data?.items ?? [])
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((topic) => (
                              <option key={topic.id} value={topic.id}>
                                {topic.name}{topic.isHidden ? ' (hidden)' : ''}
                              </option>
                            ))}
                        </select>

                        <select
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          value={editForm.difficultyId}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, difficultyId: e.target.value } : s))}
                        >
                          <option value="">Any difficulty</option>
                          {(difficultiesQuery.data?.items ?? [])
                            .slice()
                            .sort((a, b) => String((a as any).displayName ?? '').localeCompare(String((b as any).displayName ?? '')))
                            .map((d: any) => (
                              <option key={d.id} value={d.id}>
                                {d.displayName}
                              </option>
                            ))}
                        </select>

                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.isTimed}
                            onChange={(e) => setEditForm((s) => (s ? { ...s, isTimed: e.target.checked } : s))}
                          />
                          Timed
                        </label>

                        <div />

                        <input
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          inputMode="numeric"
                          value={editForm.targetCount}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, targetCount: e.target.value } : s))}
                        />

                        <input
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          inputMode="numeric"
                          value={editForm.sortOrder}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, sortOrder: e.target.value } : s))}
                        />
                      </div>

                      {updateMutation.isError ? <div className="mt-3 text-sm text-rose-700">Failed to update template.</div> : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={
                            updateMutation.isPending || !editForm.name.trim() || !editForm.section.trim() || clampInt(editForm.targetCount, 1, 50, 0) === 0
                          }
                          onClick={() => updateMutation.mutate()}
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => setEditingTemplateId('')}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
