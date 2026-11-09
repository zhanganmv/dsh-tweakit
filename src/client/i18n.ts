/**
 * Section-level copy (zh / en).
 *
 * Field labels/hints live with the declarative field specs in
 * `shared/prefs.ts`; this table only carries page chrome, status copy, and the
 * effective-size readout.
 */
import type { PanelMode } from '../shared/prefs'

/** Everything the section frame renders. */
export interface Copy {
  readonly tabLabel: string
  readonly title: string
  readonly intro: string
  readonly reset: string
  readonly retry: string
  readonly loading: string
  readonly saving: string
  readonly saved: string
  readonly saveFailed: string
  readonly readFailed: string
  readonly conflict: string
  readonly unavailable: string
  readonly markerMissing: string
  readonly effective: (
    size: { readonly width: number; readonly height: number } | null,
    viewport: { readonly width: number; readonly height: number },
    mode: PanelMode,
  ) => string
}

const zh: Copy = {
  tabLabel: '界面调整',
  title: '界面调整',
  intro: '按需调整 DeepSeek Harness 的界面细节。改动会立即预览，并保存到当前配置档。',
  reset: '恢复默认',
  retry: '重试',
  loading: '正在读取设置…',
  saving: '保存中…',
  saved: '已保存',
  saveFailed: '保存失败',
  readFailed: '读取设置失败，当前显示默认值。',
  conflict: '设置已在别处修改，已刷新为最新值，请重试。',
  unavailable: '当前环境不支持保存设置（settings 服务未挂载），仅可预览。',
  markerMissing: '未检测到设置面板标记，尺寸设置可能不生效。DSH 版本可能已变化。',
  effective: (size, viewport, mode) =>
    mode === 'default'
      ? `由 DSH 决定尺寸（视口 ${viewport.width} × ${viewport.height}）`
      : size === null
        ? `视口 ${viewport.width} × ${viewport.height}`
        : `当前 ${size.width} × ${size.height} · 视口 ${viewport.width} × ${viewport.height}`,
}

const en: Copy = {
  tabLabel: 'Tweaks',
  title: 'Tweaks',
  intro:
    'Adjust DeepSeek Harness UI details. Changes preview immediately and are saved to the current profile.',
  reset: 'Reset to defaults',
  retry: 'Retry',
  loading: 'Loading settings…',
  saving: 'Saving…',
  saved: 'Saved',
  saveFailed: 'Save failed',
  readFailed: 'Could not load settings; defaults are shown.',
  conflict: 'Settings changed in another window. Refreshed to the latest values — try again.',
  unavailable: 'This environment cannot save settings (no settings service); preview only.',
  markerMissing:
    'The settings panel marker was not found, so sizing may have no effect. The DSH version may have changed.',
  effective: (size, viewport, mode) =>
    mode === 'default'
      ? `Sized by DSH (viewport ${viewport.width} × ${viewport.height})`
      : size === null
        ? `Viewport ${viewport.width} × ${viewport.height}`
        : `Now ${size.width} × ${size.height} · viewport ${viewport.width} × ${viewport.height}`,
}

/** Resolve the active language tag into a supported UI language. */
export function langOf(language: string): 'zh' | 'en' {
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** Pick the copy table for one language tag. */
export function copyFor(language: string): Copy {
  return langOf(language) === 'zh' ? zh : en
}

/** Resolve the active language from the document, then the browser. */
export function detectLanguage(): string {
  const documentLanguage =
    typeof document === 'undefined' ? '' : (document.documentElement.lang ?? '')
  if (documentLanguage !== '') return documentLanguage
  return typeof navigator === 'undefined' ? 'en' : (navigator.language ?? 'en')
}
