/**
 * One tweak's card: declarative title/description, the generated fields, an
 * optional custom extra (readout/preview), and the reset action.
 */
import type { ReactNode } from 'react';
import type { TweakUi } from '../shared/prefs';
import { type Lang } from './TweakForm';
import type { Copy } from './i18n';
import type { SaveStatus } from './store';
/** Props of one generated tweak card. */
export interface TweakCardProps<P extends object> {
    readonly ui: TweakUi<P>;
    readonly prefs: P;
    readonly lang: Lang;
    readonly copy: Copy;
    readonly status: SaveStatus;
    readonly disabled: boolean;
    readonly onPatch: (next: Partial<P>) => void;
    readonly onReset: () => void;
    /** Custom content rendered below the generated fields. */
    readonly extra?: ReactNode;
}
/**
 * Render one tweak group card.
 * @param props - metadata, values, and callbacks.
 * @returns the card.
 */
export declare function TweakCard<P extends object>(props: TweakCardProps<P>): import("react/jsx-runtime").JSX.Element;
