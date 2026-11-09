import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS_PANEL,
  PANEL_LIMITS,
  TWEAK_DESCRIPTORS,
  TWEAK_GROUPS,
  TWEAK_GROUP_IDS,
  TWEAK_IDS,
  TWEAK_UI,
  createDefaultPrefs,
  fromWire,
  groupOfTweak,
  groupsWithTweaks,
  normalizePrefs,
  normalizeSettingsPanel,
  resolvePanelSize,
  resolveSelection,
  type TweakSelection,
  toWire,
  tweaksInGroup,
} from '../src/shared/prefs'

describe('normalizeSettingsPanel', () => {
  it('falls back to the defaults for missing or malformed input', () => {
    expect(normalizeSettingsPanel(undefined)).toEqual(DEFAULT_SETTINGS_PANEL)
    expect(normalizeSettingsPanel('nope')).toEqual(DEFAULT_SETTINGS_PANEL)
    expect(normalizeSettingsPanel([])).toEqual(DEFAULT_SETTINGS_PANEL)
  })

  it('clamps and rounds numeric preferences into their ranges', () => {
    expect(
      normalizeSettingsPanel({ mode: 'custom', width: 99_999, height: 10, margin: -5 }),
    ).toEqual({
      mode: 'custom',
      width: PANEL_LIMITS.width.max,
      height: PANEL_LIMITS.height.min,
      margin: PANEL_LIMITS.margin.min,
    })
    expect(normalizeSettingsPanel({ width: 1200.6, height: 900.4, margin: 24.5 })).toMatchObject({
      width: 1201,
      height: 900,
      margin: 25,
    })
  })

  it('rejects unknown modes', () => {
    expect(normalizeSettingsPanel({ mode: 'maximized' }).mode).toBe(DEFAULT_SETTINGS_PANEL.mode)
  })

  it('keeps the margin inside its range', () => {
    expect(normalizeSettingsPanel({ margin: 4_000 }).margin).toBe(PANEL_LIMITS.margin.max)
  })
})

