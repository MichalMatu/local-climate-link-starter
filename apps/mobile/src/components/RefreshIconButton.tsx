import { IconRefresh } from '@tabler/icons-react';

type RefreshIconButtonProps = {
  busy: boolean;
  className?: string;
  label: string;
  onRefresh(): void;
};

export const RefreshIconButton = ({
  busy,
  className,
  label,
  onRefresh
}: RefreshIconButtonProps) => (
  <button
    aria-busy={busy}
    aria-label={label}
    className={`icon-action runtime-refresh-action${className ? ` ${className}` : ''}`}
    disabled={busy}
    title={label}
    type="button"
    onClick={onRefresh}
  >
    <IconRefresh className="icon-action__svg" aria-hidden="true" />
  </button>
);
