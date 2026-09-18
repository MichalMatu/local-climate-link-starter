export const stripTrailingUnit = (label: string, unit: string): string => {
  const suffix = ` ${unit}`;
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
};
