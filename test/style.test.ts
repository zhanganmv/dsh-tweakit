// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createStyleController } from '../src/client/style'
import { PANEL_STYLE_ATTRIBUTE, PANEL_STYLE_ID } from '../src/shared/panel-css'
import { DEFAULT_SETTINGS_PANEL } from '../src/shared/prefs'

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('panel style controller', () => {
  it('creates one style element, updates it in place, and disposes it', () => {
    const controller = createStyleController(document)

    controller.apply(DEFAULT_SETTINGS_PANEL)
    const first = document.querySelector(`style[${PANEL_STYLE_ATTRIBUTE}]`)
    expect(first).not.toBeNull()
    expect(first?.id).toBe(PANEL_STYLE_ID)
    expect(first?.textContent).toContain('min(1360px')

    controller.apply({ ...DEFAULT_SETTINGS_PANEL, width: 1500 })
    expect(document.querySelectorAll(`style[${PANEL_STYLE_ATTRIBUTE}]`)).toHaveLength(1)
    expect(document.querySelector(`style[${PANEL_STYLE_ATTRIBUTE}]`)).toBe(first)
    expect(first?.textContent).toContain('min(1500px')

    controller.dispose()
    expect(document.querySelector(`style[${PANEL_STYLE_ATTRIBUTE}]`)).toBeNull()
  })

  it('removes the element in default mode and re-creates it on demand', () => {
    const controller = createStyleController(document)

    controller.apply(DEFAULT_SETTINGS_PANEL)
    expect(document.querySelector(`style[${PANEL_STYLE_ATTRIBUTE}]`)).not.toBeNull()

    controller.apply({ ...DEFAULT_SETTINGS_PANEL, mode: 'default' })
    expect(document.querySelector(`style[${PANEL_STYLE_ATTRIBUTE}]`)).toBeNull()

    controller.apply({ ...DEFAULT_SETTINGS_PANEL, mode: 'full' })
    expect(document.querySelector(`style[${PANEL_STYLE_ATTRIBUTE}]`)?.textContent).toContain(
      '(full)',
    )
  })
})
