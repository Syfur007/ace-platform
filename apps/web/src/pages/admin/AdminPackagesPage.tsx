import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  adminCreateExamPackage,
  adminCreateExamPackageTier,
  adminDeleteExamPackage,
  adminDeleteExamPackageTier,
  adminListExamPackageTiers,
  adminListExamPackages,
  adminUpdateExamPackage,
  adminUpdateExamPackageTier,
  type AdminUpdateExamPackageRequest,
} from '@/api/endpoints'
import type { ApiError } from '@/api/http'

function parseLines(v: string): string[] {
  return v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function AdminPackagesPage() {
  const queryClient = useQueryClient()

  const packagesQuery = useQuery({
    queryKey: ['admin', 'exam-packages'],
    queryFn: adminListExamPackages,
    refetchOnWindowFocus: false,
  })

  const [newPackageName, setNewPackageName] = useState('')

  const createPackageMutation = useMutation({
    mutationFn: adminCreateExamPackage,
    onSuccess: async () => {
      setNewPackageName('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-packages'] })
    },
  })

  const deletePackageMutation = useMutation({
    mutationFn: adminDeleteExamPackage,
    onSuccess: async () => {
      setSelectedExamPackageId('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-packages'] })
    },
  })

  const [selectedExamPackageId, setSelectedExamPackageId] = useState('')

  const selectedPackage = useMemo(() => {
    return (packagesQuery.data?.items ?? []).find((p: any) => p.id === selectedExamPackageId) ?? null
  }, [packagesQuery.data?.items, selectedExamPackageId])

  const [editName, setEditName] = useState('')
  const [editSubtitle, setEditSubtitle] = useState('')
  const [editOverview, setEditOverview] = useState('')
  const [editIsHidden, setEditIsHidden] = useState(false)
  const [editModulesText, setEditModulesText] = useState('')
  const [editHighlightsText, setEditHighlightsText] = useState('')
  const [editModuleSectionsJson, setEditModuleSectionsJson] = useState('[]')
  const [editModuleSectionsError, setEditModuleSectionsError] = useState('')

  useEffect(() => {
    if (!selectedPackage) return
    setEditName(String(selectedPackage.name ?? ''))
    setEditSubtitle(String(selectedPackage.subtitle ?? ''))
    setEditOverview(String(selectedPackage.overview ?? ''))
    setEditIsHidden(Boolean(selectedPackage.isHidden))
    setEditModulesText(Array.isArray(selectedPackage.modules) ? selectedPackage.modules.join('\n') : '')
    setEditHighlightsText(Array.isArray(selectedPackage.highlights) ? selectedPackage.highlights.join('\n') : '')
    setEditModuleSectionsJson(
      JSON.stringify(Array.isArray(selectedPackage.moduleSections) ? selectedPackage.moduleSections : [], null, 2),
    )
    setEditModuleSectionsError('')
  }, [selectedPackage?.id])

  const updatePackageMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; body: AdminUpdateExamPackageRequest }) =>
      adminUpdateExamPackage(input.examPackageId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-packages'] })
    },
  })

  const tiersQuery = useQuery({
    queryKey: ['admin', 'exam-package-tiers', selectedExamPackageId],
    queryFn: () => adminListExamPackageTiers(selectedExamPackageId),
    enabled: Boolean(selectedExamPackageId),
    refetchOnWindowFocus: false,
  })

  const [selectedTierId, setSelectedTierId] = useState('')

  useEffect(() => {
    setSelectedTierId('')
  }, [selectedExamPackageId])

  const selectedTier = useMemo(() => {
    return (tiersQuery.data?.items ?? []).find((t: any) => t.id === selectedTierId) ?? null
  }, [tiersQuery.data?.items, selectedTierId])

  const [newTierCode, setNewTierCode] = useState('')
  const [newTierName, setNewTierName] = useState('')
  const [newTierSortOrder, setNewTierSortOrder] = useState<string>('')
  const [newTierIsDefault, setNewTierIsDefault] = useState(false)
  const [newTierIsActive, setNewTierIsActive] = useState(true)
  const [newTierPolicyJson, setNewTierPolicyJson] = useState('{}')
  const [newTierPolicyError, setNewTierPolicyError] = useState('')

  const createTierMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; body: any }) => adminCreateExamPackageTier(input.examPackageId, input.body),
    onSuccess: async () => {
      setNewTierCode('')
      setNewTierName('')
      setNewTierSortOrder('')
      setNewTierIsDefault(false)
      setNewTierIsActive(true)
      setNewTierPolicyJson('{}')
      setNewTierPolicyError('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-package-tiers', selectedExamPackageId] })
    },
  })

  const updateTierMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; tierId: string; body: any }) =>
      adminUpdateExamPackageTier(input.examPackageId, input.tierId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-package-tiers', selectedExamPackageId] })
    },
  })

  const deleteTierMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; tierId: string }) =>
      adminDeleteExamPackageTier(input.examPackageId, input.tierId),
    onSuccess: async () => {
      setSelectedTierId('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-package-tiers', selectedExamPackageId] })
    },
  })

  const [editTierCode, setEditTierCode] = useState('')
  const [editTierName, setEditTierName] = useState('')
  const [editTierSortOrder, setEditTierSortOrder] = useState<string>('')
  const [editTierIsDefault, setEditTierIsDefault] = useState(false)
  const [editTierIsActive, setEditTierIsActive] = useState(true)
  const [editTierPolicyJson, setEditTierPolicyJson] = useState('{}')
  const [editTierPolicyError, setEditTierPolicyError] = useState('')

  useEffect(() => {
    if (!selectedTier) return
    setEditTierCode(String(selectedTier.code ?? ''))
    setEditTierName(String(selectedTier.name ?? ''))
    setEditTierSortOrder(String(selectedTier.sortOrder ?? 0))
    setEditTierIsDefault(Boolean(selectedTier.isDefault))
    setEditTierIsActive(Boolean(selectedTier.isActive))
    setEditTierPolicyJson(JSON.stringify(selectedTier.policy ?? {}, null, 2))
    setEditTierPolicyError('')
  }, [selectedTier?.id])

  const tiers = tiersQuery.data?.items ?? []

  const packagesError = packagesQuery.error as ApiError | null
  const tiersError = tiersQuery.error as ApiError | null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Packages &amp; Tiers</h1>
        <div className="text-sm text-slate-600">Manage exam packages and their tier system.</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded border border-slate-200 p-4">
          <div className="text-sm font-medium">Exam packages</div>

          <div className="mt-3 flex gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="New package name"
              value={newPackageName}
              onChange={(e) => setNewPackageName(e.target.value)}
            />
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={createPackageMutation.isPending || newPackageName.trim() === ''}
              onClick={() => createPackageMutation.mutate({ name: newPackageName.trim() })}
            >
              Create
            </button>
          </div>

          {packagesQuery.isLoading ? <div className="mt-3 text-sm text-slate-600">Loading…</div> : null}
          {packagesQuery.isError ? (
            <div className="mt-3 text-sm text-red-600">Failed to load packages: {packagesError?.message ?? 'error'}</div>
          ) : null}

          <div className="mt-3 max-h-96 overflow-auto rounded border border-slate-200">
            <div className="divide-y divide-slate-100">
              {(packagesQuery.data?.items ?? []).map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  className={
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                    (selectedExamPackageId === p.id ? 'bg-slate-50' : '')
                  }
                  onClick={() => setSelectedExamPackageId(p.id)}
                >
                  <div className="truncate">
                    {p.name}
                    {p.code ? <span className="ml-2 text-xs text-slate-500">({p.code})</span> : null}
                  </div>
                  {p.isHidden ? <span className="text-xs text-slate-500">Hidden</span> : null}
                </button>
              ))}
              {(packagesQuery.data?.items ?? []).length === 0 && !packagesQuery.isLoading ? (
                <div className="px-3 py-2 text-sm text-slate-600">No packages yet.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-200 p-4 lg:col-span-2">
          {!selectedPackage ? (
            <div className="text-sm text-slate-600">Select a package to edit and manage tiers.</div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Package</div>
                    <div className="text-xs text-slate-500">{selectedPackage.id}</div>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={deletePackageMutation.isPending}
                    onClick={() => deletePackageMutation.mutate(selectedPackage.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Name</span>
                    <input
                      className="rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>

                  <label className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={editIsHidden}
                      onChange={(e) => setEditIsHidden(e.target.checked)}
                    />
                    <span className="text-sm">Hidden</span>
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs text-slate-600">Subtitle</span>
                    <input
                      className="rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editSubtitle}
                      onChange={(e) => setEditSubtitle(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs text-slate-600">Overview</span>
                    <textarea
                      className="min-h-20 rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editOverview}
                      onChange={(e) => setEditOverview(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Modules (one per line)</span>
                    <textarea
                      className="min-h-28 rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editModulesText}
                      onChange={(e) => setEditModulesText(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Highlights (one per line)</span>
                    <textarea
                      className="min-h-28 rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editHighlightsText}
                      onChange={(e) => setEditHighlightsText(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs text-slate-600">Module sections (JSON)</span>
                    <textarea
                      className={
                        'min-h-36 rounded border px-3 py-2 font-mono text-xs ' +
                        (editModuleSectionsError ? 'border-red-300' : 'border-slate-200')
                      }
                      value={editModuleSectionsJson}
                      onChange={(e) => {
                        setEditModuleSectionsJson(e.target.value)
                        setEditModuleSectionsError('')
                      }}
                    />
                    {editModuleSectionsError ? (
                      <div className="text-xs text-red-600">{editModuleSectionsError}</div>
                    ) : null}
                  </label>
                </div>

                {updatePackageMutation.isError ? (
                  <div className="text-sm text-red-600">Failed to update package.</div>
                ) : null}

                <button
                  type="button"
                  className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={updatePackageMutation.isPending || editName.trim() === ''}
                  onClick={() => {
                    let moduleSections: any[] | null = null
                    try {
                      const parsed = JSON.parse(editModuleSectionsJson || '[]')
                      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
                      moduleSections = parsed
                      setEditModuleSectionsError('')
                    } catch (e: any) {
                      setEditModuleSectionsError(e?.message ?? 'Invalid JSON')
                      return
                    }

                    updatePackageMutation.mutate({
                      examPackageId: selectedPackage.id,
                      body: {
                        name: editName.trim(),
                        subtitle: editSubtitle,
                        overview: editOverview,
                        isHidden: editIsHidden,
                        modules: parseLines(editModulesText),
                        highlights: parseLines(editHighlightsText),
                        moduleSections,
                      },
                    })
                  }}
                >
                  Save package
                </button>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="text-sm font-medium">Tiers</div>
                <div className="mt-2 text-sm text-slate-600">
                  Tier changes affect new sessions only; existing sessions keep their tier snapshot.
                </div>

                {tiersQuery.isLoading ? <div className="mt-3 text-sm text-slate-600">Loading tiers…</div> : null}
                {tiersQuery.isError ? (
                  <div className="mt-3 text-sm text-red-600">Failed to load tiers: {tiersError?.message ?? 'error'}</div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded border border-slate-200 p-3">
                      <div className="text-xs font-medium text-slate-700">Create tier</div>
                      <div className="mt-2 grid gap-2">
                        <input
                          className="rounded border border-slate-200 px-3 py-2 text-sm"
                          placeholder="code (e.g. free, pro)"
                          value={newTierCode}
                          onChange={(e) => setNewTierCode(e.target.value)}
                        />
                        <input
                          className="rounded border border-slate-200 px-3 py-2 text-sm"
                          placeholder="name"
                          value={newTierName}
                          onChange={(e) => setNewTierName(e.target.value)}
                        />
                        <input
                          className="rounded border border-slate-200 px-3 py-2 text-sm"
                          placeholder="sort order (optional)"
                          value={newTierSortOrder}
                          onChange={(e) => setNewTierSortOrder(e.target.value)}
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newTierIsDefault}
                            onChange={(e) => setNewTierIsDefault(e.target.checked)}
                          />
                          Default
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newTierIsActive}
                            onChange={(e) => setNewTierIsActive(e.target.checked)}
                          />
                          Active
                        </label>
                        <textarea
                          className={
                            'min-h-28 rounded border px-3 py-2 font-mono text-xs ' +
                            (newTierPolicyError ? 'border-red-300' : 'border-slate-200')
                          }
                          value={newTierPolicyJson}
                          onChange={(e) => {
                            setNewTierPolicyJson(e.target.value)
                            setNewTierPolicyError('')
                          }}
                        />
                        {newTierPolicyError ? <div className="text-xs text-red-600">{newTierPolicyError}</div> : null}
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={
                            createTierMutation.isPending ||
                            newTierCode.trim() === '' ||
                            newTierName.trim() === '' ||
                            !selectedPackage
                          }
                          onClick={() => {
                            let policy: any = {}
                            try {
                              policy = JSON.parse(newTierPolicyJson || '{}')
                              setNewTierPolicyError('')
                            } catch (e: any) {
                              setNewTierPolicyError(e?.message ?? 'Invalid JSON')
                              return
                            }

                            const sortOrder = newTierSortOrder.trim() === '' ? undefined : Number(newTierSortOrder)
                            if (sortOrder !== undefined && Number.isNaN(sortOrder)) {
                              setNewTierPolicyError('sort order must be a number')
                              return
                            }

                            createTierMutation.mutate({
                              examPackageId: selectedPackage.id,
                              body: {
                                code: newTierCode.trim(),
                                name: newTierName.trim(),
                                sortOrder: sortOrder,
                                isDefault: newTierIsDefault,
                                isActive: newTierIsActive,
                                policy,
                              },
                            })
                          }}
                        >
                          Create tier
                        </button>
                        {createTierMutation.isError ? (
                          <div className="text-sm text-red-600">Failed to create tier.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="max-h-72 overflow-auto rounded border border-slate-200">
                      <div className="divide-y divide-slate-100">
                        {tiers.map((t: any) => (
                          <button
                            key={t.id}
                            type="button"
                            className={
                              'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                              (selectedTierId === t.id ? 'bg-slate-50' : '')
                            }
                            onClick={() => setSelectedTierId(t.id)}
                          >
                            <div className="truncate">
                              {t.name}
                              {t.code ? <span className="ml-2 text-xs text-slate-500">({t.code})</span> : null}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {t.isDefault ? <span>Default</span> : null}
                              {!t.isActive ? <span>Inactive</span> : null}
                            </div>
                          </button>
                        ))}
                        {tiers.length === 0 && !tiersQuery.isLoading ? (
                          <div className="px-3 py-2 text-sm text-slate-600">No tiers yet.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded border border-slate-200 p-3">
                      <div className="text-xs font-medium text-slate-700">Edit tier</div>
                      {!selectedTier ? (
                        <div className="mt-2 text-sm text-slate-600">Select a tier to edit.</div>
                      ) : (
                        <div className="mt-2 grid gap-2">
                          <input
                            className="rounded border border-slate-200 px-3 py-2 text-sm"
                            value={editTierCode}
                            onChange={(e) => setEditTierCode(e.target.value)}
                          />
                          <input
                            className="rounded border border-slate-200 px-3 py-2 text-sm"
                            value={editTierName}
                            onChange={(e) => setEditTierName(e.target.value)}
                          />
                          <input
                            className="rounded border border-slate-200 px-3 py-2 text-sm"
                            value={editTierSortOrder}
                            onChange={(e) => setEditTierSortOrder(e.target.value)}
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editTierIsDefault}
                              onChange={(e) => setEditTierIsDefault(e.target.checked)}
                            />
                            Default
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editTierIsActive}
                              onChange={(e) => setEditTierIsActive(e.target.checked)}
                            />
                            Active
                          </label>
                          <textarea
                            className={
                              'min-h-28 rounded border px-3 py-2 font-mono text-xs ' +
                              (editTierPolicyError ? 'border-red-300' : 'border-slate-200')
                            }
                            value={editTierPolicyJson}
                            onChange={(e) => {
                              setEditTierPolicyJson(e.target.value)
                              setEditTierPolicyError('')
                            }}
                          />
                          {editTierPolicyError ? <div className="text-xs text-red-600">{editTierPolicyError}</div> : null}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                              disabled={updateTierMutation.isPending}
                              onClick={() => {
                                let policy: any = {}
                                try {
                                  policy = JSON.parse(editTierPolicyJson || '{}')
                                  setEditTierPolicyError('')
                                } catch (e: any) {
                                  setEditTierPolicyError(e?.message ?? 'Invalid JSON')
                                  return
                                }

                                const sortOrder = editTierSortOrder.trim() === '' ? 0 : Number(editTierSortOrder)
                                if (Number.isNaN(sortOrder)) {
                                  setEditTierPolicyError('sort order must be a number')
                                  return
                                }

                                updateTierMutation.mutate({
                                  examPackageId: selectedPackage.id,
                                  tierId: selectedTier.id,
                                  body: {
                                    code: editTierCode.trim(),
                                    name: editTierName.trim(),
                                    sortOrder,
                                    isDefault: editTierIsDefault,
                                    isActive: editTierIsActive,
                                    policy,
                                  },
                                })
                              }}
                            >
                              Save tier
                            </button>

                            <button
                              type="button"
                              className="rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                              disabled={deleteTierMutation.isPending}
                              onClick={() =>
                                deleteTierMutation.mutate({ examPackageId: selectedPackage.id, tierId: selectedTier.id })
                              }
                            >
                              Delete
                            </button>
                          </div>

                          {updateTierMutation.isError ? (
                            <div className="text-sm text-red-600">Failed to update tier.</div>
                          ) : null}
                          {deleteTierMutation.isError ? (
                            <div className="text-sm text-red-600">Failed to delete tier.</div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-slate-500">
                      Note: You cannot delete the default tier. To change defaults, mark another tier as Default.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
