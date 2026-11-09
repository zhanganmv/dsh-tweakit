/**
 * Client preference store backed by the official settings form service.
 *
 * The Host is the fact source: `ctx.configForms.get(entryId)` carries the
 * resolved Config section, its revision fence, writability, and user/base
 * layers. The store keeps an optimistic copy for immediate preview (a slider
 * must move the panel before the round trip), debounces one revision-fenced
 * `mutate`, and re-seeds from the Host snapshot when the write settles.
 */
import {
  PREFS_VERSION,
  TWEAK_DESCRIPTORS,
  fromWire,
  toWire,
  type TweakId,
  type TweakPrefsMap,
  type TweakitPrefs,
} from '../shared/prefs'
import type { ConfigFormFace, SettingsPathOp } from './config-form'

/** Save feedback shown beside the group title. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** One failure the section can translate into localized copy. */
export interface PrefsFailure {
  readonly code: string
  readonly message: string
  /** Whether the failure happened while reading or while writing. */
  readonly source: 'load' | 'save'
}

/** Immutable store snapshot. */
export interface PrefsState {
  readonly prefs: TweakitPrefs
  readonly revision: number
  readonly writable: boolean
  readonly loaded: boolean
  readonly status: SaveStatus
  readonly error: PrefsFailure | null
}

/** Store construction options (timings are injectable for tests). */
export interface PrefsStoreOptions {
  readonly form: ConfigFormFace
  /** Debounce before a write leaves the browser. Defaults to 200ms. */
  readonly debounceMs?: number
  /** How long the “saved” badge stays visible. Defaults to 1500ms. */
  readonly savedFlashMs?: number
}

/** The store surface the section component consumes. */
export interface PrefsStore {
  getSnapshot(): PrefsState
  subscribe(listener: () => void): () => void
  /** Begin following the Host form snapshot. */
  start(): void
  /** Re-seed from the Host snapshot (retry / conflict recovery). */
  refresh(): void
  /** Optimistically patch one typed tweak slice and schedule a save. */
  patch<K extends TweakId>(id: K, next: Partial<TweakPrefsMap[K]>): void
  /** Generic-renderer entry point: patch a tweak with an untyped field bag. */
  patchAny(id: TweakId, next: Record<string, unknown>): void
  /** Restore one tweak slice to its defaults (clears the user layer). */
  reset(id: TweakId): void
  dispose(): void
}

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Build the next document with one tweak slice replaced. */
function withTweak<K extends TweakId>(
  prefs: TweakitPrefs,
  id: K,
  value: TweakPrefsMap[K],
): TweakitPrefs {
  const tweaks = { ...prefs.tweaks, [id]: value } as TweakPrefsMap
  return { version: PREFS_VERSION, tweaks }
}

/** Flat wire diff against the Host section. */
function diffOps(current: unknown, target: Record<string, unknown>): SettingsPathOp[] {
  const section = isRecord(current) ? current : {}
  const ops: SettingsPathOp[] = []
  for (const [field, value] of Object.entries(target)) {
    if (section[field] !== value) ops.push({ op: 'set', path: [field], value })
  }
  return ops
}

/** Normalize a thrown value into a UI-friendly failure. */
function failureOf(cause: unknown, source: 'load' | 'save'): PrefsFailure {
  return {
    code: 'unknown',
    message: cause instanceof Error ? cause.message : String(cause),
    source,
  }
}

/**
 * Create the preference store.
 * @param options - settings form and timing options.
 * @returns the store instance.
 */
