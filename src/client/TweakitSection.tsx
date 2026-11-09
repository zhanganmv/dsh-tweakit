/**
 * The `settings.section` page: a container that projects every registered
 * tweak group. Each card is generated from `TWEAK_UI` metadata, so adding a
 * tweak is a field declaration plus an optional effect/extra — not a new page.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PANEL_SELECTOR } from '../shared/panel-css'
import {
  TWEAK_IDS,
  TWEAK_UI,
  type SettingsPanelPrefs,
  type TweakId,
  type TweakUi,
} from '../shared/prefs'
import { TweakCard } from './TweakCard'
import { type Lang } from './TweakForm'
import type { Copy } from './i18n'
import type { PrefsFailure, PrefsStore } from './store'

/** Injected business face registered with the section. */
export interface TweakitSectionInjected {
  readonly store: PrefsStore
  readonly copy: Copy
  readonly lang: Lang
}

/** Complete section props: runtime owner share plus the injected face. */
export type TweakitSectionProps = PropsRuntime<'settings.section'> & TweakitSectionInjected

/** Context handed to a tweak's custom extra content. */
interface TweakExtraContext {
  readonly prefs: Record<string, unknown>
  readonly panelSize: { readonly width: number; readonly height: number } | null
  readonly viewport: { readonly width: number; readonly height: number }
  readonly copy: Copy
}

/** Optional custom content per tweak (readouts, previews). */
const TWEAK_EXTRAS: Partial<Record<TweakId, (context: TweakExtraContext) => ReactNode>> = {
  'settings-panel': ({ prefs, panelSize, viewport, copy }) => {
    const panel = prefs as unknown as SettingsPanelPrefs
    return (
      <div className="tk-readout" aria-live="polite">
        {copy.effective(panelSize, viewport, panel.mode)}
      </div>
    )
  },
}

/** Track the browser viewport for the size readout. */
function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    const update = (): void => {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [])

  return size
}

/** Track the live settings panel size (it changes while the user drags). */
function usePanelSize(): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const read = (): void => {
      const element = document.querySelector(PANEL_SELECTOR)
      if (element === null) return
      const rect = element.getBoundingClientRect()
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) })
    }

    read()
    const element = document.querySelector(PANEL_SELECTOR)
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => read())
    if (observer !== undefined && element !== null) observer.observe(element)
    window.addEventListener('resize', read)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [])

  return size
}

/** Localized failure copy for one store failure. */
function failureText(failure: PrefsFailure, copy: Copy): string {
  if (failure.code === 'settings-conflict') return copy.conflict
  if (failure.code === 'settings-unavailable') return copy.unavailable
  return failure.source === 'load' ? copy.readFailed : copy.saveFailed
}

/**
 * Render the Tweaks settings page.
 * @param props - injected store, copy, and language.
 * @returns the section body.
 */
export function TweakitSection({ store, copy, lang }: TweakitSectionProps) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const viewport = useViewport()
  const panelSize = usePanelSize()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [markerMissing, setMarkerMissing] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    setMarkerMissing(root !== null && root.closest(PANEL_SELECTOR) === null)
  }, [])

  const disabled = !state.loaded || !state.writable
  const ordered = [...TWEAK_IDS].sort((left, right) => TWEAK_UI[left].order - TWEAK_UI[right].order)

  return (
    <div className="tk-section" ref={rootRef}>
      <header>
        <h2 className="tk-section-title">{copy.title}</h2>
        <p className="tk-section-intro">{copy.intro}</p>
      </header>

      {!state.loaded ? <div className="tk-readout">{copy.loading}</div> : null}

      {state.error !== null ? (
        <div className="tk-alert" role="alert">
          <span className="tk-alert-text">{failureText(state.error, copy)}</span>
          <button type="button" className="tk-button" onClick={store.refresh}>
            {copy.retry}
          </button>
        </div>
      ) : null}

      {markerMissing ? (
        <div className="tk-alert" data-tone="warn" role="status">
          <span className="tk-alert-text">{copy.markerMissing}</span>
        </div>
      ) : null}

      {ordered.map((id) => {
        const ui = TWEAK_UI[id] as unknown as TweakUi<Record<string, unknown>>
        const prefs = state.prefs.tweaks[id] as unknown as Record<string, unknown>
        const extra = TWEAK_EXTRAS[id]?.({ prefs, panelSize, viewport, copy })
        return (
          <TweakCard
            key={id}
            ui={ui}
            prefs={prefs}
            lang={lang}
            copy={copy}
            status={state.status}
            disabled={disabled}
            onPatch={(next) => {
              store.patchAny(id, next)
            }}
            onReset={() => {
              store.reset(id)
            }}
            extra={extra}
          />
        )
      })}
    </div>
  )
}
