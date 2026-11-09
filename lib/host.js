// src/host/index.ts
import z from "@deepseek-ai/schemastery";

// src/shared/prefs.ts
var PANEL_LIMITS = {
  width: { min: 640, max: 1920 },
  height: { min: 480, max: 1440 },
  margin: { min: 0, max: 64 }
};
var PANEL_MODES = ["default", "full", "custom"];
var DEFAULT_SETTINGS_PANEL = {
  mode: "custom",
  width: 1360,
  height: 1e3,
  margin: 24
};
var TWEAK_UI = {
  "settings-panel": {
    order: 10,
    title: { zh: "\u8BBE\u7F6E\u7A97\u53E3", en: "Settings window" },
    description: {
      zh: "\u63A7\u5236\u8BBE\u7F6E\u9762\u677F\u7684\u5927\u5C0F\u3002\u7A97\u53E3\u53D8\u5C0F\u65F6\u4F1A\u81EA\u52A8\u6536\u7F29\uFF0C\u56DB\u5468\u8FB9\u8DDD\u4FDD\u6301\u4E0D\u53D8\u3002",
      en: "Control the size of the settings panel. It shrinks with the viewport and keeps its margins."
    },
    fields: [
      {
        kind: "segmented",
        key: "mode",
        field: "mode",
        label: { zh: "\u6A21\u5F0F", en: "Mode" },
        options: [
          { value: "default", label: { zh: "\u9ED8\u8BA4", en: "Default" } },
          { value: "full", label: { zh: "\u5168\u5C4F", en: "Full" } },
          { value: "custom", label: { zh: "\u81EA\u5B9A\u4E49", en: "Custom" } }
        ]
      },
      {
        kind: "slider",
        key: "width",
        field: "width",
        label: { zh: "\u5BBD\u5EA6", en: "Width" },
        min: PANEL_LIMITS.width.min,
        max: PANEL_LIMITS.width.max,
        step: 10,
        unit: "px",
        visibleWhen: (prefs) => prefs.mode === "custom"
      },
      {
        kind: "slider",
        key: "height",
        field: "height",
        label: { zh: "\u9AD8\u5EA6", en: "Height" },
        min: PANEL_LIMITS.height.min,
        max: PANEL_LIMITS.height.max,
        step: 10,
        unit: "px",
        visibleWhen: (prefs) => prefs.mode === "custom"
      },
      {
        kind: "number",
        key: "margin",
        field: "margin",
        label: { zh: "\u8FB9\u8DDD", en: "Margin" },
        hint: {
          zh: "\u9762\u677F\u4E0E\u7A97\u53E3\u8FB9\u7F18\u4E4B\u95F4\u4FDD\u7559\u7684\u8DDD\u79BB\u3002",
          en: "Distance kept between the panel and the window edges."
        },
        min: PANEL_LIMITS.margin.min,
        max: PANEL_LIMITS.margin.max,
        step: 1,
        unit: "px",
        disabledWhen: (prefs) => prefs.mode === "default"
      }
    ]
  }
};

// src/host/index.ts
var name = "dsh-tweakit";
var Config = z.object({
  settingsPanelMode: z.union(PANEL_MODES.map((mode) => z.const(mode))).default(DEFAULT_SETTINGS_PANEL.mode).volatile(),
  settingsPanelWidth: z.number().step(1).min(PANEL_LIMITS.width.min).max(PANEL_LIMITS.width.max).default(DEFAULT_SETTINGS_PANEL.width).volatile(),
  settingsPanelHeight: z.number().step(1).min(PANEL_LIMITS.height.min).max(PANEL_LIMITS.height.max).default(DEFAULT_SETTINGS_PANEL.height).volatile(),
  settingsPanelMargin: z.number().step(1).min(PANEL_LIMITS.margin.min).max(PANEL_LIMITS.margin.max).default(DEFAULT_SETTINGS_PANEL.margin).volatile()
});
function apply(ctx) {
  ctx.inject(["settings"], (child) => {
    const settings = child.get("settings");
    child.effect(
      () => settings.configure({ auto: false }, ctx.fiber),
      "dsh-tweakit: settings presentation"
    );
  });
}
export {
  Config,
  apply,
  name
};
//# sourceMappingURL=host.js.map
