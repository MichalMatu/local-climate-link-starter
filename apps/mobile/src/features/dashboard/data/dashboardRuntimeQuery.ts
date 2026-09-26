export const isDashboardRuntimeQuery = (query: { queryKey: readonly unknown[] }) => {
  const root = query.queryKey[0];
  return (
    root === 'installed-automation-diagnostics' ||
    root === 'installed-automation-control' ||
    root === 'time-automation-runtime' ||
    root === 'plain-shelly-runtime' ||
    root === 'saved-ble-plug-runtime'
  );
};
