/**
 * Section-level copy (zh / en).
 *
 * Field labels/hints live with the declarative field specs in
 * `shared/prefs.ts`; this table only carries page chrome, status copy, and the
 * effective-size readout.
 */
import type { PanelMode } from '../shared/prefs';
/** Everything the section frame renders. */
export interface Copy {
    readonly tabLabel: string;
    readonly title: string;
    readonly intro: string;
    readonly reset: string;
    readonly retry: string;
    readonly loading: string;
    readonly saving: string;
    readonly saved: string;
    readonly saveFailed: string;
    readonly readFailed: string;
    readonly conflict: string;
    readonly unavailable: string;
    readonly markerMissing: string;
    readonly effective: (size: {
        readonly width: number;
        readonly height: number;
    } | null, viewport: {
        readonly width: number;
        readonly height: number;
    }, mode: PanelMode) => string;
}
/** Resolve the active language tag into a supported UI language. */
export declare function langOf(language: string): 'zh' | 'en';
/** Pick the copy table for one language tag. */
export declare function copyFor(language: string): Copy;
/** Resolve the active language from the document, then the browser. */
export declare function detectLanguage(): string;
