import type { SettingsPanelPrefs } from '../shared/prefs';
/** Imperative panel stylesheet controller. */
export interface StyleController {
    /** Apply one preference set (empty CSS removes the element). */
    apply(panel: SettingsPanelPrefs): void;
    /** Remove this controller's style element(s). */
    dispose(): void;
}
/**
 * Create the panel stylesheet controller.
 * @param target - document to own (injectable for tests).
 * @returns the controller.
 */
export declare function createStyleController(target?: Document): StyleController;
