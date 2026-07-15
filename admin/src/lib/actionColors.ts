/** Shared functional colors for table row-action buttons (owner reference
 * 2026-07-16: classic bordered-table admin look) — distinct per action type
 * so a dense action cluster reads at a glance, while colorPrimary (#1E1E1E)
 * stays reserved for the one primary/CTA button on a page. Never reuses the
 * old brand coral (#F15929) — these are functional accents, not brand color.
 *
 * Most row-action buttons use antd's own `color="orange"/"blue"/"cyan"
 * variant="solid"` Button presets directly (proper hover/active states for
 * free). These hex values exist only for spots that can't take Button props
 * — e.g. tinting an icon inside a Dropdown menu item — and are the exact
 * antd preset-6 hex so they match the Button presets pixel-for-pixel. */
export const ACTION_COLOR = {
  edit: '#FA8C16', // antd orange-6 (Button color="orange")
  adjust: '#1677FF', // antd blue-6 (Button color="blue")
  history: '#13C2C2', // antd cyan-6 (Button color="cyan")
  delete: '#E5484D', // theme colorError
} as const;
