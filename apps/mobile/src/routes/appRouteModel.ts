import type { AppNavigationKind } from '../components/AppBottomNavigation.js';
import type { SetupIntent } from '../flows/setup-intent.js';

type DashboardRoute = { type: 'dashboard'; kind?: AppNavigationKind };
type SetupRoute = {
  type: 'setup';
  intent: SetupIntent;
  sourceKind: AppNavigationKind;
  shellyId?: string;
  editInstallationId?: string;
};
type DeviceAddReturnRoute = DashboardRoute | SetupRoute;
type DeviceAddRoute = {
  type: 'device-add';
  device: 'plug' | 'sensor';
  sourceKind: AppNavigationKind;
  returnTo: DeviceAddReturnRoute;
  sensorMode?: 'manual' | 'phone-scan';
  plugTransport?: 'wifi' | 'bluetooth';
};
type InstallationRoute = {
  type: 'installation';
  installationId: string;
  kind: AppNavigationKind;
};
type PlugSettingsRoute = { type: 'plug-settings'; deviceId: string };
type BlePlugDetailRoute = { type: 'ble-plug-detail'; physicalId: string };
type PlugBleReturnRoute = PlugSettingsRoute | InstallationRoute;
type PlugBleDiscoveryRoute = {
  type: 'plug-ble-discovery';
  deviceId: string;
  returnTo: PlugBleReturnRoute;
};
type PrimaryAppRoute =
  | DashboardRoute
  | DeviceAddRoute
  | PlugSettingsRoute
  | BlePlugDetailRoute
  | PlugBleDiscoveryRoute
  | { type: 'intent'; sourceKind: AppNavigationKind; shellyId?: string }
  | SetupRoute
  | InstallationRoute;

export type AppRoute = PrimaryAppRoute | { type: 'settings'; returnTo: PrimaryAppRoute };

export const activeNavigationForRoute = (
  route: AppRoute
): AppNavigationKind | 'settings' => {
  if (route.type === 'settings') return 'settings';
  if (route.type === 'dashboard') return route.kind ?? 'climate';
  if (route.type === 'installation') return route.kind;
  if (
    route.type === 'plug-settings' ||
    route.type === 'ble-plug-detail' ||
    route.type === 'plug-ble-discovery'
  ) {
    return 'climate';
  }
  if (route.type === 'device-add') return route.sourceKind;
  return route.sourceKind;
};
