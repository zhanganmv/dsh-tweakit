/**
 * CSS generation for the settings-panel tweak.
 *
 * The settings shell renders its panel with hashed class names
 * (`SettingsRoot.module.css`), which are not a stable contract. The stable
 * marker is the panel's `role="dialog"` plus `data-shortcut-modal="settings"`
 * pair, and the shell's own sizing lives on that element, so the override uses
 * the marker and `!important` rather than a class name.
 *
 * The mobile layout (`@media (width <= 767px)`) is intentionally left to the
 * shell: there the panel fills the viewport and turns its rail into a strip.
 */
import type { SettingsPanelPrefs } from './prefs'

/** Attribute marking the single style element this plugin injects. */
export const PANEL_STYLE_ATTRIBUTE = 'data-dsh-tweakit-panel'

/** `id` of the single style element this plugin injects. */
export const PANEL_STYLE_ID = 'dsh-tweakit-panel-style'

/** The selector of the settings panel in the shipped shell. */
export const PANEL_SELECTOR = '[role="dialog"][data-shortcut-modal="settings"]'

/**
 * Build the stylesheet for one settings-panel preference set.
 *
 * `margin` becomes `--dsh-tweakit-gap-x`; the vertical gap takes the larger of
 * the user margin and the frame's overlay top inset, so the panel never sits
 * under the macOS traffic lights even with `margin: 0`.
 *
 * @param panel - effective settings-panel preferences.
 * @returns the stylesheet text, or an empty string in `default` mode.
 */
export function buildPanelCss(panel: SettingsPanelPrefs): string {
  if (panel.mode === 'default') return ''

  const gapX = `${panel.margin}px`
  const gapY = `max(${panel.margin}px, var(--dsh-frame-overlay-top, 0px))`

  const sizing =
    panel.mode === 'full'
      ? [
          '    width: calc(100vw - 2 * var(--dsh-tweakit-gap-x)) !important;',
          '    height: calc(100vh - 2 * var(--dsh-tweakit-gap-y)) !important;',
        ].join('\n')
      : [
          `    width: min(${panel.width}px, calc(100vw - 2 * var(--dsh-tweakit-gap-x))) !important;`,
          `    height: min(${panel.height}px, calc(100vh - 2 * var(--dsh-tweakit-gap-y))) !important;`,
        ].join('\n')

  return [
    `/* dsh-tweakit: settings panel size (${panel.mode}) */`,
    ':root {',
    `  --dsh-tweakit-gap-x: ${gapX};`,
    `  --dsh-tweakit-gap-y: ${gapY};`,
    '}',
    '',
    '@media (width >= 768px) {',
    `  ${PANEL_SELECTOR} {`,
    sizing,
    '    max-width: none !important;',
    '    max-height: none !important;',
    '  }',
    '}',
    '',
  ].join('\n')
}
