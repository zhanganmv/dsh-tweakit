import { type LocalizedText, type TweakUi } from '../shared/prefs';
/** Locale ids the shared field specs carry. */
export type Lang = 'zh' | 'en';
/** Resolve one bilingual text. */
export declare function text(value: LocalizedText, lang: Lang): string;
/** Props of the generic form. */
export interface TweakFormProps<P extends object> {
    readonly ui: TweakUi<P>;
    readonly prefs: P;
    readonly lang: Lang;
    readonly disabled: boolean;
    readonly onPatch: (next: Partial<P>) => void;
}
/**
 * Render every visible field of one tweak.
 * @param props - field metadata, current preferences, and the patch callback.
 * @returns the form body.
 */
export declare function TweakForm<P extends object>({ ui, prefs, lang, disabled, onPatch, }: TweakFormProps<P>): import("react/jsx-runtime").JSX.Element;
