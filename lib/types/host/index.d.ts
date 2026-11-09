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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis diagnostic name. */
export declare const name = "dsh-tweakit";
/**
 * Plugin configuration: every tweak preference as a live field.
 *
 * Flat names are deliberate — the settings service addresses fields by path,
 * and the profile YAML stays readable. Add one field per new tweak preference.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    settingsPanelMode: z<import("../shared/prefs").PanelMode, import("../shared/prefs").PanelMode, "volatile-defined">;
    settingsPanelWidth: z<number, number, "volatile-defined">;
    settingsPanelHeight: z<number, number, "volatile-defined">;
    settingsPanelMargin: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    settingsPanelMode: z<import("../shared/prefs").PanelMode, import("../shared/prefs").PanelMode, "volatile-defined">;
    settingsPanelWidth: z<number, number, "volatile-defined">;
    settingsPanelHeight: z<number, number, "volatile-defined">;
    settingsPanelMargin: z<number, number, "volatile-defined">;
}>>, "plain">;
/**
 * Cordis plugin body.
 * @param ctx - host context.
 */
export declare function apply(ctx: Context): void;
