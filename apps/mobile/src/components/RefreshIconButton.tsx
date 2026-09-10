type RefreshIconButtonProps = {
  busy: boolean;
  label: string;
  onRefresh(): void;
};

export const RefreshIconButton = ({ busy, label, onRefresh }: RefreshIconButtonProps) => (
  <button
    aria-busy={busy}
    aria-label={label}
    className="icon-action runtime-refresh-action"
    disabled={busy}
    title={label}
    type="button"
    onClick={onRefresh}
  >
    <svg
      aria-hidden="true"
      className="icon-action__svg"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M20 11a8 8 0 1 0 2 5.3" />
      <path d="M20 4v7h-7" />
    </svg>
  </button>
);