export function createPrefsStore(options: PrefsStoreOptions): PrefsStore {
  const form = options.form
  const debounceMs = options.debounceMs ?? 200
  const savedFlashMs = options.savedFlashMs ?? 1500

  let state: PrefsState = {
    prefs: fromWire(undefined),
    revision: 0,
    writable: true,
    loaded: false,
    status: 'idle',
    error: null,
  }
  let dirty = false
  let inflight = false
  let disposed = false
  let unsubscribe: (() => void) | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let flashTimer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const setState = (next: PrefsState): void => {
    state = next
    emit()
  }

  /** Re-seed from the Host snapshot; optimistic prefs survive while dirty. */
  const syncFromForm = (force: boolean): void => {
    const snapshot = form.getSnapshot()
    const loaded = snapshot.status === 'ready'
    const revision = snapshot.revision ?? state.revision
    const prefs =
      loaded && snapshot.value !== undefined && (force || !dirty)
        ? fromWire(snapshot.value)
        : state.prefs
    const error: PrefsFailure | null =
      snapshot.status === 'unavailable'
        ? {
            code: 'settings-unavailable',
            message: 'the settings namespace is not served to this client',
            source: 'load',
          }
        : state.error
    setState({
      prefs,
      revision,
      writable: snapshot.writable,
      loaded,
      status: state.status,
      error,
    })
  }

  /** Clear the visible “saved” badge after a short hold. */
  const scheduleFlash = (): void => {
    if (flashTimer !== undefined) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flashTimer = undefined
      if (!disposed && state.status === 'saved') setState({ ...state, status: 'idle' })
    }, savedFlashMs)
  }

  /** Debounce the next flush. */
  const schedule = (): void => {
    if (disposed) return
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void flush()
    }, debounceMs)
  }

  /** Write one op batch and fold the Host answer back into the store. */
  const send = async (ops: readonly SettingsPathOp[]): Promise<void> => {
    inflight = true
    try {
      const accepted = await form.mutate(ops, state.revision)
      if (disposed) return
      dirty = false
      syncFromForm(true)
      if (accepted) {
        setState({ ...state, status: 'saved', error: null })
        scheduleFlash()
      } else {
        setState({
          ...state,
          status: 'error',
          error: {
            code: 'settings-conflict',
            message: 'the Host refused the write; the form was refreshed',
            source: 'save',
          },
        })
      }
    } catch (cause) {
      if (disposed) return
      dirty = false
      syncFromForm(true)
      setState({ ...state, status: 'error', error: failureOf(cause, 'save') })
    } finally {
      inflight = false
      if (!disposed && dirty) schedule()
    }
  }

  /** Flush the current optimistic document. */
  const flush = async (): Promise<void> => {
    if (disposed || inflight) return
    const snapshot = form.getSnapshot()
    if (snapshot.status !== 'ready') {
      dirty = false
      syncFromForm(true)
      setState({
        ...state,
        status: 'error',
        error: {
          code: 'settings-unavailable',
          message: 'the settings namespace is not served to this client',
          source: 'load',
        },
      })
      return
    }

    const ops = diffOps(snapshot.value, toWire(state.prefs))
    if (ops.length === 0) {
      dirty = false
      if (state.status !== 'idle') setState({ ...state, status: 'idle' })
      return
    }
    await send(ops)
  }

  const patchAny = (id: TweakId, next: Record<string, unknown>): void => {
    if (disposed) return
    const current = state.prefs.tweaks[id] as unknown as Record<string, unknown>
    const normalized = TWEAK_DESCRIPTORS[id].normalize({
      ...current,
      ...next,
    }) as unknown as TweakPrefsMap[typeof id]
    const prefs = withTweak(state.prefs, id, normalized)
    if (diffOps(toWire(state.prefs), toWire(prefs)).length === 0) return
    dirty = true
    setState({ ...state, prefs, status: 'saving', error: null })
    schedule()
  }

  const patch = <K extends TweakId>(id: K, next: Partial<TweakPrefsMap[K]>): void => {
    patchAny(id, next as Record<string, unknown>)
  }

  const reset = (id: TweakId): void => {
    if (disposed) return
    const defaults = TWEAK_DESCRIPTORS[id].defaults() as unknown as TweakPrefsMap[typeof id]
    const prefs = withTweak(state.prefs, id, defaults)
    const fields = Object.keys(TWEAK_DESCRIPTORS[id].toWire(defaults as never))
    const ops: SettingsPathOp[] = fields.map((field) => ({ op: 'unset', path: [field] }))
    dirty = true
    setState({ ...state, prefs, status: 'saving', error: null })
    if (ops.length === 0) {
      dirty = false
      return
    }
    if (inflight) {
      schedule()
      return
    }
    void send(ops)
  }

  const start = (): void => {
    if (disposed) return
    unsubscribe = form.subscribe(() => syncFromForm(false))
    syncFromForm(true)
  }

  const refresh = (): void => {
    setState({ ...state, error: null })
    syncFromForm(true)
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start,
    refresh,
    patch,
    patchAny,
    reset,
    dispose: () => {
      disposed = true
      listeners.clear()
      unsubscribe?.()
      unsubscribe = undefined
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
      if (flashTimer !== undefined) clearTimeout(flashTimer)
      debounceTimer = undefined
      flashTimer = undefined
    },
  }
}
