import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfigFormFace, SettingsPathOp } from '../src/client/config-form'
import { createPrefsStore } from '../src/client/store'
import {
  DEFAULT_SETTINGS_PANEL,
  PREFS_VERSION,
  type SettingsPanelPrefs,
  toWire,
} from '../src/shared/prefs'

/** One recorded write. */
interface RecordedWrite {
  readonly ops: readonly SettingsPathOp[]
  readonly expectedRevision: number | undefined
}

interface FakeForm extends ConfigFormFace {
  readonly writes: RecordedWrite[]
  readonly value: Record<string, unknown>
  readonly revision: number
  setAccept(value: boolean): void
  setStatus(value: 'loading' | 'ready' | 'unavailable'): void
  setWritable(value: boolean): void
  failNext(error: Error): void
}

/** In-memory form with revision bumping, mirroring the settings provider. */
function createFakeForm(
  panel: SettingsPanelPrefs = DEFAULT_SETTINGS_PANEL,
  startRevision = 0,
): FakeForm {
  let value = toWire({ version: PREFS_VERSION, tweaks: { 'settings-panel': panel } })
  let revision = startRevision
  let status: 'loading' | 'ready' | 'unavailable' = 'ready'
  let writable = true
  let accept = true
  let failure: Error | undefined
  const listeners = new Set<() => void>()
  const writes: RecordedWrite[] = []

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  const apply = (ops: readonly SettingsPathOp[]): void => {
    for (const op of ops) {
      const field = op.path[0]
      if (field === undefined) continue
      if (op.op === 'set') value = { ...value, [field]: op.value }
      else {
        const next = { ...value }
        delete next[field]
        value = next
      }
    }
    revision += 1
    notify()
  }

  const mutate = async (ops: readonly SettingsPathOp[], expectedRevision?: number) => {
    writes.push({ ops, expectedRevision })
    if (failure !== undefined) {
      const error = failure
      failure = undefined
      throw error
    }
    if (!accept) return false
    apply(ops)
    return true
  }

  return {
    writes,
    get value() {
      return value
    },
    get revision() {
      return revision
    },
    getSnapshot: () => ({
      status,
      value,
      base: toWire({
        version: PREFS_VERSION,
        tweaks: { 'settings-panel': DEFAULT_SETTINGS_PANEL },
      }),
      user: value,
      revision,
      writable,
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: (field, next) => mutate([{ op: 'set', path: [field], value: next }]),
    unset: (field) => mutate([{ op: 'unset', path: [field] }]),
    mutate,
    setAccept: (next) => {
      accept = next
    },
    setStatus: (next) => {
      status = next
      notify()
    },
    setWritable: (next) => {
      writable = next
      notify()
    },
    failNext: (error) => {
      failure = error
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('config-form backed prefs store', () => {
  it('seeds from the Host snapshot', () => {
    const form = createFakeForm({ ...DEFAULT_SETTINGS_PANEL, width: 1500 }, 7)
    const store = createPrefsStore({ form })
    store.start()

    expect(store.getSnapshot()).toMatchObject({
      loaded: true,
      revision: 7,
      writable: true,
      status: 'idle',
      error: null,
    })
    expect(store.getSnapshot().prefs.tweaks['settings-panel'].width).toBe(1500)
    store.dispose()
  })

  it('previews optimistically and writes one debounced op batch', async () => {
    const form = createFakeForm(DEFAULT_SETTINGS_PANEL, 3)
    const store = createPrefsStore({ form, debounceMs: 200 })
    store.start()

    store.patchAny('settings-panel', { width: 1500 })
    expect(store.getSnapshot().prefs.tweaks['settings-panel'].width).toBe(1500)
    expect(store.getSnapshot().status).toBe('saving')

    await vi.advanceTimersByTimeAsync(199)
    expect(form.writes).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)

    expect(form.writes).toHaveLength(1)
    expect(form.writes[0]).toEqual({
      ops: [{ op: 'set', path: ['settingsPanelWidth'], value: 1500 }],
      expectedRevision: 3,
    })
    expect(form.value['settingsPanelWidth']).toBe(1500)
    expect(store.getSnapshot().status).toBe('saved')
    expect(store.getSnapshot().revision).toBe(4)

    await vi.advanceTimersByTimeAsync(1500)
    expect(store.getSnapshot().status).toBe('idle')
    store.dispose()
  })

  it('coalesces rapid edits into one atomic mutate', async () => {
    const form = createFakeForm()
    const store = createPrefsStore({ form, debounceMs: 200 })
    store.start()

    store.patchAny('settings-panel', { width: 1400 })
    store.patchAny('settings-panel', { width: 1500 })
    store.patchAny('settings-panel', { height: 900 })
    await vi.advanceTimersByTimeAsync(200)

    expect(form.writes).toHaveLength(1)
    expect(form.writes[0]?.ops).toEqual([
      { op: 'set', path: ['settingsPanelWidth'], value: 1500 },
      { op: 'set', path: ['settingsPanelHeight'], value: 900 },
    ])
    store.dispose()
  })

  it('re-seeds from the Host when a write is refused', async () => {
    const form = createFakeForm()
    form.setAccept(false)
    const store = createPrefsStore({ form, debounceMs: 10 })
    store.start()

    store.patchAny('settings-panel', { width: 1500 })
    await vi.advanceTimersByTimeAsync(10)

    expect(store.getSnapshot().prefs.tweaks['settings-panel'].width).toBe(1360)
    expect(store.getSnapshot().status).toBe('error')
    expect(store.getSnapshot().error).toMatchObject({
      code: 'settings-conflict',
      source: 'save',
    })
    store.dispose()
  })

  it('reports a transport failure and rolls back', async () => {
    const form = createFakeForm()
    form.failNext(new Error('offline'))
    const store = createPrefsStore({ form, debounceMs: 10 })
    store.start()

    store.patchAny('settings-panel', { width: 1500 })
    await vi.advanceTimersByTimeAsync(10)

    expect(store.getSnapshot().prefs.tweaks['settings-panel'].width).toBe(1360)
    expect(store.getSnapshot().status).toBe('error')
    expect(store.getSnapshot().error).toMatchObject({ code: 'unknown', source: 'save' })
    store.dispose()
  })

  it('reports an unavailable namespace and disables saving', async () => {
    const form = createFakeForm()
    form.setStatus('unavailable')
    const store = createPrefsStore({ form })
    store.start()

    expect(store.getSnapshot()).toMatchObject({
      loaded: false,
      status: 'idle',
      error: { code: 'settings-unavailable', source: 'load' },
    })
    store.dispose()
  })

  it('clears every field back to the composition layer on reset', async () => {
    const form = createFakeForm()
    const store = createPrefsStore({ form, debounceMs: 10 })
    store.start()

    store.patchAny('settings-panel', { mode: 'full', margin: 0 })
    await vi.advanceTimersByTimeAsync(10)
    expect(store.getSnapshot().prefs.tweaks['settings-panel'].mode).toBe('full')

    store.reset('settings-panel')
    await vi.advanceTimersByTimeAsync(0)

    const last = form.writes.at(-1)
    expect(last?.ops).toHaveLength(4)
    expect(last?.ops.every((op) => op.op === 'unset')).toBe(true)
    expect(store.getSnapshot().prefs.tweaks['settings-panel']).toEqual(DEFAULT_SETTINGS_PANEL)
    store.dispose()
  })

  it('drops pending work on dispose', async () => {
    const form = createFakeForm()
    const store = createPrefsStore({ form, debounceMs: 200 })
    store.start()

    store.patchAny('settings-panel', { width: 1500 })
    store.dispose()
    await vi.advanceTimersByTimeAsync(500)
    expect(form.writes).toHaveLength(0)
  })
})
