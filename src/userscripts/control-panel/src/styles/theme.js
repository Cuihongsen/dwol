export const PANEL_THEME = `
:root {
  color-scheme: light;
}

#um-panel,
#um-panel * {
  box-sizing: border-box;
  font-family: 'Inter', system-ui, -apple-system, 'PingFang SC', sans-serif;
}

#um-panel {
  --um-color-text: #1f2937;
  --um-color-text-strong: #0f172a;
  --um-color-muted: #64748b;
  --um-color-bg: rgba(255, 255, 255, 0.96);
  --um-color-body-bg: rgba(248, 250, 252, 0.95);
  --um-color-soft-bg: rgba(241, 245, 249, 0.85);
  --um-color-hover-bg: rgba(226, 232, 240, 0.9);
  --um-color-border: rgba(148, 163, 184, 0.35);
  --um-color-border-soft: rgba(148, 163, 184, 0.24);
  --um-color-border-strong: rgba(148, 163, 184, 0.5);
  --um-color-border-strong-hover: rgba(59, 130, 246, 0.55);
  --um-color-accent-soft: linear-gradient(135deg, #dbeafe, #e0f2fe);
  --um-color-accent-strong: #1d4ed8;
  --um-color-focus: #38bdf8;
  --um-color-surface: rgba(255, 255, 255, 0.94);
  --um-color-success: #15803d;
  --um-color-danger: #dc2626;
  --um-color-warn-soft: linear-gradient(135deg, #fef9c3, #fef3c7);
  --um-color-warn-border: rgba(250, 204, 21, 0.6);
  --um-color-warn-strong: #92400e;
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 260px;
  z-index: 2147483647;
  color: var(--um-color-text);
  background: var(--um-color-bg);
  border-radius: 16px;
  border: 1px solid var(--um-color-border);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

#um-panel .nav {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--um-color-soft-bg);
}

#um-panel .nav button {
  flex: 1;
  min-width: 0;
  padding: 8px 0;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--um-color-muted);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

#um-panel .nav button:hover {
  background: var(--um-color-hover-bg);
  color: var(--um-color-text);
}

#um-panel .nav button[data-active='true'] {
  background: var(--um-color-accent-soft);
  color: var(--um-color-accent-strong);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.15);
}

#um-panel .nav button:focus-visible,
#um-panel .hdr .actions button:focus-visible {
  outline: 2px solid var(--um-color-focus);
  outline-offset: 2px;
}

#um-panel .modules {
  padding: 12px 16px 16px;
  background: var(--um-color-body-bg);
}

#um-panel .module {
  display: none;
}

#um-panel .module[data-active='true'] {
  display: block;
}

#um-panel .hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

#um-panel .hdr b {
  font-size: 13px;
  font-weight: 600;
  color: var(--um-color-text-strong);
}

#um-panel .hdr .actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

#um-panel .hdr .actions button {
  border-radius: 999px;
  border: 1px solid var(--um-color-border-strong);
  background: var(--um-color-surface);
  padding: 4px 14px;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--um-color-text);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease,
    transform 0.18s ease;
}

#um-panel .hdr .actions button:hover {
  background: var(--um-color-hover-bg);
  border-color: var(--um-color-border-strong-hover);
  box-shadow: 0 6px 14px rgba(148, 163, 184, 0.35);
  transform: translateY(-1px);
}

#um-panel .hdr .actions button:active {
  transform: translateY(0);
}

#um-panel .hdr .actions button[data-role='reset'] {
  background: var(--um-color-warn-soft);
  color: var(--um-color-warn-strong);
  border-color: var(--um-color-warn-border);
}

#um-panel .hdr .actions button[data-role='reset']:hover {
  box-shadow: 0 6px 14px rgba(248, 113, 113, 0.25);
}

#um-panel .body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--um-color-surface);
  border-radius: 12px;
  border: 1px solid var(--um-color-border-soft);
  padding: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

#um-panel .kv {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--um-color-text);
}

#um-panel .kv .label {
  color: var(--um-color-muted);
}

#um-panel .kv .value {
  min-width: 80px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--um-color-text-strong);
}

#um-panel .kv .state[data-state='on'] {
  color: var(--um-color-success);
  font-weight: 600;
}

#um-panel .kv .state[data-state='off'] {
  color: var(--um-color-danger);
  font-weight: 600;
}

#um-panel .hint {
  font-size: 10px;
  color: var(--um-color-muted);
  line-height: 1.6;
}

@media (prefers-color-scheme: dark) {
  #um-panel {
    color-scheme: dark;
    --um-color-text: #e2e8f0;
    --um-color-text-strong: #f8fafc;
    --um-color-muted: #94a3b8;
    --um-color-bg: rgba(15, 23, 42, 0.88);
    --um-color-body-bg: rgba(15, 23, 42, 0.78);
    --um-color-soft-bg: rgba(30, 41, 59, 0.75);
    --um-color-hover-bg: rgba(51, 65, 85, 0.88);
    --um-color-border: rgba(148, 163, 184, 0.45);
    --um-color-border-soft: rgba(148, 163, 184, 0.32);
    --um-color-border-strong: rgba(148, 163, 184, 0.6);
    --um-color-border-strong-hover: rgba(96, 165, 250, 0.75);
    --um-color-accent-soft: linear-gradient(135deg, rgba(37, 99, 235, 0.38), rgba(14, 165, 233, 0.38));
    --um-color-accent-strong: #93c5fd;
    --um-color-surface: rgba(30, 41, 59, 0.9);
    --um-color-success: #4ade80;
    --um-color-danger: #f87171;
    --um-color-warn-soft: linear-gradient(135deg, rgba(251, 191, 36, 0.35), rgba(251, 191, 36, 0.22));
    --um-color-warn-border: rgba(251, 191, 36, 0.6);
    --um-color-warn-strong: #fcd34d;
  }

  #um-panel .body {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  #um-panel .hdr .actions button[data-role='reset']:hover {
    box-shadow: 0 6px 14px rgba(251, 191, 36, 0.25);
  }
}
`;
