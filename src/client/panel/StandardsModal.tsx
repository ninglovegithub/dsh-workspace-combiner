/**
 * 开发规范弹窗：内置规范勾选/编辑/恢复默认、全局与工作空间级自建规范、
 * 按技术栈自动匹配、可选 AI 起草、token 估算与预算。
 * @module dsh-workspace-combiner/client/panel/StandardsModal
 */

import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import type { WorkspaceRef, WorkspaceStandards } from '../../core/types.ts'
import { BUILTIN_STANDARDS, resolveStandardGroups, type StandardsLibrary } from '../../core/standards.ts'
import { renderStandards, renderStandardsText } from '../../prompt.ts'
import { estimateTokens } from '../../core/fileTree.ts'
import { DEFAULT_STANDARDS_BUDGET } from '../../invariant.ts'
import { tt } from '../locales.ts'
import { Dialog } from './Dialog.tsx'
import { BudgetLevelPicker } from './BudgetLevelPicker.tsx'
import { tokenText } from './tokenFormat.ts'

interface StandardsModalProps {
  standards: WorkspaceStandards
  library: StandardsLibrary
  directories: readonly WorkspaceRef[]
  onSaveWorkspace(next: WorkspaceStandards): void
  onSaveLibrary(next: StandardsLibrary): void
  /** 用模型起草规范正文（可选能力）。 */
  onGenerateDraft(request: { name: string; tech?: string; directory?: string; hint?: string }): Promise<string>
  onClose(): void
}

/** 一行规范的展示信息。 */
interface Row {
  id: string
  name: string
  tech: string
  summary: string
  body: string
  kind: 'builtin' | 'global-custom' | 'workspace-custom'
  overridden: boolean
}

