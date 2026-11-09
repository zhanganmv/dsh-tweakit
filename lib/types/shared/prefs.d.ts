/**
 * Shared preference model for every tweak this plugin owns.
 *
 * The module is deliberately free of DOM and Node APIs: the host half, the
 * client half, and the tests all import it. It is also the single source of
 * truth for defaults, limits, normalization, and the wire mapping between the
 * nested in-memory document and the flat volatile fields the DSH settings
 * service validates.
 *
 * Adding a tweak:
 *  1. add its id + preferences interface to {@link TweakPrefsMap};
 *  2. write a {@link TweakDescriptor} (defaults / normalize / wire mapping);
 *  3. register it in {@link TWEAK_IDS} and {@link TWEAK_DESCRIPTORS};
 *  4. the generic `normalizePrefs` / `toWire` / `fromWire` paths pick it up with
 *     no further changes (see `docs/architecture/plugin-architecture.md`).
 */
/** How the settings panel gets its size. */
export type PanelMode = 'default' | 'full' | 'custom';
/** First tweak: the settings window size. */
export interface SettingsPanelPrefs {
    /**
     * `default` — the plugin does not touch the panel; the shell keeps its own
     * 800×800 sizing. `full` — fill the viewport minus the configured margin.
     * `custom` — the configured width/height, clamped to the viewport minus the
     * margin so all four edges keep breathing room.
     */
    readonly mode: PanelMode;
    /** Requested panel width in CSS pixels (`custom` mode only). */
    readonly width: number;
    /** Requested panel height in CSS pixels (`custom` mode only). */
    readonly height: number;
    /** Breathing room kept between the panel and the viewport edge, in CSS px. */
    readonly margin: number;
}
/** Preferences owned by each tweak, keyed by stable tweak id. */
export interface TweakPrefsMap {
    'settings-panel': SettingsPanelPrefs;
}
/** Stable tweak identifiers. */
export type TweakId = keyof TweakPrefsMap;
/** The complete persisted document. */
export interface TweakitPrefs {
    readonly version: typeof PREFS_VERSION;
    readonly tweaks: TweakPrefsMap;
}
/** Schema version of the persisted document. */
export declare const PREFS_VERSION = 1;
/** Loader entry id, also the DSH settings namespace for this plugin. */
export declare const ENTRY_ID = "dsh-tweakit";
/** Accepted values for each numeric preference, in CSS pixels. */
export declare const PANEL_LIMITS: {
    readonly width: {
        readonly min: 640;
        readonly max: 1920;
    };
    readonly height: {
        readonly min: 480;
        readonly max: 1440;
    };
    readonly margin: {
        readonly min: 0;
        readonly max: 64;
    };
};
/** Accepted panel modes, in the order the settings page presents them. */
export declare const PANEL_MODES: readonly PanelMode[];
/**
 * First-run preferences.
 *
 * `custom` 1360×1000 with a 24px margin reproduces the local plugin this
 * package replaces (旧的本地尺寸插件), so replacing it is visually
 * neutral. Users who want the untouched shell pick `default`.
 */
export declare const DEFAULT_SETTINGS_PANEL: SettingsPanelPrefs;
/** The panel as resolved against one viewport. */
export interface ResolvedPanelSize {
    readonly width: number;
    readonly height: number;
}
/** Viewport dimensions in CSS pixels. */
export interface Viewport {
    readonly width: number;
    readonly height: number;
}
/**
 * One tweak's contract with the shared document: defaults, validation, and
 * the mapping to/from the flat fields of the host Config schema.
 *
 * @typeParam P - the tweak's preference shape.
 */
