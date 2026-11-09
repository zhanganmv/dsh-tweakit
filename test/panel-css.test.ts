import { describe, expect, it } from 'vitest'
import {
  PANEL_SELECTOR,
  PANEL_STYLE_ATTRIBUTE,
  PANEL_STYLE_ID,
  buildPanelCss,
} from '../src/shared/panel-css'
import { DEFAULT_SETTINGS_PANEL } from '../src/shared/prefs'

describe('buildPanelCss', () => {
  it('emits nothing in default mode', () => {
    expect(buildPanelCss({ ...DEFAULT_SETTINGS_PANEL, mode: 'default' })).toBe('')
  })

  it('targets the stable panel marker, not a hashed class', () => {
    const css = buildPanelCss(DEFAULT_SETTINGS_PANEL)
    expect(css).toContain(PANEL_SELECTOR)
    expect(css).toContain('@media (width >= 768px)')
    expect(css).not.toMatch(/SettingsRoot/)
  })

  it('caps a custom size at the viewport minus the margins', () => {
    const css = buildPanelCss(DEFAULT_SETTINGS_PANEL)
    expect(css).toContain('min(1360px, calc(100vw - 2 * var(--dsh-tweakit-gap-x)))')
    expect(css).toContain('min(1000px, calc(100vh - 2 * var(--dsh-tweakit-gap-y)))')
    expect(css).toContain('max-width: none !important;')
    expect(css).toContain('max-height: none !important;')
  })

  it('uses full-viewport calc sizing in full mode', () => {
    const css = buildPanelCss({ ...DEFAULT_SETTINGS_PANEL, mode: 'full' })
    expect(css).toContain('width: calc(100vw - 2 * var(--dsh-tweakit-gap-x)) !important;')
    expect(css).toContain('height: calc(100vh - 2 * var(--dsh-tweakit-gap-y)) !important;')
    expect(css).not.toContain('min(')
  })

  it('keeps the frame overlay top inset in the vertical gap', () => {
    const css = buildPanelCss({ ...DEFAULT_SETTINGS_PANEL, margin: 0 })
    expect(css).toContain('--dsh-tweakit-gap-x: 0px;')
    expect(css).toContain('--dsh-tweakit-gap-y: max(0px, var(--dsh-frame-overlay-top, 0px));')
  })

  it('exposes stable style metadata', () => {
    expect(PANEL_STYLE_ATTRIBUTE).toBe('data-dsh-tweakit-panel')
    expect(PANEL_STYLE_ID).toBe('dsh-tweakit-panel-style')
  })
})
