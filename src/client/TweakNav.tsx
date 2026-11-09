/**
 * Two-level tweak navigation: groups (owners) at the top, tweaks below.
 *
 * Wide layout renders one vertical tree with a collapsible header per group;
 * only one group is expanded at a time (accordion). Compact layout renders a
 * group picker plus a horizontal tab strip, so the same selection model works
 * in a narrow panel. The expanded group and the per-group memory of the last
 * selected tweak live here, in session memory only — nothing is persisted.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Copy } from './i18n'

/** One tweak as the navigation needs it (already localized). */
export interface NavTweak {
  readonly id: string
  readonly title: string
}

/** One group as the navigation needs it (already localized). */
export interface NavGroup {
  readonly id: string
  readonly title: string
  readonly tweaks: readonly NavTweak[]
}

/** Navigation props: data, current selection, and the selection callback. */
export interface TweakNavProps {
  readonly groups: readonly NavGroup[]
  readonly selection: { readonly group: string; readonly tweak: string }
  /** Render group headers and indentation (two or more groups). */
  readonly showGroupHeaders: boolean
  /** Horizontal picker layout for a narrow page. */
  readonly compact: boolean
  readonly copy: Copy
  readonly onSelect: (group: string, tweak: string) => void
  /** Prefix for DOM ids, so two mounted sections never collide. */
  readonly idPrefix: string
}

/** Keys that move focus inside one tab list. */
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']

/**
 * Render the group / tweak navigation.
 * @param props - groups, selection, layout flags, and callbacks.
 * @returns the navigation element.
 */
export function TweakNav(props: TweakNavProps) {
  const { groups, selection, showGroupHeaders, compact, copy, onSelect, idPrefix } = props
  const [expanded, setExpanded] = useState<string | null>(selection.group)
  const remembered = useRef(new Map<string, string>())
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  // Remember the last tweak the user opened in each group.
  useEffect(() => {
    remembered.current.set(selection.group, selection.tweak)
  }, [selection])

  // An external selection change (including the first one) opens its group.
  useEffect(() => {
    setExpanded(selection.group)
  }, [selection.group])

  const select = (group: string, tweak: string): void => {
    remembered.current.set(group, tweak)
    onSelect(group, tweak)
  }

  /** Expand one group, or collapse it when it is already open. */
  const toggleGroup = (group: NavGroup): void => {
    if (expanded === group.id) {
      setExpanded(null)
      return
    }
    setExpanded(group.id)
    const rememberedId = remembered.current.get(group.id)
    const tweak = group.tweaks.find((entry) => entry.id === rememberedId) ?? group.tweaks[0]
    if (tweak === undefined) return
    if (selection.group !== group.id || selection.tweak !== tweak.id) {
      onSelect(group.id, tweak.id)
    }
  }

  const listId = (group: string): string => `${idPrefix}-list-${group}`
  const tabId = (tweak: string): string => `${idPrefix}-tab-${tweak}`

  /** Arrow/Home/End navigation inside one group's tab list. */
  const move = (event: KeyboardEvent<HTMLElement>, group: NavGroup, index: number): void => {
    if (!MOVE_KEYS.includes(event.key)) return
    event.preventDefault()
    const count = group.tweaks.length
    if (count < 2) return
    const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1
    const nextIndex =
      event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (index + step + count) % count
    const next = group.tweaks[nextIndex]
    if (next === undefined) return
    onSelect(group.id, next.id)
    tabRefs.current.get(`${group.id}:${next.id}`)?.focus()
  }

  /** Left collapses, right expands, matching the tree metaphor. */
  const onGroupKeyDown = (event: KeyboardEvent<HTMLButtonElement>, group: NavGroup): void => {
    if (event.key === 'ArrowLeft' && expanded === group.id) {
      event.preventDefault()
      setExpanded(null)
    } else if (event.key === 'ArrowRight' && expanded !== group.id) {
      event.preventDefault()
      toggleGroup(group)
    }
  }

  const renderTab = (group: NavGroup, tweak: NavTweak, index: number): ReactNode => {
    const selected = selection.tweak === tweak.id
    return (
      <button
        key={tweak.id}
        ref={(element) => {
          const key = `${group.id}:${tweak.id}`
          if (element === null) tabRefs.current.delete(key)
          else tabRefs.current.set(key, element)
        }}
        id={tabId(tweak.id)}
        type="button"
        role="tab"
        className="tk-nav-item"
        aria-selected={selected}
        aria-controls={`${idPrefix}-panel`}
        tabIndex={selected ? 0 : -1}
        onClick={() => {
          select(group.id, tweak.id)
        }}
        onKeyDown={(event) => {
          move(event, group, index)
        }}
      >
        {tweak.title}
      </button>
    )
  }

  if (compact) {
    const current = groups.find((group) => group.id === selection.group) ?? groups[0]
    const tweaks = current?.tweaks ?? []
    return (
      <nav className="tk-nav" data-compact="true" aria-label={copy.navLabel}>
        {showGroupHeaders ? (
          <select
            className="tk-nav-select"
            aria-label={copy.groupLabel}
            value={current?.id ?? ''}
            onChange={(event) => {
              const group = groups.find((entry) => entry.id === event.target.value)
              if (group === undefined) return
              const rememberedId = remembered.current.get(group.id)
              const tweak =
                group.tweaks.find((entry) => entry.id === rememberedId) ?? group.tweaks[0]
              if (tweak !== undefined) select(group.id, tweak.id)
            }}
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
          </select>
        ) : null}
        <div
          className="tk-nav-chips"
          role="tablist"
          aria-orientation="horizontal"
          aria-label={current?.title ?? copy.navLabel}
        >
          {current === undefined
            ? null
            : tweaks.map((tweak, index) => renderTab(current, tweak, index))}
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="tk-nav"
      data-headers={showGroupHeaders ? 'true' : 'false'}
      aria-label={copy.navLabel}
    >
      {groups.map((group) => {
        const active = group.id === selection.group
        const isExpanded = !showGroupHeaders || expanded === group.id
        return (
          <div
            className="tk-nav-group"
            key={group.id}
            data-active={active}
            data-collapsed={active && !isExpanded && showGroupHeaders ? 'true' : undefined}
          >
            {showGroupHeaders ? (
              <button
                type="button"
                className="tk-nav-group-head"
                aria-expanded={isExpanded}
                aria-controls={listId(group.id)}
                onClick={() => {
                  toggleGroup(group)
                }}
                onKeyDown={(event) => {
                  onGroupKeyDown(event, group)
                }}
              >
                <span className="tk-nav-chevron" aria-hidden="true">
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="tk-nav-group-title" title={group.title}>
                  {group.title}
                </span>
                <span className="tk-nav-count" aria-hidden="true">
                  {group.tweaks.length}
                </span>
              </button>
            ) : null}
            {isExpanded ? (
              <div
                className="tk-nav-list"
                id={listId(group.id)}
                role="tablist"
                aria-orientation="vertical"
                aria-label={group.title}
              >
                {group.tweaks.map((tweak, index) => renderTab(group, tweak, index))}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