export interface TweakDescriptor<P> {
    /** Stable tweak id (matches the key in `TweakPrefsMap`). */
    readonly id: string;
    /** A fresh copy of the first-run preferences. */
    defaults(): P;
    /** Validate and complete an arbitrary persisted value. */
    normalize(input: unknown): P;
    /** Flatten preferences into host Config field names. */
    toWire(prefs: P): Record<string, unknown>;
    /** Rebuild preferences from the host Config field names. */
    fromWire(wire: Record<string, unknown>): P;
}
/** Two-language UI text carried by a declarative tweak field. */
export interface LocalizedText {
    readonly zh: string;
    readonly en: string;
}
/** Shared shape of one declarative tweak field. */
interface TweakFieldBase<P> {
    /** Stable key used for DOM ids and test selectors. */
    readonly key: string;
    /** Preference field this control edits. */
    readonly field: keyof P & string;
    readonly label: LocalizedText;
    readonly hint?: LocalizedText;
    /** Render the control only while this predicate holds. */
    readonly visibleWhen?: (prefs: P) => boolean;
    /** Render the control disabled while this predicate holds. */
    readonly disabledWhen?: (prefs: P) => boolean;
}
/** Numeric control: `slider` pairs a range input with a numeric input. */
export interface TweakNumberField<P> extends TweakFieldBase<P> {
    readonly kind: 'number' | 'slider';
    readonly min: number;
    readonly max: number;
    readonly step: number;
    /** Unit rendered beside the numeric input (for example `px`). */
    readonly unit?: string;
}
/** Segmented (radio-group) control for a small closed set. */
export interface TweakSegmentedField<P> extends TweakFieldBase<P> {
    readonly kind: 'segmented';
    readonly options: readonly {
        readonly value: string;
        readonly label: LocalizedText;
    }[];
}
/** Boolean switch control. */
export interface TweakSwitchField<P> extends TweakFieldBase<P> {
    readonly kind: 'switch';
}
/** Free-text control. */
export interface TweakTextField<P> extends TweakFieldBase<P> {
    readonly kind: 'text';
    readonly placeholder?: LocalizedText;
}
/** One declarative control of a tweak group. */
export type TweakField<P> = TweakNumberField<P> | TweakSegmentedField<P> | TweakSwitchField<P> | TweakTextField<P>;
/** Presentation metadata for one tweak group, rendered by the generic form. */
export interface TweakUi<P> {
    /** Group order inside the page (ascending). */
    readonly order: number;
    readonly title: LocalizedText;
    readonly description: LocalizedText;
    readonly fields: readonly TweakField<P>[];
}
/** Clamp a number into an inclusive range. */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Validate and complete the settings-panel preferences.
 * @param input - arbitrary persisted value.
 * @returns a complete, in-range preference object.
 */
export declare function normalizeSettingsPanel(input: unknown): SettingsPanelPrefs;
/**
 * Resolve the panel size to render for one viewport.
 *
 * The vertical margin also clears the frame's overlay top inset
 * (`--dsh-frame-overlay-top`, the macOS traffic-light strip), so a `margin: 0`
 * panel stays below the window chrome. The CSS in `panel-css.ts` applies the
 * same formula; this function backs the readout and the tests.
 *
 * @param panel - effective settings-panel preferences.
 * @param viewport - current viewport size in CSS pixels.
 * @param overlayTop - top inset the shell reserves, in CSS pixels.
 * @returns the effective size, or `null` when the plugin leaves sizing alone.
 */
export declare function resolvePanelSize(panel: SettingsPanelPrefs, viewport: Viewport, overlayTop?: number): ResolvedPanelSize | null;
/** Every registered tweak id. */
export declare const TWEAK_IDS: readonly TweakId[];
/** Every registered tweak descriptor, keyed by id. */
export declare const TWEAK_DESCRIPTORS: {
    readonly [K in TweakId]: TweakDescriptor<TweakPrefsMap[K]>;
};
/** Presentation metadata for every registered tweak. */
export declare const TWEAK_UI: {
    readonly [K in TweakId]: TweakUi<TweakPrefsMap[K]>;
};
/**
 * Build a fresh copy of the first-run document.
 * @returns defaults for every registered tweak.
 */
export declare function createDefaultPrefs(): TweakitPrefs;
/**
 * Validate an arbitrary persisted document.
 * @param input - raw value from the host or a storage layer.
 * @returns a complete document; unknown tweaks and fields are dropped.
 */
export declare function normalizePrefs(input: unknown): TweakitPrefs;
/**
 * Flatten a document into the host Config wire fields.
 * @param prefs - complete preferences.
 * @returns flat fields named by the host schema.
 */
export declare function toWire(prefs: TweakitPrefs): Record<string, unknown>;
/**
 * Rebuild a document from the host Config wire fields.
 * @param wire - flat fields read from the host schema.
 * @returns a complete, normalized document.
 */
export declare function fromWire(wire: unknown): TweakitPrefs;
export {};
