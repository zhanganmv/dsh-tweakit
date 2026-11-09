/**
 * Client half of dsh-tweakit — the browser side.
 *
 * `apply` wires four things to the plugin fiber:
 *  - the preference store over the official settings form service;
 *  - the single panel stylesheet controller (applies each tweak's effect);
 *  - the static section stylesheet;
 *  - the `settings.section` registration that renders the Tweaks tab.
 *
 * Every listener/timer/style is released by the effect disposer, so disabling
 * the plugin or HMR leaves no residue behind.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Services the client half needs before it starts. */
export declare const inject: string[];
/**
 * Cordis plugin body.
 * @param ctx - client context.
 */
export declare function apply(ctx: Context): void;