export function StandardsModal({ standards, library, directories, onSaveWorkspace, onSaveLibrary, onGenerateDraft, onClose }: StandardsModalProps): ReactElement {
  const [draftWs, setDraftWs] = useState<WorkspaceStandards>(() => ({ ...standards }))
  const [draftLib, setDraftLib] = useState<StandardsLibrary>(() => ({
    version: 1,
    overrides: { ...library.overrides },
    custom: library.custom.map(item => ({ ...item })),
  }))
  const [target, setTarget] = useState<string>('global')
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_STANDARDS[0]?.id ?? '')
  const [newName, setNewName] = useState<string>('')
  const [newScope, setNewScope] = useState<'global' | 'workspace'>('global')
  const [editScope, setEditScope] = useState<'global' | 'workspace'>('global')
  const [aiHint, setAiHint] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)
  // token 估算按正文缓存：编辑某一行时不必把其它行的正文重新遍历一遍。
  const tokenCache = useRef<Map<string, number>>(new Map())
  const tokensOf = (body: string): number => {
    const cached = tokenCache.current.get(body)
    if (cached !== undefined) return cached
    const value = estimateTokens(body)
    if (tokenCache.current.size > 500) tokenCache.current.clear()
    tokenCache.current.set(body, value)
    return value
  }

  const rows = useMemo<Row[]>(() => {
    const workspaceOverrides = draftWs.workspaceOverrides ?? {}
    const builtin: Row[] = BUILTIN_STANDARDS.map(preset => {
      const globalText = draftLib.overrides[preset.id]
      const workspaceText = workspaceOverrides[preset.id]
      return {
        id: preset.id,
        name: preset.name,
        tech: preset.tech,
        summary: preset.summary,
        body: workspaceText ?? globalText ?? preset.body,
        kind: 'builtin',
        overridden: workspaceText !== undefined || globalText !== undefined,
      }
    })
    const globalCustom: Row[] = draftLib.custom.map(item => ({
      id: item.id, name: item.name, tech: item.tech, summary: item.summary, body: item.body, kind: 'global-custom', overridden: false,
    }))
    const workspaceCustom: Row[] = (draftWs.workspaceCustom ?? []).map(item => ({
      id: item.id, name: item.name, tech: item.tech, summary: item.summary, body: item.body, kind: 'workspace-custom', overridden: false,
    }))
    return [...builtin, ...globalCustom, ...workspaceCustom]
  }, [draftLib, draftWs.workspaceCustom, draftWs.workspaceOverrides])

  const activeIds = target === 'global' ? (draftWs.global ?? []) : (draftWs.perDirectory?.[target] ?? [])
  const activeSet = new Set(activeIds)

  const setActive = (ids: string[]): void => {
    if (target === 'global') {
      setDraftWs(prev => ({ ...prev, global: ids }))
    } else {
      setDraftWs(prev => {
        const perDirectory = { ...(prev.perDirectory ?? {}) }
        if (ids.length === 0) delete perDirectory[target]
        else perDirectory[target] = ids
        return { ...prev, perDirectory }
      })
    }
  }

  const toggle = (id: string): void => {
    const next = activeSet.has(id) ? activeIds.filter(x => x !== id) : [...activeIds, id]
    setActive(next)
  }

  const setBody = (row: Row, text: string): void => {
    if (row.kind === 'builtin') {
      if (editScope === 'workspace') {
        setDraftWs(prev => ({ ...prev, workspaceOverrides: { ...(prev.workspaceOverrides ?? {}), [row.id]: text } }))
      } else {
        setDraftLib(prev => ({ ...prev, overrides: { ...prev.overrides, [row.id]: text } }))
      }
    } else if (row.kind === 'global-custom') {
      setDraftLib(prev => ({ ...prev, custom: prev.custom.map(item => item.id === row.id ? { ...item, body: text } : item) }))
    } else {
      setDraftWs(prev => ({ ...prev, workspaceCustom: (prev.workspaceCustom ?? []).map(item => item.id === row.id ? { ...item, body: text } : item) }))
    }
  }

  const resetDefault = (row: Row): void => {
    if (row.kind !== 'builtin') return
    setDraftLib(prev => {
      const overrides = { ...prev.overrides }
      delete overrides[row.id]
      return { ...prev, overrides }
    })
    setDraftWs(prev => {
      const workspaceOverrides = { ...(prev.workspaceOverrides ?? {}) }
      delete workspaceOverrides[row.id]
      return { ...prev, workspaceOverrides }
    })
  }

  const createCustom = (): void => {
    const name = newName.trim()
    if (name === '') return
    const id = 'custom-' + Math.random().toString(36).slice(2, 10)
    if (newScope === 'global') {
      setDraftLib(prev => ({ ...prev, custom: [...prev.custom, { id, name, tech: tt('standardsCustomTech'), summary: '', body: '' }] }))
    } else {
      setDraftWs(prev => ({ ...prev, workspaceCustom: [...(prev.workspaceCustom ?? []), { id, name, tech: tt('standardsCustomTech'), summary: '', body: '' }] }))
    }
    setSelectedId(id)
    setNewName('')
  }

  const deleteCustom = (row: Row): void => {
    if (row.kind === 'global-custom') {
      setDraftLib(prev => ({ ...prev, custom: prev.custom.filter(item => item.id !== row.id) }))
    } else if (row.kind === 'workspace-custom') {
      setDraftWs(prev => ({ ...prev, workspaceCustom: (prev.workspaceCustom ?? []).filter(item => item.id !== row.id) }))
    }
    setActive(activeIds.filter(x => x !== row.id))
    if (selectedId === row.id) setSelectedId(BUILTIN_STANDARDS[0]?.id ?? '')
  }

  const copyBody = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 剪贴板不可用时忽略
    }
  }

  // 严格查找：`?? rows[0]` 会让 selectedId 失效时标题显示 A、编辑实际写到 B。
  const selected = rows.find(row => row.id === selectedId)
  const budget = draftWs.budget ?? DEFAULT_STANDARDS_BUDGET
  // 与工作空间卡片头保持一致：统计**全部生效分组**（全局 + 逐目录 + 自动匹配），
  // 而不是当前选中作用域的合计——否则切到某个没有规范目录时会显示 0 token。
  const effectiveSize = useMemo(() => {
    const groups = resolveStandardGroups(draftWs, directories, library)
    if (groups.length === 0) return { content: 0, injected: 0 }
    return {
      content: estimateTokens(renderStandardsText(groups)),
      injected: estimateTokens(renderStandards(groups, budget)),
    }
  }, [draftWs, directories, library, budget])

  const targetDirectory = directories.find(dir => dir.path === target)
  const autoMatched = targetDirectory === undefined ? undefined : BUILTIN_STANDARDS.find(preset => preset.matchTypes?.includes(targetDirectory.projectType ?? 'none') === true)

  const generate = async (row: Row): Promise<void> => {
    setAiLoading(true)
    try {
      const text = await onGenerateDraft({
        name: row.name,
        tech: row.tech,
        ...(targetDirectory === undefined ? {} : { directory: targetDirectory.name }),
        ...(aiHint.trim() === '' ? {} : { hint: aiHint.trim() }),
      })
      if (text !== '') setBody(row, text)
    } finally {
      setAiLoading(false)
    }
  }

  const close = (): void => { onClose() }
  const save = (): void => {
    onSaveWorkspace(draftWs)
    onSaveLibrary(draftLib)
    onClose()
  }

  const renderGroup = (label: string, items: Row[]): ReactElement => (
    <div className="wcb-std-group" key={label}>
      <div className="wcb-std-group-title">{label}</div>
      {items.map(row => (
        <div key={row.id} className={'wcb-std-item' + (row.id === selectedId ? ' wcb-std-item-on' : '')}>
          <input type="checkbox" className="wcb-checkbox" checked={activeSet.has(row.id)} aria-label={row.name} onChange={() => toggle(row.id)} />
          <button type="button" className="wcb-std-name" onClick={() => setSelectedId(row.id)}>
            {row.name}
            {row.overridden ? <span className="wcb-std-flag">{tt('standardsOverridden')}</span> : null}
          </button>
          <span className="wcb-std-meta">{tokenText(tokensOf(row.body))}</span>
        </div>
      ))}
    </div>
  )

  return (
    <Dialog title={tt('standardsTitle')} onClose={close} wide className="wcb-std-modal">

        <div className="wcb-std-toolbar">
          <span className="wcb-label" style={{ margin: 0 }}>{tt('standardsTarget')}</span>
          <select className="wcb-input" style={{ width: 'auto' }} value={target} aria-label={tt('standardsTarget')} onChange={(event: ChangeEvent<HTMLSelectElement>) => setTarget(event.currentTarget.value)}>
            <option value="global">{tt('standardsTargetGlobal')}</option>
            {directories.map(dir => (
              <option key={dir.path} value={dir.path}>{dir.name + ' — ' + dir.path}</option>
            ))}
          </select>
          <label className="wcb-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={draftWs.autoMatch ?? true} aria-label={tt('standardsAutoMatch')} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftWs(prev => ({ ...prev, autoMatch: event.currentTarget.checked }))} />
            {tt('standardsAutoMatch')}
          </label>
          <div className="wcb-head-actions">
            <span className="wcb-label" style={{ margin: 0 }}>{tt('standardsBudget')}</span>
            <BudgetLevelPicker block="standards" value={budget} title={tt('standardsBudget')}
              onChange={(value) => setDraftWs(prev => ({ ...prev, budget: value }))} />
          </div>
        </div>

        {autoMatched !== undefined && target !== 'global' ? (
          <div className="wcb-hint">{tt('standardsAutoMatched', { name: autoMatched.name })}</div>
        ) : null}

        <div className="wcb-std-split">
          <div className="wcb-std-list">
            {renderGroup(tt('standardsBuiltin'), rows.filter(row => row.kind === 'builtin'))}
            {draftLib.custom.length > 0 ? renderGroup(tt('standardsScopeGlobal'), rows.filter(row => row.kind === 'global-custom')) : null}
            {(draftWs.workspaceCustom ?? []).length > 0 ? renderGroup(tt('standardsScopeWorkspace'), rows.filter(row => row.kind === 'workspace-custom')) : null}
            <div className="wcb-std-new">
              <input className="wcb-input" value={newName} placeholder={tt('standardsNamePlaceholder')} aria-label={tt('standardsNamePlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewName(event.currentTarget.value)} />
              <select className="wcb-input" style={{ width: 'auto' }} value={newScope} aria-label={tt('standardsScopeGlobal')} onChange={(event: ChangeEvent<HTMLSelectElement>) => setNewScope(event.currentTarget.value === 'workspace' ? 'workspace' : 'global')}>
                <option value="global">{tt('standardsScopeGlobalShort')}</option>
                <option value="workspace">{tt('standardsScopeWorkspaceShort')}</option>
              </select>
              <button type="button" className="wcb-btn" disabled={newName.trim() === ''} onClick={createCustom}>{tt('standardsNewCustom')}</button>
            </div>
          </div>

          <div className="wcb-std-pane">
            {selected === undefined ? (
              <div className="wcb-hint">{tt('standardsSelectHint')}</div>
            ) : (
              <>
                <div className="wcb-std-pane-head">
                  <span className="wcb-std-pane-title">{selected.name}</span>
                  <div className="wcb-head-actions">
                    <input className="wcb-input" style={{ width: 150 }} value={aiHint} placeholder={tt('standardsAiHint')} aria-label={tt('standardsAiHint')} onChange={(event: ChangeEvent<HTMLInputElement>) => setAiHint(event.currentTarget.value)} />
                    <button type="button" className="wcb-linkbtn" disabled={aiLoading} onClick={() => void generate(selected)}>{aiLoading ? tt('standardsAiLoading') : tt('standardsAiGenerate')}</button>
                    <button type="button" className="wcb-linkbtn" onClick={() => void copyBody(selected.body)}>{tt('standardsCopy')}</button>
                    {selected.kind === 'builtin' ? (
                      <button type="button" className="wcb-linkbtn" disabled={!selected.overridden} onClick={() => resetDefault(selected)}>{tt('standardsResetDefault')}</button>
                    ) : (
                      <button type="button" className="wcb-linkbtn wcb-iconbtn-danger" onClick={() => deleteCustom(selected)}>{tt('standardsDeleteCustom')}</button>
                    )}
                  </div>
                </div>
                {selected.kind === 'builtin' ? (
                  <div className="wcb-std-pane-head">
                    <span className="wcb-label" style={{ margin: 0 }}>{tt('standardsScopeLabel')}</span>
                    <select className="wcb-input" style={{ width: 'auto' }} value={editScope} aria-label={tt('standardsScopeLabel')} onChange={(event: ChangeEvent<HTMLSelectElement>) => setEditScope(event.currentTarget.value === 'workspace' ? 'workspace' : 'global')}>
                      <option value="global">{tt('standardsScopeGlobalShort')}</option>
                      <option value="workspace">{tt('standardsScopeWorkspaceShort')}</option>
                    </select>
                    <span className="wcb-hint">{tt('standardsScopeHint')}</span>
                  </div>
                ) : null}
                {selected.summary !== '' ? <div className="wcb-hint">{selected.summary}</div> : null}
                <textarea className="wcb-std-editor" value={selected.body} aria-label={selected.name} placeholder={tt('standardsBodyPlaceholder')} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setBody(selected, event.currentTarget.value)} />
              </>
            )}
          </div>
        </div>

        <div className="wcb-modal-actions">
          <span className="wcb-hint" style={{ marginRight: 'auto' }}>
            {budget > 0 ? tokenText(effectiveSize.injected) + ' / ' + tokenText(budget) : tokenText(effectiveSize.content) + ' · ' + tt('budgetOnDemand')}
          </span>
          <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={close}>{tt('cancel')}</button>
          <button type="button" className="wcb-btn-primary" aria-label={tt('standardsSave')} onClick={save}>{tt('standardsSave')}</button>
        </div>
    </Dialog>
  )
}
