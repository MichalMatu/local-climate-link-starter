import type { ReactNode } from 'react';
import { AppBottomNavigation, type AppNavigationKind } from './AppBottomNavigation.js';

type AppShellProps = {
  activeKind: AppNavigationKind | 'settings';
  children: ReactNode;
  onOpenClimate(): void;
  onOpenTime(): void;
  onOpenSettings(): void;
};

export const AppShell = ({
  activeKind,
  children,
  onOpenClimate,
  onOpenTime,
  onOpenSettings
}: AppShellProps) => (
  <div className="app-root-shell app-bottom-nav-shell">
    {children}
    <AppBottomNavigation
      activeKind={activeKind}
      onOpenClimate={onOpenClimate}
      onOpenTime={onOpenTime}
      onOpenSettings={onOpenSettings}
    />
  </div>
);
