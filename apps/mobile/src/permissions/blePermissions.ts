export type BlePermissionStatus = 'demo-granted' | 'needs-platform-permission';

export const getDemoBlePermissionStatus = (): BlePermissionStatus => 'demo-granted';
