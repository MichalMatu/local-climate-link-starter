from pathlib import Path

p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
start = s.find('.app-settings {')
end = s.find('.toggle-row {', start)
if start < 0 or end < 0:
    raise SystemExit('settings css boundaries not found')
block = r'''.app-settings-screen {
  align-content: start;
  gap: var(--lcl-spacing-md);
}

.app-settings-screen .app-settings-screen__header {
  align-items: center;
  min-height: var(--lcl-size-control-min-height);
}

.app-settings-screen .app-settings-screen__header h1 {
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-md));
  line-height: var(--lcl-line-height-tight);
}

.app-settings {
  display: grid;
  gap: var(--lcl-spacing-md);
}

.app-settings__section {
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-lg);
  box-shadow: none;
  display: grid;
  gap: var(--lcl-spacing-md);
  padding: var(--lcl-spacing-md);
}

.app-settings__section-header {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-md);
  justify-content: space-between;
}

.app-settings__section-header h2 {
  font-size: var(--lcl-font-size-xl);
  line-height: var(--lcl-line-height-tight);
  margin: 0;
}

.app-settings__choice-grid {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(auto-fit, minmax(6.75rem, 1fr));
}

.app-settings__choice-grid--appearance {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.app-settings__choice {
  align-items: center;
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: var(--lcl-font-size-lg);
  font-weight: 800;
  justify-content: center;
  min-height: var(--lcl-size-compact-control-min-height);
  padding: 0 var(--lcl-spacing-md);
}

.app-settings__choice--active {
  background: var(--lcl-color-accent);
  border-color: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.app-settings__diagnostics {
  gap: 0;
  overflow: hidden;
  padding: 0;
}

.app-settings__diagnostics-summary {
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: var(--lcl-font-size-xl);
  font-weight: 800;
  gap: var(--lcl-spacing-md);
  justify-content: space-between;
  list-style: none;
  min-height: var(--lcl-size-control-min-height);
  padding: var(--lcl-spacing-md);
}

.app-settings__diagnostics-summary::-webkit-details-marker {
  display: none;
}

.app-settings__diagnostics-status {
  align-items: center;
  color: var(--lcl-color-text-muted);
  display: inline-flex;
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
  gap: var(--lcl-spacing-xs);
}

.app-settings__diagnostics-chevron {
  height: var(--lcl-size-control-icon-size);
  transition: transform var(--lcl-motion-fast);
  width: var(--lcl-size-control-icon-size);
}

.app-settings__diagnostics[open] .app-settings__diagnostics-chevron {
  transform: rotate(180deg);
}

.app-settings__diagnostics-body {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  display: grid;
  gap: var(--lcl-spacing-md);
  padding: var(--lcl-spacing-md);
}

.app-settings__issues {
  color: var(--lcl-color-text-muted);
  display: grid;
  gap: var(--lcl-spacing-sm);
  line-height: var(--lcl-line-height-compact);
  margin: 0;
  padding-left: var(--lcl-spacing-lg);
}

.app-settings__feedback {
  color: var(--lcl-color-text-muted);
  font-weight: 800;
  margin: 0;
}

.app-settings__feedback--warning {
  color: var(--lcl-color-status-warning-text);
}

'''
p.write_text(s[:start] + block + s[end:])
print('settings css updated')
