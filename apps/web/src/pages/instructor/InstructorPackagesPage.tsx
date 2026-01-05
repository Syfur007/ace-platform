import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  instructorCreateExamPackageTier,
  instructorDeleteExamPackageTier,
  instructorListExamPackageTiers,
  instructorListExamPackages,
  instructorUpdateExamPackage,
  instructorUpdateExamPackageTier,
  type InstructorUpdateExamPackageRequest,
} from '@/api/endpoints'
import type { ApiError } from '@/api/http'

function parseLines(v: string): string[] {
  return v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function InstructorPackagesPage() {
  const queryClient = useQueryClient()

  const packagesQuery = useQuery({
    queryKey: ['instructor', 'exam-packages'],
    queryFn: instructorListExamPackages,
    refetchOnWindowFocus: false,
  })

  const [selectedExamPackageId, setSelectedExamPackageId] = useState('')

  const selectedPackage = useMemo(() => {
    return (packagesQuery.data?.items ?? []).find((p: any) => p.id === selectedExamPackageId) ?? null
  }, [packagesQuery.data?.items, selectedExamPackageId])

  const [editSubtitle, setEditSubtitle] = useState('')
  const [editOverview, setEditOverview] = useState('')
  const [editModulesText, setEditModulesText] = useState('')
  const [editHighlightsText, setEditHighlightsText] = useState('')
  const [editModuleSectionsJson, setEditModuleSectionsJson] = useState('[]')
  const [editModuleSectionsError, setEditModuleSectionsError] = useState('')

  useEffect(() => {
    if (!selectedPackage) return
    setEditSubtitle(String(selectedPackage.subtitle ?? ''))
    setEditOverview(String(selectedPackage.overview ?? ''))
    setEditModulesText(Array.isArray(selectedPackage.modules) ? selectedPackage.modules.join('\n') : '')
    setEditHighlightsText(Array.isArray(selectedPackage.highlights) ? selectedPackage.highlights.join('\n') : '')
    setEditModuleSectionsJson(
      JSON.stringify(Array.isArray(selectedPackage.moduleSections) ? selectedPackage.moduleSections : [], null, 2),
    )
    setEditModuleSectionsError('')
  }, [selectedPackage?.id])

  const updatePackageMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; body: InstructorUpdateExamPackageRequest }) =>
      instructorUpdateExamPackage(input.examPackageId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'exam-packages'] })
    },
  })

  const tiersQuery = useQuery({
    queryKey: ['instructor', 'exam-package-tiers', selectedExamPackageId],
    queryFn: () => instructorListExamPackageTiers(selectedExamPackageId),
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
    mutationFn: async (input: { examPackageId: string; body: any }) =>
      instructorCreateExamPackageTier(input.examPackageId, input.body),
    onSuccess: async () => {
      setNewTierCode('')
      setNewTierName('')
      setNewTierSortOrder('')
      setNewTierIsDefault(false)
      setNewTierIsActive(true)
      setNewTierPolicyJson('{}')
      setNewTierPolicyError('')
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'exam-package-tiers', selectedExamPackageId] })
    },
  })

  const updateTierMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; tierId: string; body: any }) =>
      instructorUpdateExamPackageTier(input.examPackageId, input.tierId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'exam-package-tiers', selectedExamPackageId] })
    },
  })

  const deleteTierMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; tierId: string }) =>
      instructorDeleteExamPackageTier(input.examPackageId, input.tierId),
    onSuccess: async () => {
      setSelectedTierId('')
      await queryClient.invalidateQueries({ queryKey: ['instructor', 'exam-package-tiers', selectedExamPackageId] })
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

  const packagesError = packagesQuery.error as ApiError | null
  const tiersError = tiersQuery.error as ApiError | null

  const tiers = tiersQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Packages &amp; Tiers</h1>
        <div className="text-sm text-slate-600">Update package content fields and manage tiers.</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded border border-slate-200 p-4">
          <div className="text-sm font-medium">Exam packages</div>

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
                <div className="px-3 py-2 text-sm text-slate-600">No packages.</div>
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
                <div>
                  <div className="text-sm font-medium">Package</div>
                  <div className="text-xs text-slate-500">{selectedPackage.id}</div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Subtitle</span>
                    <input
                      className="rounded border border-slate-200 px-3 py-2 text-sm"
                      value={editSubtitle}
                      onChange={(e) => setEditSubtitle(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1">
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

                  <label className="grid gap-1">
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
                  disabled={updatePackageMutation.isPending}
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
                        subtitle: editSubtitle,
                        overview: editOverview,
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
                          placeholder="code"
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
                                sortOrder,
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
                        <TierEditor
                          examPackageId={selectedPackage.id}
                          tier={selectedTier}
                          editTierCode={editTierCode}
                          setEditTierCode={setEditTierCode}
                          editTierName={editTierName}
                          setEditTierName={setEditTierName}
                          editTierSortOrder={editTierSortOrder}
                          setEditTierSortOrder={setEditTierSortOrder}
                          editTierIsDefault={editTierIsDefault}
                          setEditTierIsDefault={setEditTierIsDefault}
                          editTierIsActive={editTierIsActive}
                          setEditTierIsActive={setEditTierIsActive}
                          editTierPolicyJson={editTierPolicyJson}
                          setEditTierPolicyJson={setEditTierPolicyJson}
                          editTierPolicyError={editTierPolicyError}
                          setEditTierPolicyError={setEditTierPolicyError}
                          updateTierMutation={updateTierMutation}
                          deleteTierMutation={deleteTierMutation}
                        />
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

function TierEditor(props: {
  examPackageId: string
  tier: any
  editTierCode: string
  setEditTierCode: (v: string) => void
  editTierName: string
  setEditTierName: (v: string) => void
  editTierSortOrder: string
  setEditTierSortOrder: (v: string) => void
  editTierIsDefault: boolean
  setEditTierIsDefault: (v: boolean) => void
  editTierIsActive: boolean
  setEditTierIsActive: (v: boolean) => void
  editTierPolicyJson: string
  setEditTierPolicyJson: (v: string) => void
  editTierPolicyError: string
  setEditTierPolicyError: (v: string) => void
  updateTierMutation: any
  deleteTierMutation: any
}) {
  return (
    <div className="mt-2 grid gap-2">
      <input
        className="rounded border border-slate-200 px-3 py-2 text-sm"
        value={props.editTierCode}
        onChange={(e) => props.setEditTierCode(e.target.value)}
      />
      <input
        className="rounded border border-slate-200 px-3 py-2 text-sm"
        value={props.editTierName}
        onChange={(e) => props.setEditTierName(e.target.value)}
      />
      <input
        className="rounded border border-slate-200 px-3 py-2 text-sm"
        value={props.editTierSortOrder}
        onChange={(e) => props.setEditTierSortOrder(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.editTierIsDefault}
          onChange={(e) => props.setEditTierIsDefault(e.target.checked)}
        />
        Default
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.editTierIsActive}
          onChange={(e) => props.setEditTierIsActive(e.target.checked)}
        />
        Active
      </label>
      <textarea
        className={
          'min-h-28 rounded border px-3 py-2 font-mono text-xs ' +
          (props.editTierPolicyError ? 'border-red-300' : 'border-slate-200')
        }
        value={props.editTierPolicyJson}
        onChange={(e) => {
          props.setEditTierPolicyJson(e.target.value)
          props.setEditTierPolicyError('')
        }}
      />
      {props.editTierPolicyError ? <div className="text-xs text-red-600">{props.editTierPolicyError}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          disabled={props.updateTierMutation.isPending}
          onClick={() => {
            let policy: any = {}
            try {
              policy = JSON.parse(props.editTierPolicyJson || '{}')
              props.setEditTierPolicyError('')
            } catch (e: any) {
              props.setEditTierPolicyError(e?.message ?? 'Invalid JSON')
              return
            }

            const sortOrder = props.editTierSortOrder.trim() === '' ? 0 : Number(props.editTierSortOrder)
            if (Number.isNaN(sortOrder)) {
              props.setEditTierPolicyError('sort order must be a number')
              return
            }

            props.updateTierMutation.mutate({
              examPackageId: props.examPackageId,
              tierId: props.tier.id,
              body: {
                code: props.editTierCode.trim(),
                name: props.editTierName.trim(),
                sortOrder,
                isDefault: props.editTierIsDefault,
                isActive: props.editTierIsActive,
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
          disabled={props.deleteTierMutation.isPending}
          onClick={() => props.deleteTierMutation.mutate({ examPackageId: props.examPackageId, tierId: props.tier.id })}
        >
          Delete
        </button>
      </div>

      {props.updateTierMutation.isError ? <div className="text-sm text-red-600">Failed to update tier.</div> : null}
      {props.deleteTierMutation.isError ? <div className="text-sm text-red-600">Failed to delete tier.</div> : null}
    </div>
  )
}
