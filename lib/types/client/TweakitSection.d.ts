import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type Lang } from './TweakForm';
import type { Copy } from './i18n';
import type { PrefsStore } from './store';
/** Injected business face registered with the section. */
export interface TweakitSectionInjected {
    readonly store: PrefsStore;
    readonly copy: Copy;
    readonly lang: Lang;
}
/** Complete section props: runtime owner share plus the injected face. */
export type TweakitSectionProps = PropsRuntime<'settings.section'> & TweakitSectionInjected;
/**
 * Render the Tweaks settings page.
 * @param props - injected store, copy, and language.
 * @returns the section body.
 */
export declare function TweakitSection({ store, copy, lang }: TweakitSectionProps): import("react/jsx-runtime").JSX.Element;
