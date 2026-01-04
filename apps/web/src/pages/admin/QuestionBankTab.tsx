import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import {
  adminApproveQuestion,
  adminCreateExamPackage,
  adminDeleteExamPackage,
  adminDeleteQuestion,
  adminListExamPackages,
  adminRequestQuestionChanges,
  adminUpdateExamPackage,
  instructorArchiveQuestion,
  instructorCreateQuestion,
  instructorCreateQuestionBank,
  instructorCreateQuestionTopic,
  instructorDeleteQuestionBank,
  instructorDeleteQuestionTopic,
  instructorDraftQuestion,
  instructorGetQuestion,
  instructorListQuestionDifficulties,
  instructorListQuestionBanks,
  instructorListQuestionTopics,
  instructorListQuestions,
  instructorPublishQuestion,
  instructorReplaceChoices,
  instructorSubmitQuestionForReview,
  instructorUpdateQuestion,
  instructorUpdateQuestionBank,
  instructorUpdateQuestionDifficulty,
  instructorUpdateQuestionTopic,
} from '@/api/endpoints'

type CreateQuestionFormState = {
  questionBankId: string
  topicId: string
  difficultyId: string
  prompt: string
  explanation: string
  choicesText: string[]
  correctChoiceIndex: number
}

type QuestionFormState = CreateQuestionFormState

type QuestionEditorMode = 'create' | 'edit'

function compactStatusLabel(status?: string) {
  if (!status) return ''
  if (status === 'draft') return 'Draft'
  if (status === 'in_review') return 'In review'
  if (status === 'needs_changes') return 'Needs changes'
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return status
}

type ExamPackagesSectionProps = {
  examPackages: any
  examPackageName: string
  setExamPackageName: (v: string) => void
  selectedExamPackageId: string
  setSelectedExamPackageId: (v: string) => void
  editExamPackageName: string
  setEditExamPackageName: (v: string) => void
  createExamPackageMutation: any
  updateExamPackageMutation: any
  deleteExamPackageMutation: any
}

