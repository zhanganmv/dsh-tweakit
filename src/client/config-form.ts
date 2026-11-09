/**
 * Structural view of the official settings form service (`ctx.configForms`).
 *
 * P0 verified in a dev profile that a third-party plugin can reach its own
 * namespace through this service: the snapshot carries the resolved section,
 * the revision fence, writability, and the user/base layers, and `mutate`
 * writes with the same revision semantics the built-in settings pages use.
 */
export interface ConfigFormSnapshot {
  readonly status: 'loading' | 'ready' | 'unavailable'
  /** Resolved flat wire section (the plugin Config shape). */
  readonly value: unknown
  /** Composition layer the value resolves over. */
  readonly base: unknown
  /** Raw user layer as stored. */
  readonly user: unknown
  /** Revision fencing the next write. */
  readonly revision: number | undefined
  readonly writable: boolean
}

/** One path-addressed edit accepted by the settings form. */
export type SettingsPathOp =
  | { readonly op: 'set'; readonly path: readonly string[]; readonly value: unknown }
  | { readonly op: 'unset'; readonly path: readonly string[] }

/** One namespace's form controller. */
export interface ConfigFormFace {
  getSnapshot(): ConfigFormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
  mutate(ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<boolean>
}

/** The settings domain's form provider. */
export interface ConfigFormsFace {
  get(entryId: string): ConfigFormFace
}
