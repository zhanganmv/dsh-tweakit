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
export type PanelMode = 'default' | 'full' | 'custom'

/** First tweak: the settings window size. */
export interface SettingsPanelPrefs {
  /**
   * `default` — the plugin does not touch the panel; the shell keeps its own
   * 800×800 sizing. `full` — fill the viewport minus the configured margin.
   * `custom` — the configured width/height, clamped to the viewport minus the
   * margin so all four edges keep breathing room.
   */
  readonly mode: PanelMode
  /** Requested panel width in CSS pixels (`custom` mode only). */
  readonly width: number
  /** Requested panel height in CSS pixels (`custom` mode only). */
  readonly height: number
  /** Breathing room kept between the panel and the viewport edge, in CSS px. */
  readonly margin: number
}

/** Preferences owned by each tweak, keyed by stable tweak id. */
export interface TweakPrefsMap {
  'settings-panel': SettingsPanelPrefs
}

/** Stable tweak identifiers. */
export type TweakId = keyof TweakPrefsMap

/** The complete persisted document. */
export interface TweakitPrefs {
  readonly version: typeof PREFS_VERSION
  readonly tweaks: TweakPrefsMap
}

/** Schema version of the persisted document. */
export const PREFS_VERSION = 1

/** Loader entry id, also the DSH settings namespace for this plugin. */
export const ENTRY_ID = 'dsh-tweakit'

/** Accepted values for each numeric preference, in CSS pixels. */
export const PANEL_LIMITS = {
  width: { min: 640, max: 1920 },
  height: { min: 480, max: 1440 },
  margin: { min: 0, max: 64 },
} as const

/** Accepted panel modes, in the order the settings page presents them. */
export const PANEL_MODES: readonly PanelMode[] = ['default', 'full', 'custom']

/**
 * First-run preferences.
 *
 * `custom` 1360×1000 with a 24px margin reproduces the sizing this package
 * replaces, so switching is visually neutral. Users who want the untouched
 * shell pick `default`.
 */
export const DEFAULT_SETTINGS_PANEL: SettingsPanelPrefs = {
  mode: 'custom',
  width: 1360,
  height: 1000,
  margin: 24,
}

/** The panel as resolved against one viewport. */
export interface ResolvedPanelSize {
  readonly width: number
  readonly height: number
}

/** Viewport dimensions in CSS pixels. */
export interface Viewport {
  readonly width: number
  readonly height: number
}

/**
 * One tweak's contract with the shared document: defaults, validation, and
 * the mapping to/from the flat fields of the host Config schema.
 *
 * @typeParam P - the tweak's preference shape.
 */
export interface TweakDescriptor<P> {
  /** Stable tweak id (matches the key in `TweakPrefsMap`). */
  readonly id: string
  /** A fresh copy of the first-run preferences. */
  defaults(): P
  /** Validate and complete an arbitrary persisted value. */
  normalize(input: unknown): P
  /** Flatten preferences into host Config field names. */
  toWire(prefs: P): Record<string, unknown>
  /** Rebuild preferences from the host Config field names. */
  fromWire(wire: Record<string, unknown>): P
}

/** Two-language UI text carried by a declarative tweak field. */
export interface LocalizedText {
  readonly zh: string
  readonly en: string
}

/** Shared shape of one declarative tweak field. */
interface TweakFieldBase<P> {
  /** Stable key used for DOM ids and test selectors. */
  readonly key: string
  /** Preference field this control edits. */
  readonly field: keyof P & string
  readonly label: LocalizedText
  readonly hint?: LocalizedText
  /** Render the control only while this predicate holds. */
  readonly visibleWhen?: (prefs: P) => boolean
  /** Render the control disabled while this predicate holds. */
  readonly disabledWhen?: (prefs: P) => boolean
}

/** Numeric control: `slider` pairs a range input with a numeric input. */
export interface TweakNumberField<P> extends TweakFieldBase<P> {
  readonly kind: 'number' | 'slider'
  readonly min: number
  readonly max: number
  readonly step: number
  /** Unit rendered beside the numeric input (for example `px`). */
  readonly unit?: string
}

/** Segmented (radio-group) control for a small closed set. */
export interface TweakSegmentedField<P> extends TweakFieldBase<P> {
  readonly kind: 'segmented'
  readonly options: readonly {
    readonly value: string
    readonly label: LocalizedText
  }[]
}