function ExamPackagesSection(props: ExamPackagesSectionProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">Exam Packages</div>
      <div className="flex gap-2">
        <input
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          placeholder="New exam package name"
          value={props.examPackageName}
          onChange={(e) => props.setExamPackageName(e.target.value)}
        />
        <button
          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          type="button"
          disabled={props.createExamPackageMutation.isPending || props.examPackageName.trim() === ''}
          onClick={() => props.createExamPackageMutation.mutate({ name: props.examPackageName.trim() })}
        >
          Create
        </button>
      </div>
      {props.createExamPackageMutation.isError ? (
        <div className="text-sm text-red-600">Failed to create exam package.</div>
      ) : null}

      <div className="max-h-44 overflow-auto rounded border border-slate-200">
        <div className="divide-y divide-slate-100">
          {(props.examPackages.data?.items ?? []).map((p: any) => (
            <button
              key={p.id}
              type="button"
              className={
                'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                (props.selectedExamPackageId === p.id ? 'bg-slate-50' : '')
              }
              onClick={() => props.setSelectedExamPackageId(p.id)}
            >
              <div className="truncate">
                {p.name}
                {p.code ? <span className="ml-2 text-xs text-slate-500">({p.code})</span> : null}
              </div>
              <div className="text-xs text-slate-500">{p.id}</div>
            </button>
          ))}
          {props.examPackages.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
        </div>
      </div>

      <div className="rounded border border-slate-200 p-3">
        <div className="font-medium">Edit exam package</div>
        {!props.selectedExamPackageId ? <div className="mt-1 text-sm text-slate-600">Select an exam package above.</div> : null}
        {props.selectedExamPackageId ? (
          <div className="mt-3 grid gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={props.editExamPackageName}
              onChange={(e) => props.setEditExamPackageName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={props.updateExamPackageMutation.isPending || props.editExamPackageName.trim() === ''}
                onClick={() =>
                  props.updateExamPackageMutation.mutate({
                    examPackageId: props.selectedExamPackageId,
                    name: props.editExamPackageName.trim(),
                  })
                }
              >
                Save
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={props.deleteExamPackageMutation.isPending}
                onClick={() => {
                  if (!confirm('Delete this exam package? Question banks will be detached.')) return
                  props.deleteExamPackageMutation.mutate(props.selectedExamPackageId)
                }}
              >
                Delete
              </button>
            </div>
            {props.updateExamPackageMutation.isError ? (
              <div className="text-sm text-red-600">Failed to update exam package.</div>
            ) : null}
            {props.deleteExamPackageMutation.isError ? (
              <div className="text-sm text-red-600">Failed to delete exam package.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type QuestionBanksSectionProps = {
  examPackages: any
  packages: any
  packageName: string
  setPackageName: (v: string) => void
  packageExamPackageId: string
  setPackageExamPackageId: (v: string) => void
  selectedPackageId: string
  setSelectedPackageId: (v: string) => void
  editPackageName: string
  setEditPackageName: (v: string) => void
  editPackageExamPackageId: string
  setEditPackageExamPackageId: (v: string) => void
  editPackageIsHidden: boolean
  setEditPackageIsHidden: (v: boolean) => void
  createPackageMutation: any
  updatePackageMutation: any
  deletePackageMutation: any
}

function QuestionBanksSection(props: QuestionBanksSectionProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">Question Banks</div>
      <div className="flex gap-2">
        <input
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          placeholder="New question bank name"
          value={props.packageName}
          onChange={(e) => props.setPackageName(e.target.value)}
        />
        <select
          className="rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.packageExamPackageId}
          onChange={(e) => props.setPackageExamPackageId(e.target.value)}
        >
          <option value="">Select exam package</option>
          {(props.examPackages.data?.items ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          type="button"
          disabled={
            props.createPackageMutation.isPending ||
            props.packageName.trim() === '' ||
            props.packageExamPackageId.trim() === '' ||
            props.examPackages.isLoading ||
            props.examPackages.isError
          }
          onClick={() =>
            props.createPackageMutation.mutate({ name: props.packageName.trim(), examPackageId: props.packageExamPackageId.trim() })
          }
        >
          Create
        </button>
      </div>
      {props.createPackageMutation.isError && <div className="text-sm text-red-600">Failed to create question bank.</div>}

      <div className="max-h-44 overflow-auto rounded border border-slate-200">
        <div className="divide-y divide-slate-100">
          {(props.packages.data?.items ?? []).map((p: any) => (
            <button
              key={p.id}
              type="button"
              className={
                'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                (props.selectedPackageId === p.id ? 'bg-slate-50' : '')
              }
              onClick={() => props.setSelectedPackageId(p.id)}
            >
              <div className="truncate">
                {p.name}
                {p.isHidden ? <span className="ml-2 text-xs text-slate-500">(hidden)</span> : null}
              </div>
              <div className="text-xs text-slate-500">
                {(p as any).examPackageId ? `${(p as any).examPackageId} · ` : ''}
                {p.id}
              </div>
            </button>
          ))}
          {props.packages.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
          {props.packages.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
        </div>
      </div>

      <div className="rounded border border-slate-200 p-3">
        <div className="font-medium">Edit question bank</div>
        {!props.selectedPackageId ? <div className="mt-1 text-sm text-slate-600">Select a question bank above.</div> : null}
        {props.selectedPackageId ? (
          <div className="mt-3 grid gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={props.editPackageName}
              onChange={(e) => props.setEditPackageName(e.target.value)}
            />
            <select
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={props.editPackageExamPackageId}
              onChange={(e) => props.setEditPackageExamPackageId(e.target.value)}
              disabled={props.examPackages.isLoading || props.examPackages.isError}
            >
              <option value="">No exam package</option>
              {(props.examPackages.data?.items ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={props.editPackageIsHidden} onChange={(e) => props.setEditPackageIsHidden(e.target.checked)} />
              Hidden (students won’t see it)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={props.updatePackageMutation.isPending || props.editPackageName.trim() === ''}
                onClick={() =>
                  props.updatePackageMutation.mutate({
                    questionBankId: props.selectedPackageId,
                    body: {
                      name: props.editPackageName.trim(),
                      examPackageId: props.editPackageExamPackageId,
                      isHidden: props.editPackageIsHidden,
                    },
                  })
                }
              >
                Save
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={props.deletePackageMutation.isPending}
                onClick={() => {
                  if (!confirm('Delete this question bank? Topics/questions will be detached.')) return
                  props.deletePackageMutation.mutate(props.selectedPackageId)
                }}
              >
                Delete
              </button>
            </div>
            {props.updatePackageMutation.isError || props.deletePackageMutation.isError ? (
              <div className="text-sm text-red-600">Package action failed.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type TopicsSectionProps = {
  packages: any
  topics: any
  topicName: string
  setTopicName: (v: string) => void
  topicPackageId: string
  setTopicPackageId: (v: string) => void
  selectedTopicId: string
  setSelectedTopicId: (v: string) => void
  editTopicName: string
  setEditTopicName: (v: string) => void
  editTopicIsHidden: boolean
  setEditTopicIsHidden: (v: boolean) => void
  createTopicMutation: any
  updateTopicMutation: any
  deleteTopicMutation: any
}

function TopicsSection(props: TopicsSectionProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">Topics</div>
      <div className="grid grid-cols-1 gap-2">
        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.topicPackageId}
          onChange={(e) => props.setTopicPackageId(e.target.value)}
        >
          <option value="">No question bank (global)</option>
          {(props.packages.data?.items ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isHidden ? ' (hidden)' : ''}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="New topic name"
            value={props.topicName}
            onChange={(e) => props.setTopicName(e.target.value)}
          />
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={props.createTopicMutation.isPending || props.topicName.trim() === ''}
            onClick={() =>
              props.createTopicMutation.mutate({
                name: props.topicName.trim(),
                questionBankId: props.topicPackageId ? props.topicPackageId : null,
              })
            }
          >
            Create
          </button>
        </div>
        {props.createTopicMutation.isError && <div className="text-sm text-red-600">Failed to create topic.</div>}
      </div>

      <div className="max-h-44 overflow-auto rounded border border-slate-200">
        <div className="divide-y divide-slate-100">
          {(props.topics.data?.items ?? []).map((t: any) => (
            <button
              key={t.id}
              type="button"
              className={
                'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                (props.selectedTopicId === t.id ? 'bg-slate-50' : '')
              }
              onClick={() => props.setSelectedTopicId(t.id)}
            >
              <div className="truncate">
                {t.name}
                {t.isHidden ? <span className="ml-2 text-xs text-slate-500">(hidden)</span> : null}
              </div>
              <div className="text-xs text-slate-500">{t.questionBankId ?? '—'}</div>
            </button>
          ))}
          {props.topics.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
          {props.topics.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
        </div>
      </div>

      <div className="rounded border border-slate-200 p-3">
        <div className="font-medium">Edit topic</div>
        {!props.selectedTopicId ? <div className="mt-1 text-sm text-slate-600">Select a topic above.</div> : null}
        {props.selectedTopicId ? (
          <div className="mt-3 grid gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={props.editTopicName}
              onChange={(e) => props.setEditTopicName(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={props.editTopicIsHidden} onChange={(e) => props.setEditTopicIsHidden(e.target.checked)} />
              Hidden (students won’t see it)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={props.updateTopicMutation.isPending || props.editTopicName.trim() === ''}
                onClick={() =>
                  props.updateTopicMutation.mutate({
                    topicId: props.selectedTopicId,
                    body: { name: props.editTopicName.trim(), isHidden: props.editTopicIsHidden },
                  })
                }
              >
                Save
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={props.deleteTopicMutation.isPending}
                onClick={() => {
                  if (!confirm('Delete this topic? Questions will be detached.')) return
                  props.deleteTopicMutation.mutate(props.selectedTopicId)
                }}
              >
                Delete
              </button>
            </div>
            {props.updateTopicMutation.isError || props.deleteTopicMutation.isError ? (
              <div className="text-sm text-red-600">Topic action failed.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type DifficultiesSectionProps = {
  difficulties: any
  selectedDifficultyId: string
  setSelectedDifficultyId: (v: string) => void
  editDifficultyDisplayName: string
  setEditDifficultyDisplayName: (v: string) => void
  updateDifficultyMutation: any
}

function DifficultiesSection(props: DifficultiesSectionProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">Difficulties</div>

      <select
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        value={props.selectedDifficultyId}
        onChange={(e) => props.setSelectedDifficultyId(e.target.value)}
      >
        <option value="">Select difficulty</option>
        {(props.difficulties.data?.items ?? []).map((d: any) => (
          <option key={d.id} value={d.id}>
            {d.displayName} ({d.id})
          </option>
        ))}
      </select>

      <div className="grid gap-2 rounded border border-slate-200 p-3">
        <div className="font-medium">Edit difficulty label</div>
        {!props.selectedDifficultyId ? <div className="text-sm text-slate-600">Select a difficulty above.</div> : null}
        {props.selectedDifficultyId ? (
          <>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={props.editDifficultyDisplayName}
              onChange={(e) => props.setEditDifficultyDisplayName(e.target.value)}
            />
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={props.updateDifficultyMutation.isPending || props.editDifficultyDisplayName.trim() === ''}
              onClick={() =>
                props.updateDifficultyMutation.mutate({
                  difficultyId: props.selectedDifficultyId,
                  displayName: props.editDifficultyDisplayName.trim(),
                })
              }
            >
              Save label
            </button>
            {props.updateDifficultyMutation.isError ? <div className="text-sm text-red-600">Failed to update label.</div> : null}
          </>
        ) : null}
      </div>

      {props.difficulties.isLoading ? <div className="text-sm text-slate-600">Loading…</div> : null}
      {props.difficulties.isError ? <div className="text-sm text-red-600">Failed to load difficulties.</div> : null}
    </div>
  )
}

type QuestionsListSectionProps = {
  questionFilters: any
  setQuestionFilters: (updater: any) => void
  visiblePackagesForSelect: any[]
  visibleTopics: any[]
  difficulties: any
  questions: any
  selectedQuestionId: string
  setSelectedQuestionId: (v: string) => void
  difficultiesById: Map<string, string>
  onSelectQuestion?: () => void
}

function QuestionsListSection(props: QuestionsListSectionProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">Questions</div>

      <div className="grid grid-cols-1 gap-2">
        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.questionFilters.status}
          onChange={(e) => props.setQuestionFilters((s: any) => ({ ...s, status: e.target.value as any }))}
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
          value={props.questionFilters.questionBankId}
          onChange={(e) => props.setQuestionFilters((s: any) => ({ ...s, questionBankId: e.target.value, topicId: '' }))}
        >
          <option value="">Any question bank</option>
          {props.visiblePackagesForSelect.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.questionFilters.topicId}
          onChange={(e) => props.setQuestionFilters((s: any) => ({ ...s, topicId: e.target.value }))}
        >
          <option value="">Any topic</option>
          {props.visibleTopics.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.questionFilters.difficultyId}
          onChange={(e) => props.setQuestionFilters((s: any) => ({ ...s, difficultyId: e.target.value }))}
        >
          <option value="">Any difficulty</option>
          {(props.difficulties.data?.items ?? []).map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-56 overflow-auto rounded border border-slate-200">
        <div className="divide-y divide-slate-100">
          {(props.questions.data?.items ?? []).map((q: any) => (
            <button
              key={q.id}
              type="button"
              className={
                'block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ' + (props.selectedQuestionId === q.id ? 'bg-slate-50' : '')
              }
              onClick={() => {
                props.setSelectedQuestionId(q.id)
                props.onSelectQuestion?.()
              }}
            >
              <div className="truncate font-medium">{q.prompt}</div>
              <div className="mt-1 text-xs text-slate-500">
                id={q.id} difficulty={props.difficultiesById.get(q.difficultyId) ?? q.difficultyId}
              </div>
            </button>
          ))}
          {props.questions.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Loading…</div>}
          {props.questions.isError && <div className="px-3 py-2 text-sm text-red-600">Failed to load.</div>}
        </div>
      </div>
    </div>
  )
}

type QuestionEditorSectionProps = {
  mode: QuestionEditorMode
  setMode: (next: QuestionEditorMode) => void
  selectedQuestionId: string
  setSelectedQuestionId: (v: string) => void
  selectedQuestion: any
  selectedQuestionStatus: string | undefined
  questionForm: QuestionFormState
  setQuestionForm: (updater: any) => void
  topics: any
  difficulties: any
  visiblePackagesForSelect: any[]
  visibleTopicsForSelect: any[]
  reviewRequestNote: string
  setReviewRequestNote: (v: string) => void
  createQuestionMutation: any
  deleteQuestionMutation: any
  statusMutation: any
  submitForReviewMutation: any
  approveQuestionMutation: any
  requestChangesMutation: any
  updateQuestionMutation: any
  replaceChoicesMutation: any
}

function QuestionEditorSection(props: QuestionEditorSectionProps) {
  const isEditingExisting = props.mode === 'edit' && Boolean(props.selectedQuestionId)

  const trimmedChoices = props.questionForm.choicesText.map((t) => t.trim())
  const choicesHaveBlanks = trimmedChoices.some((t) => t === '')
  const isFormValid =
    props.questionForm.prompt.trim() !== '' &&
    props.questionForm.difficultyId.trim() !== '' &&
    trimmedChoices.length >= 2 &&
    !choicesHaveBlanks &&
    props.questionForm.correctChoiceIndex >= 0 &&
    props.questionForm.correctChoiceIndex < trimmedChoices.length

  const canRemoveChoice = props.questionForm.choicesText.length > 2

  return (
    <div className="space-y-3 rounded border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Question Editor</div>
          <div className="text-sm text-slate-600">
            {isEditingExisting
              ? `Status: ${compactStatusLabel(props.selectedQuestionStatus)}`
              : 'Creating a new question (not yet saved).'}
          </div>
        </div>

        {isEditingExisting ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                props.setMode('create')
                props.setSelectedQuestionId('')
                props.setQuestionForm({
                  questionBankId: '',
                  topicId: '',
                  difficultyId: props.questionForm.difficultyId,
                  prompt: '',
                  explanation: '',
                  choicesText: ['', '', '', ''],
                  correctChoiceIndex: 0,
                })
              }}
            >
              Create question
            </button>

            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-2 text-sm text-red-600 hover:bg-slate-50 disabled:opacity-50"
              disabled={!props.selectedQuestionId || props.deleteQuestionMutation.isPending}
              onClick={() => {
                if (!props.selectedQuestionId) return
                if (!confirm('Delete this question? This cannot be undone.')) return
                props.deleteQuestionMutation.mutate(props.selectedQuestionId)
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {isEditingExisting ? (
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={!props.selectedQuestionId || props.statusMutation.isPending}
            onClick={() => props.selectedQuestionId && props.statusMutation.mutate({ action: 'draft', questionId: props.selectedQuestionId })}
          >
            Draft
          </button>
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={!props.selectedQuestionId || props.statusMutation.isPending}
            onClick={() => props.selectedQuestionId && props.statusMutation.mutate({ action: 'publish', questionId: props.selectedQuestionId })}
          >
            Publish
          </button>
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={!props.selectedQuestionId || props.statusMutation.isPending}
            onClick={() => props.selectedQuestionId && props.statusMutation.mutate({ action: 'archive', questionId: props.selectedQuestionId })}
          >
            Archive
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2">
        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.questionForm.questionBankId}
          onChange={(e) => props.setQuestionForm((s: any) => ({ ...s, questionBankId: e.target.value, topicId: '' }))}
        >
          <option value="">No question bank</option>
          {props.visiblePackagesForSelect.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.questionForm.topicId}
          onChange={(e) => props.setQuestionForm((s: any) => ({ ...s, topicId: e.target.value }))}
        >
          <option value="">No topic</option>
          {props.visibleTopicsForSelect.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={props.questionForm.difficultyId}
          onChange={(e) => props.setQuestionForm((s: any) => ({ ...s, difficultyId: e.target.value }))}
        >
          <option value="">Select difficulty</option>
          {(props.difficulties.data?.items ?? []).map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.displayName}
            </option>
          ))}
        </select>

        <textarea
          className="min-h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          placeholder="Prompt"
          value={props.questionForm.prompt}
          onChange={(e) => props.setQuestionForm((s: any) => ({ ...s, prompt: e.target.value }))}
        />
        <textarea
          className="min-h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          placeholder="Explanation"
          value={props.questionForm.explanation}
          onChange={(e) => props.setQuestionForm((s: any) => ({ ...s, explanation: e.target.value }))}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">Choices</div>
          {props.questionForm.choicesText.map((text, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="h-4 w-4"
                type="radio"
                name="questionCorrect"
                checked={props.questionForm.correctChoiceIndex === i}
                onChange={() => props.setQuestionForm((s: any) => ({ ...s, correctChoiceIndex: i }))}
              />
              <input
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder={`Option ${i + 1}`}
                value={text}
                onChange={(e) =>
                  props.setQuestionForm((s: any) => {
                    const next = [...s.choicesText]
                    next[i] = e.target.value
                    return { ...s, choicesText: next }
                  })
                }
              />
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!canRemoveChoice}
                onClick={() =>
                  props.setQuestionForm((s: any) => {
                    if (s.choicesText.length <= 2) return s
                    const nextChoices = s.choicesText.filter((_: any, idx: number) => idx !== i)
                    let nextCorrect = s.correctChoiceIndex
                    if (i === nextCorrect) nextCorrect = 0
                    if (i < nextCorrect) nextCorrect = Math.max(0, nextCorrect - 1)
                    nextCorrect = Math.min(nextCorrect, Math.max(0, nextChoices.length - 1))
                    return { ...s, choicesText: nextChoices, correctChoiceIndex: nextCorrect }
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="w-fit rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => props.setQuestionForm((s: any) => ({ ...s, choicesText: [...s.choicesText, ''] }))}
          >
            Add option
          </button>

          {!isFormValid ? <div className="text-sm text-slate-600">Fill prompt, difficulty, and all options.</div> : null}
        </div>
      </div>

      {!isEditingExisting ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={props.createQuestionMutation.isPending || !isFormValid}
            onClick={() =>
              props.createQuestionMutation.mutate({
                questionBankId: props.questionForm.questionBankId ? props.questionForm.questionBankId : null,
                topicId: props.questionForm.topicId ? props.questionForm.topicId : null,
                difficultyId: props.questionForm.difficultyId,
                prompt: props.questionForm.prompt,
                explanation: props.questionForm.explanation,
                choices: trimmedChoices.map((t) => ({ text: t })),
                correctChoiceIndex: props.questionForm.correctChoiceIndex,
              })
            }
          >
            Create Draft
          </button>

          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            type="button"
            disabled={props.createQuestionMutation.isPending || !isFormValid}
            onClick={() =>
              props.createQuestionMutation.mutate({
                questionBankId: props.questionForm.questionBankId ? props.questionForm.questionBankId : null,
                topicId: props.questionForm.topicId ? props.questionForm.topicId : null,
                difficultyId: props.questionForm.difficultyId,
                prompt: props.questionForm.prompt,
                explanation: props.questionForm.explanation,
                choices: trimmedChoices.map((t) => ({ text: t })),
                correctChoiceIndex: props.questionForm.correctChoiceIndex,
                publishAfterCreate: true,
              })
            }
          >
            Create & Publish
          </button>
        </div>
      ) : (
        <button
          className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          type="button"
          disabled={!props.selectedQuestionId || props.updateQuestionMutation.isPending || props.replaceChoicesMutation.isPending || !isFormValid}
          onClick={async () => {
            if (!props.selectedQuestionId) return
            await props.updateQuestionMutation.mutateAsync({
              questionId: props.selectedQuestionId,
              body: {
                questionBankId: props.questionForm.questionBankId ? props.questionForm.questionBankId : null,
                topicId: props.questionForm.topicId ? props.questionForm.topicId : null,
                difficultyId: props.questionForm.difficultyId,
                prompt: props.questionForm.prompt,
                explanation: props.questionForm.explanation,
              },
            })
            await props.replaceChoicesMutation.mutateAsync({
              questionId: props.selectedQuestionId,
              body: {
                choices: trimmedChoices.map((t) => ({ text: t })),
                correctChoiceIndex: props.questionForm.correctChoiceIndex,
              },
            })
          }}
        >
          Save
        </button>
      )}

      {props.createQuestionMutation.isError ? <div className="text-sm text-red-600">Failed to create question.</div> : null}
      {props.deleteQuestionMutation.isError ? <div className="text-sm text-red-600">Failed to delete question.</div> : null}

      {isEditingExisting ? (
        <>
          <div className="mt-2 grid gap-2">
            <div className="text-sm font-medium">Review workflow</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!props.selectedQuestionId || props.submitForReviewMutation.isPending}
                onClick={() => props.selectedQuestionId && props.submitForReviewMutation.mutate(props.selectedQuestionId)}
              >
                Submit for review
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!props.selectedQuestionId || props.approveQuestionMutation.isPending}
                onClick={() => props.selectedQuestionId && props.approveQuestionMutation.mutate(props.selectedQuestionId)}
              >
                Approve
              </button>
            </div>

            <div className="grid gap-2">
              <input
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="Request changes note (optional)"
                value={props.reviewRequestNote}
                onChange={(e) => props.setReviewRequestNote(e.target.value)}
              />
              <button
                type="button"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={!props.selectedQuestionId || props.requestChangesMutation.isPending}
                onClick={() =>
                  props.selectedQuestionId && props.requestChangesMutation.mutate({ questionId: props.selectedQuestionId, note: props.reviewRequestNote })
                }
              >
                Request changes
              </button>
            </div>

            {props.submitForReviewMutation.isError || props.approveQuestionMutation.isError || props.requestChangesMutation.isError ? (
              <div className="text-sm text-red-600">Review action failed (check state/permissions).</div>
            ) : null}
          </div>

          {props.selectedQuestion.isLoading && <div className="text-sm text-slate-600">Loading…</div>}
          {props.selectedQuestion.isError && <div className="text-sm text-red-600">Failed to load question.</div>}
        </>
      ) : null}

      {(props.updateQuestionMutation.isError || props.replaceChoicesMutation.isError || props.statusMutation.isError) && (
        <div className="text-sm text-red-600">Update failed (check permissions / validation).</div>
      )}
    </div>
  )
}

export function QuestionBankTab() {
  const queryClient = useQueryClient()

  type QuestionBankSection =
    | 'questionsList'
    | 'questionEditor'
    | 'examPackages'
    | 'questionBanks'
    | 'topics'
    | 'difficulties'

  const [activeSection, setActiveSection] = useState<QuestionBankSection>('questionsList')

  const [examPackageName, setExamPackageName] = useState('')
  const [selectedExamPackageId, setSelectedExamPackageId] = useState('')
  const [editExamPackageName, setEditExamPackageName] = useState('')

  const [packageName, setPackageName] = useState('')
  const [packageExamPackageId, setPackageExamPackageId] = useState('')
  const [topicName, setTopicName] = useState('')
  const [topicPackageId, setTopicPackageId] = useState('')

  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [editPackageName, setEditPackageName] = useState('')
  const [editPackageExamPackageId, setEditPackageExamPackageId] = useState('')
  const [editPackageIsHidden, setEditPackageIsHidden] = useState(false)

  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [editTopicName, setEditTopicName] = useState('')
  const [editTopicIsHidden, setEditTopicIsHidden] = useState(false)

  const [selectedDifficultyId, setSelectedDifficultyId] = useState('')
  const [editDifficultyDisplayName, setEditDifficultyDisplayName] = useState('')

  const [questionFilters, setQuestionFilters] = useState<{
    status: '' | 'draft' | 'in_review' | 'needs_changes' | 'published' | 'archived'
    questionBankId: string
    topicId: string
    difficultyId: string
  }>({ status: 'draft', questionBankId: '', topicId: '', difficultyId: '' })

  const [questionEditorMode, setQuestionEditorMode] = useState<QuestionEditorMode>('create')
  const [questionForm, setQuestionForm] = useState<QuestionFormState>({
    questionBankId: '',
    topicId: '',
    difficultyId: '',
    prompt: '',
    explanation: '',
    choicesText: ['', '', '', ''],
    correctChoiceIndex: 0,
  })

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('')

  const [reviewRequestNote, setReviewRequestNote] = useState('')

  const packages = useQuery({
    queryKey: ['questionBank', 'packages'],
    queryFn: instructorListQuestionBanks,
  })

  const examPackages = useQuery({
    queryKey: ['admin', 'exam-packages'],
    queryFn: adminListExamPackages,
  })

  const createExamPackageMutation = useMutation({
    mutationFn: adminCreateExamPackage,
    onSuccess: async () => {
      setExamPackageName('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-packages'] })
    },
  })

  const updateExamPackageMutation = useMutation({
    mutationFn: async (input: { examPackageId: string; name: string }) =>
      adminUpdateExamPackage(input.examPackageId, { name: input.name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-packages'] })
    },
  })

  const deleteExamPackageMutation = useMutation({
    mutationFn: adminDeleteExamPackage,
    onSuccess: async () => {
      setSelectedExamPackageId('')
      setEditExamPackageName('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'exam-packages'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'packages'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
    },
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
        questionBankId: questionFilters.questionBankId || undefined,
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
    if (questionFilters.questionBankId) return items.filter((t: any) => t.questionBankId === questionFilters.questionBankId)
    return items
  }, [topics.data?.items, questionFilters.questionBankId])

  const visibleTopicsForEditor = useMemo(() => {
    const items = (topics.data?.items ?? []).filter((t: any) => !t.isHidden)
    if (questionForm.questionBankId) return items.filter((t: any) => t.questionBankId === questionForm.questionBankId)
    return items
  }, [topics.data?.items, questionForm.questionBankId])

  const visiblePackagesForSelect = useMemo(() => {
    return (packages.data?.items ?? []).filter((p: any) => !p.isHidden)
  }, [packages.data?.items])

  // Keep exam package edit form in sync when selection changes.
  useEffect(() => {
    if (!selectedExamPackageId) return
    const ep = (examPackages.data?.items ?? []).find((p: any) => p.id === selectedExamPackageId)
    if (!ep) return
    setEditExamPackageName(String(ep.name ?? ''))
  }, [examPackages.data?.items, selectedExamPackageId])

  const difficultiesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of difficulties.data?.items ?? []) map.set(d.id, d.displayName)
    return map
  }, [difficulties.data?.items])

  const createPackageMutation = useMutation({
    mutationFn: instructorCreateQuestionBank,
    onSuccess: async () => {
      setPackageName('')
      setPackageExamPackageId('')
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
    mutationFn: async (input: any) => {
      const { publishAfterCreate, ...body } = input ?? {}
      return instructorCreateQuestion(body)
    },
    onSuccess: async (data: any, vars: any) => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      setSelectedQuestionId(data.id)
      setQuestionEditorMode('edit')

      if (vars?.publishAfterCreate) {
        statusMutation.mutate({ action: 'publish', questionId: data.id })
      }
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: adminDeleteQuestion,
    onSuccess: async () => {
      setSelectedQuestionId('')
      setQuestionEditorMode('create')
      setQuestionForm((s) => ({
        questionBankId: '',
        topicId: '',
        difficultyId: s.difficultyId,
        prompt: '',
        explanation: '',
        choicesText: ['', '', '', ''],
        correctChoiceIndex: 0,
      }))
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question'] })
    },
  })

  const updateQuestionMutation = useMutation({
    mutationFn: async (input: { questionId: string; body: any }) => instructorUpdateQuestion(input.questionId, input.body),
    onSuccess: async (_data: any, vars: any) => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', vars?.questionId] })
    },
  })

  const replaceChoicesMutation = useMutation({
    mutationFn: async (input: { questionId: string; body: any }) => instructorReplaceChoices(input.questionId, input.body),
    onSuccess: async (_data: any, vars: any) => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', vars?.questionId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (input: { action: 'publish' | 'archive' | 'draft'; questionId: string }) => {
      if (input.action === 'publish') return instructorPublishQuestion(input.questionId)
      if (input.action === 'archive') return instructorArchiveQuestion(input.questionId)
      return instructorDraftQuestion(input.questionId)
    },
    onSuccess: async (_data: any, vars: any) => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'questions'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'question', vars?.questionId] })
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
    mutationFn: async (input: { questionBankId: string; body: { name?: string; examPackageId?: string; isHidden?: boolean } }) =>
      instructorUpdateQuestionBank(input.questionBankId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'packages'] })
      await queryClient.invalidateQueries({ queryKey: ['questionBank', 'topics'] })
    },
  })

  const deletePackageMutation = useMutation({
    mutationFn: instructorDeleteQuestionBank,
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
    if (questionForm.difficultyId) return
    const first = (difficulties.data?.items ?? [])[0]
    if (!first) return
    setQuestionForm((s) => (s.difficultyId ? s : { ...s, difficultyId: first.id }))
  }, [difficulties.data?.items, questionForm.difficultyId])

  useEffect(() => {
    const pkg = (packages.data?.items ?? []).find((p: any) => p.id === selectedPackageId)
    if (!pkg) return
    setEditPackageName(pkg.name ?? '')
    setEditPackageExamPackageId((pkg as any).examPackageId ?? '')
    setEditPackageIsHidden(Boolean((pkg as any).isHidden))
  }, [packages.data?.items, selectedPackageId])

  useEffect(() => {
    if (packageExamPackageId) return
    const first = (examPackages.data?.items ?? [])[0]
    if (!first) return
    setPackageExamPackageId(first.id)
  }, [examPackages.data?.items, packageExamPackageId])

  useEffect(() => {
    const top = (topics.data?.items ?? []).find((t: any) => t.id === selectedTopicId)
    if (!top) return
    setEditTopicName(top.name ?? '')
    setEditTopicIsHidden(Boolean((top as any).isHidden))
  }, [topics.data?.items, selectedTopicId])

  useEffect(() => {
    const diff = (difficulties.data?.items ?? []).find((d: any) => d.id === selectedDifficultyId)
    if (!diff) return
    setEditDifficultyDisplayName(diff.displayName ?? '')
  }, [difficulties.data?.items, selectedDifficultyId])

  // Keep edit form in sync when selection changes.
  useEffect(() => {
    if (!selectedQuestion.data) return
    const q = selectedQuestion.data
    const correctIndex = Math.max(0, q.choices.findIndex((c: any) => c.id === q.correctChoiceId))
    const choicesText = q.choices.map((c: any) => c.text)
    while (choicesText.length < 4) choicesText.push('')
    setQuestionForm({
      questionBankId: q.questionBankId ?? '',
      topicId: q.topicId ?? '',
      difficultyId: q.difficultyId,
      prompt: q.prompt,
      explanation: q.explanation,
      choicesText,
      correctChoiceIndex: Math.min(Math.max(0, correctIndex), Math.max(0, choicesText.length - 1)),
    })
    setQuestionEditorMode('edit')
  }, [selectedQuestionId, selectedQuestion.data])

  const selectedQuestionStatus = selectedQuestion.data?.status

  return (
    <div className="rounded border border-slate-200 p-4">
      <div className="space-y-1">
        <div className="font-medium">Question Bank</div>
        <div className="text-sm text-slate-600">Create question banks, topics, and manage questions (review workflow supported).</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={
            'rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 ' +
            (activeSection === 'questionsList' ? 'bg-slate-50' : '')
          }
          onClick={() => setActiveSection('questionsList')}
        >
          Questions List
        </button>
        <button
          type="button"
          className={
            'rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 ' +
            (activeSection === 'questionEditor' ? 'bg-slate-50' : '')
          }
          onClick={() => setActiveSection('questionEditor')}
        >
          Question Editor
        </button>
        <button
          type="button"
          className={
            'rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 ' +
            (activeSection === 'examPackages' ? 'bg-slate-50' : '')
          }
          onClick={() => setActiveSection('examPackages')}
        >
          Exam Packages
        </button>
        <button
          type="button"
          className={
            'rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 ' +
            (activeSection === 'questionBanks' ? 'bg-slate-50' : '')
          }
          onClick={() => setActiveSection('questionBanks')}
        >
          Question Banks
        </button>
        <button
          type="button"
          className={
            'rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 ' +
            (activeSection === 'topics' ? 'bg-slate-50' : '')
          }
          onClick={() => setActiveSection('topics')}
        >
          Topics
        </button>
        <button
          type="button"
          className={
            'rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 ' +
            (activeSection === 'difficulties' ? 'bg-slate-50' : '')
          }
          onClick={() => setActiveSection('difficulties')}
        >
          Difficulties
        </button>
      </div>

      <div className="mt-6">
        {activeSection === 'questionsList' ? (
          <QuestionsListSection
            questionFilters={questionFilters}
            setQuestionFilters={setQuestionFilters}
            visiblePackagesForSelect={visiblePackagesForSelect}
            visibleTopics={visibleTopics}
            difficulties={difficulties}
            questions={questions}
            selectedQuestionId={selectedQuestionId}
            setSelectedQuestionId={setSelectedQuestionId}
            difficultiesById={difficultiesById}
            onSelectQuestion={() => {
              setQuestionEditorMode('edit')
              setActiveSection('questionEditor')
            }}
          />
        ) : null}

        {activeSection === 'questionEditor' ? (
          <QuestionEditorSection
            mode={questionEditorMode}
            setMode={setQuestionEditorMode}
            selectedQuestionId={selectedQuestionId}
            setSelectedQuestionId={setSelectedQuestionId}
            selectedQuestion={selectedQuestion}
            selectedQuestionStatus={selectedQuestionStatus}
            questionForm={questionForm}
            setQuestionForm={setQuestionForm}
            topics={topics}
            difficulties={difficulties}
            visiblePackagesForSelect={visiblePackagesForSelect}
            visibleTopicsForSelect={visibleTopicsForEditor}
            reviewRequestNote={reviewRequestNote}
            setReviewRequestNote={setReviewRequestNote}
            createQuestionMutation={createQuestionMutation}
            deleteQuestionMutation={deleteQuestionMutation}
            statusMutation={statusMutation}
            submitForReviewMutation={submitForReviewMutation}
            approveQuestionMutation={approveQuestionMutation}
            requestChangesMutation={requestChangesMutation}
            updateQuestionMutation={updateQuestionMutation}
            replaceChoicesMutation={replaceChoicesMutation}
          />
        ) : null}

        {activeSection === 'examPackages' ? (
          <ExamPackagesSection
            examPackages={examPackages}
            examPackageName={examPackageName}
            setExamPackageName={setExamPackageName}
            selectedExamPackageId={selectedExamPackageId}
            setSelectedExamPackageId={setSelectedExamPackageId}
            editExamPackageName={editExamPackageName}
            setEditExamPackageName={setEditExamPackageName}
            createExamPackageMutation={createExamPackageMutation}
            updateExamPackageMutation={updateExamPackageMutation}
            deleteExamPackageMutation={deleteExamPackageMutation}
          />
        ) : null}

        {activeSection === 'questionBanks' ? (
          <QuestionBanksSection
            examPackages={examPackages}
            packages={packages}
            packageName={packageName}
            setPackageName={setPackageName}
            packageExamPackageId={packageExamPackageId}
            setPackageExamPackageId={setPackageExamPackageId}
            selectedPackageId={selectedPackageId}
            setSelectedPackageId={setSelectedPackageId}
            editPackageName={editPackageName}
            setEditPackageName={setEditPackageName}
            editPackageExamPackageId={editPackageExamPackageId}
            setEditPackageExamPackageId={setEditPackageExamPackageId}
            editPackageIsHidden={editPackageIsHidden}
            setEditPackageIsHidden={setEditPackageIsHidden}
            createPackageMutation={createPackageMutation}
            updatePackageMutation={updatePackageMutation}
            deletePackageMutation={deletePackageMutation}
          />
        ) : null}

        {activeSection === 'topics' ? (
          <TopicsSection
            packages={packages}
            topics={topics}
            topicName={topicName}
            setTopicName={setTopicName}
            topicPackageId={topicPackageId}
            setTopicPackageId={setTopicPackageId}
            selectedTopicId={selectedTopicId}
            setSelectedTopicId={setSelectedTopicId}
            editTopicName={editTopicName}
            setEditTopicName={setEditTopicName}
            editTopicIsHidden={editTopicIsHidden}
            setEditTopicIsHidden={setEditTopicIsHidden}
            createTopicMutation={createTopicMutation}
            updateTopicMutation={updateTopicMutation}
            deleteTopicMutation={deleteTopicMutation}
          />
        ) : null}

        {activeSection === 'difficulties' ? (
          <DifficultiesSection
            difficulties={difficulties}
            selectedDifficultyId={selectedDifficultyId}
            setSelectedDifficultyId={setSelectedDifficultyId}
            editDifficultyDisplayName={editDifficultyDisplayName}
            setEditDifficultyDisplayName={setEditDifficultyDisplayName}
            updateDifficultyMutation={updateDifficultyMutation}
          />
        ) : null}
      </div>
    </div>
  )
}
