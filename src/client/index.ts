/**
 * Client half of dsh-tweakit — the browser side.
 *
 * `apply` wires four things to the plugin fiber:
 *  - the preference store over the official settings form service;
 *  - the single panel stylesheet controller (applies each tweak's effect);
 *  - the static section stylesheet;
 *  - the `settings.section` registration that renders the Tweaks tab.
 *
 * Every listener/timer/style is released by the effect disposer, so disabling
 * the plugin or HMR leaves no residue behind.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: supplies the `ctx.slots` Context augmentation.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ENTRY_ID, type SettingsPanelPrefs } from '../shared/prefs'
import { TweakitSection } from './TweakitSection'
import type { ConfigFormsFace } from './config-form'
import { copyFor, detectLanguage, langOf } from './i18n'
import { createPrefsStore } from './store'
import { createStyleController } from './style'
import { installUiStyle } from './ui-style'

/** Services the client half needs before it starts. */
export const inject = ['slots', 'configForms']

/** Structural view of the optional DSH locale service. */
interface LocaleFace {
  getSnapshot(): { readonly active: string }
  subscribe(listener: () => void): () => void
}

/**
 * Cordis plugin body.
 * @param ctx - client context.
 */
export function apply(ctx: Context): void {
  const configForms = ctx.get('configForms') as unknown as ConfigFormsFace
  const store = createPrefsStore({ form: configForms.get(ENTRY_ID) })
  const style = createStyleController()
  const removeUiStyle = installUiStyle()
  // Browser language is only the fallback: the Host-backed locale preference
  // wins, and it can arrive after this plugin starts.
  let language = detectLanguage()

  ctx.inject(['locale'], (child) => {
    const locale = child.get('locale') as unknown as LocaleFace
    const sync = (): void => {
      language = locale.getSnapshot().active
    }
    sync()
    child.effect(() => locale.subscribe(sync), 'dsh-tweakit: locale preference')
  })

  const applyPanelStyle = (): void => {
    const state = store.getSnapshot()
    // Before the first snapshot the shell keeps ownership: no flash of a
    // pre-load size while the Host form is still loading.
    if (!state.loaded) return
    style.apply(state.prefs.tweaks['settings-panel'] as SettingsPanelPrefs)
  }

  const unsubscribe = store.subscribe(applyPanelStyle)
  store.start()
  applyPanelStyle()

  ctx.effect(
    () => () => {
      unsubscribe()
      style.dispose()
      removeUiStyle()
      store.dispose()
    },
    'dsh-tweakit: client runtime',
  )

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'tweakit',
        order: 90,
        label: () => copyFor(language).tabLabel,
        inject: () => ({ store, copy: copyFor(language), lang: langOf(language) }),
      },
      TweakitSection,
    ),
  )
}
