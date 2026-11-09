/**
 * The `settings.section` page: a two-level navigation (groups → tweaks) plus
 * the selected tweak's generated form.
 *
 * The card is generated from `TWEAK_UI` metadata, so adding a tweak is a field
 * declaration plus an optional effect/extra — not a new page. Group headers and
 * the left rail only appear when more than one group owns a tweak.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PANEL_SELECTOR } from '../shared/panel-css'
import {
  TWEAK_UI,
  groupsWithTweaks,
  resolveSelection,
  tweaksInGroup,
  type SettingsPanelPrefs,
  type TweakId,
  type TweakSelection,
  type TweakUi,
} from '../shared/prefs'
import { TweakCard } from './TweakCard'
import { TweakNav, type NavGroup } from './TweakNav'
import { text, type Lang } from './TweakForm'
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

/**
 * Track the section's own width, which decides the navigation layout.
 *
 * The measurement is `null` until the element reports a positive width, and
 * callers treat `null` as wide: jsdom and the first paint must not collapse
 * into the compact layout by accident.
 */
function useSectionWidth(ref: { readonly current: HTMLElement | null }): number | null {
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const read = (): void => {
      const measured = Math.round(element.getBoundingClientRect().width)
      setWidth(measured > 0 ? measured : null)
    }
    read()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(read)
    observer?.observe(element)
    window.addEventListener('resize', read)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [ref])

  return width
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

/** Build the localized navigation tree from the registry. */
function buildGroups(lang: Lang): readonly NavGroup[] {
  return groupsWithTweaks().map((group) => ({
    id: group.id,
    title: text(group.title, lang),
    tweaks: tweaksInGroup(group.id).map((id) => ({ id, title: text(TWEAK_UI[id].title, lang) })),
  }))
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
  const width = useSectionWidth(rootRef)
  const [markerMissing, setMarkerMissing] = useState(false)
  const [requested, setRequested] = useState<TweakSelection>(() => resolveSelection(null))
  const panelId = useId()

  useEffect(() => {
    const root = rootRef.current
    setMarkerMissing(root !== null && root.closest(PANEL_SELECTOR) === null)
  }, [])

  const disabled = !state.loaded || !state.writable
  const groups = buildGroups(lang)
  const selection = resolveSelection(requested)
  const selectedUi = TWEAK_UI[selection.tweak] as unknown as TweakUi<Record<string, unknown>>
  const selectedPrefs = state.prefs.tweaks[selection.tweak] as unknown as Record<string, unknown>
  const extra = TWEAK_EXTRAS[selection.tweak]?.({ prefs: selectedPrefs, panelSize, viewport, copy })

  const compact = width !== null && width < 560
  const narrow = width !== null && width >= 560 && width < 720
  const layout = compact ? 'compact' : narrow ? 'narrow' : 'wide'

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

      {groups.length === 0 ? (
        <div className="tk-readout">{copy.empty}</div>
      ) : (
        <div className="tk-layout" data-mode={layout}>
          <TweakNav
            groups={groups}
            selection={selection}
            showGroupHeaders={groups.length > 1}
            compact={compact}
            copy={copy}
            idPrefix={panelId}
            onSelect={(group, tweak) => {
              // Both ids come from the tree built above, so they are registered.
              setRequested(
                resolveSelection({
                  group: group as TweakSelection['group'],
                  tweak: tweak as TweakId,
                }),
              )
            }}
          />

          <div className="tk-content">
            <div
              className="tk-panel"
              role="tabpanel"
              id={`${panelId}-panel`}
              aria-label={text(selectedUi.title, lang)}
              tabIndex={-1}
            >
              <TweakCard
                ui={selectedUi}
                prefs={selectedPrefs}
                lang={lang}
                copy={copy}
                status={state.status}
                disabled={disabled}
                onPatch={(next) => {
                  store.patchAny(selection.tweak, next)
                }}
                onReset={() => {
                  store.reset(selection.tweak)
                }}
                extra={extra}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
