/**
 * Single stylesheet owner for the settings-panel size tweak.
 *
 * One `<style data-dsh-tweakit-panel>` element is created, updated, and
 * removed here — no other module may touch the panel's sizing. `default` mode
 * removes the element entirely so the shell's own CSS wins untouched.
 */
import { PANEL_STYLE_ATTRIBUTE, PANEL_STYLE_ID, buildPanelCss } from '../shared/panel-css'
import type { SettingsPanelPrefs } from '../shared/prefs'

/** Imperative panel stylesheet controller. */
export interface StyleController {
  /** Apply one preference set (empty CSS removes the element). */
  apply(panel: SettingsPanelPrefs): void
  /** Remove this controller's style element(s). */
  dispose(): void
}

/**
 * Create the panel stylesheet controller.
 * @param target - document to own (injectable for tests).
 * @returns the controller.
 */
export function createStyleController(target: Document = document): StyleController {
  let node: HTMLStyleElement | null = null

  const remove = (): void => {
    node?.remove()
    node = null
  }

  return {
    apply(panel) {
      const css = buildPanelCss(panel)
      if (css === '') {
        remove()
        return
      }
      if (node === null || !node.isConnected) {
        node = target.createElement('style')
        node.id = PANEL_STYLE_ID
        node.setAttribute(PANEL_STYLE_ATTRIBUTE, '')
        target.head.appendChild(node)
      }
      if (node.textContent !== css) node.textContent = css
    },
    dispose() {
      remove()
      target.querySelectorAll(`style[${PANEL_STYLE_ATTRIBUTE}]`).forEach((element) => {
        element.remove()
      })
    },
  }
}
