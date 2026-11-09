/**
 * Client preference store backed by the official settings form service.
 *
 * The Host is the fact source: `ctx.configForms.get(entryId)` carries the
 * resolved Config section, its revision fence, writability, and user/base
 * layers. The store keeps an optimistic copy for immediate preview (a slider
 * must move the panel before the round trip), debounces one revision-fenced
 * `mutate`, and re-seeds from the Host snapshot when the write settles.
 */
import { type TweakId, type TweakPrefsMap, type TweakitPrefs } from '../shared/prefs';
import type { ConfigFormFace } from './config-form';
/** Save feedback shown beside the group title. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
/** One failure the section can translate into localized copy. */
export interface PrefsFailure {
    readonly code: string;
    readonly message: string;
    /** Whether the failure happened while reading or while writing. */
    readonly source: 'load' | 'save';
}
/** Immutable store snapshot. */
export interface PrefsState {
    readonly prefs: TweakitPrefs;
    readonly revision: number;
    readonly writable: boolean;
    readonly loaded: boolean;
    readonly status: SaveStatus;
    readonly error: PrefsFailure | null;
}
/** Store construction options (timings are injectable for tests). */
export interface PrefsStoreOptions {
    readonly form: ConfigFormFace;
    /** Debounce before a write leaves the browser. Defaults to 200ms. */
    readonly debounceMs?: number;
    /** How long the “saved” badge stays visible. Defaults to 1500ms. */
    readonly savedFlashMs?: number;
}
/** The store surface the section component consumes. */
export interface PrefsStore {
    getSnapshot(): PrefsState;
    subscribe(listener: () => void): () => void;
    /** Begin following the Host form snapshot. */
    start(): void;
    /** Re-seed from the Host snapshot (retry / conflict recovery). */
    refresh(): void;
    /** Optimistically patch one typed tweak slice and schedule a save. */
    patch<K extends TweakId>(id: K, next: Partial<TweakPrefsMap[K]>): void;
    /** Generic-renderer entry point: patch a tweak with an untyped field bag. */
    patchAny(id: TweakId, next: Record<string, unknown>): void;
    /** Restore one tweak slice to its defaults (clears the user layer). */
    reset(id: TweakId): void;
    dispose(): void;
}
/**
 * Create the preference store.
 * @param options - settings form and timing options.
 * @returns the store instance.
 */
export declare function createPrefsStore(options: PrefsStoreOptions): PrefsStore;