describe('resolvePanelSize', () => {
  it('leaves sizing alone in default mode', () => {
    expect(
      resolvePanelSize(
        { ...DEFAULT_SETTINGS_PANEL, mode: 'default' },
        { width: 1440, height: 900 },
      ),
    ).toBeNull()
  })

  it('fills the viewport minus the margin in full mode', () => {
    expect(
      resolvePanelSize(
        { ...DEFAULT_SETTINGS_PANEL, mode: 'full', margin: 24 },
        { width: 1024, height: 768 },
      ),
    ).toEqual({ width: 976, height: 720 })
  })

  it('clears the frame overlay top in full mode even with margin 0', () => {
    expect(
      resolvePanelSize(
        { ...DEFAULT_SETTINGS_PANEL, mode: 'full', margin: 0 },
        { width: 1440, height: 900 },
        68,
      ),
    ).toEqual({ width: 1440, height: 764 })
  })

  it('keeps a custom size that fits', () => {
    expect(
      resolvePanelSize(
        { ...DEFAULT_SETTINGS_PANEL, mode: 'custom', width: 1200, height: 800, margin: 24 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ width: 1200, height: 800 })
  })

  it('shrinks a custom size that exceeds the viewport, keeping the margin', () => {
    expect(
      resolvePanelSize(
        { ...DEFAULT_SETTINGS_PANEL, mode: 'custom', width: 1600, height: 1200, margin: 24 },
        { width: 1366, height: 768 },
      ),
    ).toEqual({ width: 1318, height: 720 })
  })
})

describe('preference document', () => {
  it('creates a fresh default document', () => {
    const first = createDefaultPrefs()
    const second = createDefaultPrefs()
    expect(first).toEqual(second)
    expect(first.tweaks['settings-panel']).toEqual(DEFAULT_SETTINGS_PANEL)
    expect(first).not.toBe(second)
    expect(first.tweaks['settings-panel']).not.toBe(second.tweaks['settings-panel'])
  })

  it('normalizes an arbitrary document', () => {
    const prefs = normalizePrefs({
      version: 999,
      tweaks: { 'settings-panel': { mode: 'full', width: 1500, height: 900, margin: 0 } },
      unknown: true,
    })
    expect(prefs).toEqual({
      version: 1,
      tweaks: { 'settings-panel': { mode: 'full', width: 1500, height: 900, margin: 0 } },
    })
  })

  it('round-trips through the flat host wire fields', () => {
    const prefs = normalizePrefs({
      tweaks: { 'settings-panel': { mode: 'full', width: 1500, height: 900, margin: 0 } },
    })
    expect(fromWire(toWire(prefs))).toEqual(prefs)
  })

  it('ignores unknown and malformed wire fields', () => {
    const prefs = fromWire({
      settingsPanelMode: 'custom',
      settingsPanelWidth: 'wide',
      settingsPanelHeight: 900,
      settingsPanelMargin: 12,
      unrelated: 1,
    })
    expect(prefs.tweaks['settings-panel']).toEqual({
      mode: 'custom',
      width: DEFAULT_SETTINGS_PANEL.width,
      height: 900,
      margin: 12,
    })
  })
})

describe('declarative tweak metadata', () => {
  it('covers every preference exactly once and keeps the wire mapping one-to-one', () => {
    const fields = TWEAK_UI['settings-panel'].fields.map((field) => field.field).sort()
    const prefsKeys = Object.keys(DEFAULT_SETTINGS_PANEL).sort()
    const wireKeys = Object.keys(TWEAK_DESCRIPTORS['settings-panel'].toWire(DEFAULT_SETTINGS_PANEL))
    expect(fields).toEqual(prefsKeys)
    expect(wireKeys).toHaveLength(fields.length)
  })

  it('encodes conditional visibility and disabled state', () => {
    const byKey = new Map(TWEAK_UI['settings-panel'].fields.map((field) => [field.key, field]))
    expect(byKey.get('width')?.visibleWhen?.({ ...DEFAULT_SETTINGS_PANEL, mode: 'full' })).toBe(
      false,
    )
    expect(byKey.get('width')?.visibleWhen?.({ ...DEFAULT_SETTINGS_PANEL, mode: 'custom' })).toBe(
      true,
    )
    expect(
      byKey.get('margin')?.disabledWhen?.({ ...DEFAULT_SETTINGS_PANEL, mode: 'default' }),
    ).toBe(true)
    expect(byKey.get('margin')?.disabledWhen?.({ ...DEFAULT_SETTINGS_PANEL, mode: 'custom' })).toBe(
      false,
    )
  })

  it('carries bilingual copy for every field', () => {
    for (const field of TWEAK_UI['settings-panel'].fields) {
      expect(field.label.zh).not.toBe('')
      expect(field.label.en).not.toBe('')
    }
  })
})

describe('group navigation model', () => {
  it('declares every group exactly once and puts every tweak under a declared one', () => {
    expect(TWEAK_GROUPS.map((group) => group.id)).toEqual([...TWEAK_GROUP_IDS])
    expect(new Set(TWEAK_GROUP_IDS).size).toBe(TWEAK_GROUP_IDS.length)
    for (const id of TWEAK_IDS) {
      expect(TWEAK_GROUP_IDS).toContain(TWEAK_UI[id].group)
    }
  })

  it('visits every tweak exactly once and only renders non-empty groups in order', () => {
    const groups = groupsWithTweaks()
    const visited = groups.flatMap((group) => tweaksInGroup(group.id))
    expect(visited.sort()).toEqual([...TWEAK_IDS].sort())
    const orders = groups.map((group) => group.order)
    expect(orders).toEqual([...orders].sort((left, right) => left - right))
    for (const group of groups) {
      expect(tweaksInGroup(group.id)).not.toHaveLength(0)
    }
  })

  it('orders tweaks inside a group by their declared order', () => {
    const ordered = tweaksInGroup('dsh')
    const orders = ordered.map((id) => TWEAK_UI[id].order)
    expect(orders).toEqual([...orders].sort((left, right) => left - right))
    expect(groupOfTweak('settings-panel')).toBe('dsh')
  })

  it('selects the first tweak of the first group on first render', () => {
    expect(resolveSelection(null)).toEqual({ group: 'dsh', tweak: 'settings-panel' })
  })

  it('keeps a selection that still points at a registered tweak', () => {
    const selection = { group: 'dsh' as const, tweak: 'settings-panel' as const }
    expect(resolveSelection(selection)).toEqual(selection)
  })

  it('falls back to the first group when the remembered group is gone', () => {
    const retired = { group: 'retired-plugin', tweak: 'nope' } as unknown as TweakSelection
    expect(resolveSelection(retired)).toEqual({ group: 'dsh', tweak: 'settings-panel' })
  })
})