/** Boolean switch control. */
export interface TweakSwitchField<P> extends TweakFieldBase<P> {
  readonly kind: 'switch'
}

/** Free-text control. */
export interface TweakTextField<P> extends TweakFieldBase<P> {
  readonly kind: 'text'
  readonly placeholder?: LocalizedText
}

/** One declarative control of a tweak group. */
export type TweakField<P> =
  TweakNumberField<P> | TweakSegmentedField<P> | TweakSwitchField<P> | TweakTextField<P>

/** Presentation metadata for one tweak group, rendered by the generic form. */
export interface TweakUi<P> {
  /** Group order inside the page (ascending). */
  readonly order: number
  readonly title: LocalizedText
  readonly description: LocalizedText
  readonly fields: readonly TweakField<P>[]
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read a finite number, or fall back. */
function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Coerce an unknown value into a supported mode. */
function normalizeMode(value: unknown): PanelMode {
  return PANEL_MODES.includes(value as PanelMode)
    ? (value as PanelMode)
    : DEFAULT_SETTINGS_PANEL.mode
}

/** Round, clamp, and fall back for one numeric preference. */
function normalizeNumber(
  value: unknown,
  fallback: number,
  limits: { readonly min: number; readonly max: number },
): number {
  return clamp(Math.round(finiteNumber(value, fallback)), limits.min, limits.max)
}

/**
 * Validate and complete the settings-panel preferences.
 * @param input - arbitrary persisted value.
 * @returns a complete, in-range preference object.
 */
export function normalizeSettingsPanel(input: unknown): SettingsPanelPrefs {
  const record = isRecord(input) ? input : {}
  return {
    mode: normalizeMode(record['mode']),
    width: normalizeNumber(record['width'], DEFAULT_SETTINGS_PANEL.width, PANEL_LIMITS.width),
    height: normalizeNumber(record['height'], DEFAULT_SETTINGS_PANEL.height, PANEL_LIMITS.height),
    margin: normalizeNumber(record['margin'], DEFAULT_SETTINGS_PANEL.margin, PANEL_LIMITS.margin),
  }
}

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
export function resolvePanelSize(
  panel: SettingsPanelPrefs,
  viewport: Viewport,
  overlayTop = 0,
): ResolvedPanelSize | null {
  if (panel.mode === 'default') return null
  const gapX = panel.margin
  const gapY = Math.max(panel.margin, overlayTop)
  const availableWidth = Math.max(0, viewport.width - gapX * 2)
  const availableHeight = Math.max(0, viewport.height - gapY * 2)
  if (panel.mode === 'full') return { width: availableWidth, height: availableHeight }
  return {
    width: Math.min(panel.width, availableWidth),
    height: Math.min(panel.height, availableHeight),
  }
}

/** The settings-panel tweak descriptor. */
const settingsPanelTweak: TweakDescriptor<SettingsPanelPrefs> = {
  id: 'settings-panel',
  defaults: () => ({ ...DEFAULT_SETTINGS_PANEL }),
  normalize: normalizeSettingsPanel,
  toWire: (panel) => ({
    settingsPanelMode: panel.mode,
    settingsPanelWidth: panel.width,
    settingsPanelHeight: panel.height,
    settingsPanelMargin: panel.margin,
  }),
  fromWire: (wire) =>
    normalizeSettingsPanel({
      mode: wire['settingsPanelMode'],
      width: wire['settingsPanelWidth'],
      height: wire['settingsPanelHeight'],
      margin: wire['settingsPanelMargin'],
    }),
}

/** Every registered tweak id. */
export const TWEAK_IDS: readonly TweakId[] = ['settings-panel']

/** Every registered tweak descriptor, keyed by id. */
export const TWEAK_DESCRIPTORS: {
  readonly [K in TweakId]: TweakDescriptor<TweakPrefsMap[K]>
} = {
  'settings-panel': settingsPanelTweak,
}

/** Presentation metadata for every registered tweak. */
export const TWEAK_UI: {
  readonly [K in TweakId]: TweakUi<TweakPrefsMap[K]>
} = {
  'settings-panel': {
    order: 10,
    title: { zh: '设置窗口', en: 'Settings window' },
    description: {
      zh: '控制设置面板的大小。窗口变小时会自动收缩，四周边距保持不变。',
      en: 'Control the size of the settings panel. It shrinks with the viewport and keeps its margins.',
    },
    fields: [
      {
        kind: 'segmented',
        key: 'mode',
        field: 'mode',
        label: { zh: '模式', en: 'Mode' },
        options: [
          { value: 'default', label: { zh: '默认', en: 'Default' } },
          { value: 'full', label: { zh: '全屏', en: 'Full' } },
          { value: 'custom', label: { zh: '自定义', en: 'Custom' } },
        ],
      },
      {
        kind: 'slider',
        key: 'width',
        field: 'width',
        label: { zh: '宽度', en: 'Width' },
        min: PANEL_LIMITS.width.min,
        max: PANEL_LIMITS.width.max,
        step: 10,
        unit: 'px',
        visibleWhen: (prefs) => prefs.mode === 'custom',
      },
      {
        kind: 'slider',
        key: 'height',
        field: 'height',
        label: { zh: '高度', en: 'Height' },
        min: PANEL_LIMITS.height.min,
        max: PANEL_LIMITS.height.max,
        step: 10,
        unit: 'px',
        visibleWhen: (prefs) => prefs.mode === 'custom',
      },
      {
        kind: 'number',
        key: 'margin',
        field: 'margin',
        label: { zh: '边距', en: 'Margin' },
        hint: {
          zh: '面板与窗口边缘之间保留的距离。',
          en: 'Distance kept between the panel and the window edges.',
        },
        min: PANEL_LIMITS.margin.min,
        max: PANEL_LIMITS.margin.max,
        step: 1,
        unit: 'px',
        disabledWhen: (prefs) => prefs.mode === 'default',
      },
    ],
  },
}

/** Type-erased descriptor view used by the generic registry helpers. */
type AnyTweakDescriptor = TweakDescriptor<unknown>

/** Type-erased descriptor for one id. */
function descriptorOf(id: TweakId): AnyTweakDescriptor {
  return TWEAK_DESCRIPTORS[id] as unknown as AnyTweakDescriptor
}

/** Write one tweak slice through the type-erased registry path. */
function writeTweak(tweaks: TweakPrefsMap, id: TweakId, value: unknown): void {
  ;(tweaks as unknown as Record<string, unknown>)[id] = value
}

/** Read one tweak slice through the type-erased registry path. */
function readTweak(prefs: TweakitPrefs, id: TweakId): unknown {
  return (prefs.tweaks as unknown as Record<string, unknown>)[id]
}

/**
 * Build a fresh copy of the first-run document.
 * @returns defaults for every registered tweak.
 */
export function createDefaultPrefs(): TweakitPrefs {
  const tweaks = {} as TweakPrefsMap
  for (const id of TWEAK_IDS) writeTweak(tweaks, id, descriptorOf(id).defaults())
  return { version: PREFS_VERSION, tweaks }
}

/**
 * Validate an arbitrary persisted document.
 * @param input - raw value from the host or a storage layer.
 * @returns a complete document; unknown tweaks and fields are dropped.
 */
export function normalizePrefs(input: unknown): TweakitPrefs {
  const record = isRecord(input) ? input : {}
  const rawTweaks = isRecord(record['tweaks']) ? record['tweaks'] : {}
  const tweaks = {} as TweakPrefsMap
  for (const id of TWEAK_IDS) writeTweak(tweaks, id, descriptorOf(id).normalize(rawTweaks[id]))
  return { version: PREFS_VERSION, tweaks }
}

/**
 * Flatten a document into the host Config wire fields.
 * @param prefs - complete preferences.
 * @returns flat fields named by the host schema.
 */
export function toWire(prefs: TweakitPrefs): Record<string, unknown> {
  const wire: Record<string, unknown> = {}
  for (const id of TWEAK_IDS) Object.assign(wire, descriptorOf(id).toWire(readTweak(prefs, id)))
  return wire
}

/**
 * Rebuild a document from the host Config wire fields.
 * @param wire - flat fields read from the host schema.
 * @returns a complete, normalized document.
 */
export function fromWire(wire: unknown): TweakitPrefs {
  const fields = isRecord(wire) ? wire : {}
  const tweaks = {} as TweakPrefsMap
  for (const id of TWEAK_IDS) writeTweak(tweaks, id, descriptorOf(id).fromWire(fields))
  return { version: PREFS_VERSION, tweaks }
}
