/**
 * Host half of dsh-tweakit — the durable side.
 *
 * The plugin `Config` is the single persistence schema: every tweak
 * preference is one flat `.volatile()` field, so the DSH settings service can
 * commit edits into the profile's user layer without remounting the plugin.
 * The client half reads and writes that namespace through the official
 * `ctx.configForms` service (verified in a dev profile), so this half no
 * longer needs a custom HTTP route.
 *
 * `settings.configure({ auto: false })` keeps the Plugins page from generating
 * a second, generic form beside this plugin's own Settings tab.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_SETTINGS_PANEL, PANEL_LIMITS, PANEL_MODES } from '../shared/prefs'

/** Cordis diagnostic name. */
export const name = 'dsh-tweakit'

/**
 * Plugin configuration: every tweak preference as a live field.
 *
 * Flat names are deliberate — the settings service addresses fields by path,
 * and the profile YAML stays readable. Add one field per new tweak preference.
 */
export const Config = z.object({
  settingsPanelMode: z
    .union(PANEL_MODES.map((mode) => z.const(mode)))
    .default(DEFAULT_SETTINGS_PANEL.mode)
    .volatile(),
  settingsPanelWidth: z
    .number()
    .step(1)
    .min(PANEL_LIMITS.width.min)
    .max(PANEL_LIMITS.width.max)
    .default(DEFAULT_SETTINGS_PANEL.width)
    .volatile(),
  settingsPanelHeight: z
    .number()
    .step(1)
    .min(PANEL_LIMITS.height.min)
    .max(PANEL_LIMITS.height.max)
    .default(DEFAULT_SETTINGS_PANEL.height)
    .volatile(),
  settingsPanelMargin: z
    .number()
    .step(1)
    .min(PANEL_LIMITS.margin.min)
    .max(PANEL_LIMITS.margin.max)
    .default(DEFAULT_SETTINGS_PANEL.margin)
    .volatile(),
})

/** Structural view of the settings service this plugin consumes. */
interface SettingsFace {
  configure(presentation: { auto?: boolean }, owner?: unknown): () => void
}

/**
 * Cordis plugin body.
 * @param ctx - host context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => {
    const settings = child.get('settings') as unknown as SettingsFace
    child.effect(
      () => settings.configure({ auto: false }, ctx.fiber),
      'dsh-tweakit: settings presentation',
    )
  })
}
