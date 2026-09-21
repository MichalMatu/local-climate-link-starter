const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const plugLedRgbToHex = (rgb: [number, number, number] | null): string => {
  if (!rgb) return '#000000';
  return `#${rgb
    .map((value) =>
      clampByte((clampPercent(value) / 100) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
};

export const plugLedHexToRgb = (hex: string): [number, number, number] => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error('Expected #RRGGBB LED color.');
  const encoded = match[1]!;
  return [0, 2, 4].map((offset) => {
    const byte = Number.parseInt(encoded.slice(offset, offset + 2), 16);
    return Math.round((byte / 255) * 1000) / 10;
  }) as [number, number, number];
};
