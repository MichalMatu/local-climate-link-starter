export const compactGeneratedShellyScript = (script: string): string =>
  script.replace(/\n\s*/g, '');
