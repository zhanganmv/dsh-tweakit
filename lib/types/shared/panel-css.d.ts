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
import type { SettingsPanelPrefs } from './prefs';
/** Attribute marking the single style element this plugin injects. */
export declare const PANEL_STYLE_ATTRIBUTE = "data-dsh-tweakit-panel";
/** `id` of the single style element this plugin injects. */
export declare const PANEL_STYLE_ID = "dsh-tweakit-panel-style";
/** The selector of the settings panel in the shipped shell. */
export declare const PANEL_SELECTOR = "[role=\"dialog\"][data-shortcut-modal=\"settings\"]";
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
export declare function buildPanelCss(panel: SettingsPanelPrefs): string;
