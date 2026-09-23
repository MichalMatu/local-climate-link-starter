import { ColorSwatch, Modal } from '@lcl/ui';
import { useState } from 'react';
import { plugLedHexToRgb, plugLedRgbToHex } from '../data/plugLedColor.js';

const COLOR_PRESETS = [
  { id: 'green', hex: '#00ff00' },
  { id: 'red', hex: '#ff0000' },
  { id: 'blue', hex: '#0088ff' },
  { id: 'amber', hex: '#ff9d00' },
  { id: 'white', hex: '#ffffff' },
  { id: 'cyan', hex: '#00ffff' }
] as const;

type HslColor = {
  hue: number;
  saturation: number;
  lightness: number;
};

const rgbPercentToHsl = ([redPct, greenPct, bluePct]: [
  number,
  number,
  number
]): HslColor => {
  const red = redPct / 100;
  const green = greenPct / 100;
  const blue = bluePct / 100;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness: Math.round(lightness * 100) };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) hue = 60 * (((green - blue) / delta) % 6);
  if (max === green) hue = 60 * ((blue - red) / delta + 2);
  if (max === blue) hue = 60 * ((red - green) / delta + 4);
  if (hue < 0) hue += 360;

  return {
    hue: Math.round(hue),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100)
  };
};

const hslToRgbPercent = ({
  hue,
  saturation,
  lightness
}: HslColor): [number, number, number] => {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  let rgb: [number, number, number];

  if (h < 60) rgb = [chroma, x, 0];
  else if (h < 120) rgb = [x, chroma, 0];
  else if (h < 180) rgb = [0, chroma, x];
  else if (h < 240) rgb = [0, x, chroma];
  else if (h < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  return rgb.map((value) => Math.round((value + match) * 1000) / 10) as [
    number,
    number,
    number
  ];
};

type PlugLedColorEditorProps = {
  ariaPrefix: string;
  colorLabel: string;
  defaultLabel: string;
  customLabel: string;
  customTitle: string;
  hueLabel: string;
  saturationLabel: string;
  lightnessLabel: string;
  applyLabel: string;
  cancelLabel: string;
  fallbackValue: [number, number, number];
  value: [number, number, number] | null;
  onChange(value: [number, number, number] | null): void;
};

export const PlugLedColorEditor = ({
  ariaPrefix,
  colorLabel,
  defaultLabel,
  customLabel,
  customTitle,
  hueLabel,
  saturationLabel,
  lightnessLabel,
  applyLabel,
  cancelLabel,
  fallbackValue,
  value,
  onChange
}: PlugLedColorEditorProps) => {
  const canonicalHex = value ? plugLedRgbToHex(value).toLowerCase() : null;
  const isPreset = COLOR_PRESETS.some((preset) => preset.hex === canonicalHex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerHsl, setPickerHsl] = useState<HslColor>(() =>
    rgbPercentToHsl(value ?? fallbackValue)
  );
  const pickerRgb = hslToRgbPercent(pickerHsl);

  const openPicker = () => {
    setPickerHsl(rgbPercentToHsl(value ?? fallbackValue));
    setPickerOpen(true);
  };

  const updatePicker = (field: keyof HslColor, valueToSet: number) => {
    setPickerHsl((current) => ({ ...current, [field]: valueToSet }));
  };

  return (
    <div className="plug-color-editor">
      <div className="plug-color-presets" aria-label={`${ariaPrefix} ${colorLabel}`}>
        <button
          aria-label={`${ariaPrefix} ${defaultLabel}`}
          aria-pressed={value === null}
          className="plug-color-preset plug-color-preset--default"
          title={defaultLabel}
          type="button"
          onClick={() => onChange(null)}
        >
          <span aria-hidden="true">A</span>
        </button>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            aria-label={`${ariaPrefix} ${preset.hex}`}
            aria-pressed={canonicalHex === preset.hex}
            className="plug-color-preset"
            title={preset.hex}
            type="button"
            onClick={() => onChange(plugLedHexToRgb(preset.hex))}
          >
            <ColorSwatch color={preset.hex} />
          </button>
        ))}
        <button
          aria-label={`${ariaPrefix} ${customLabel}`}
          aria-pressed={value !== null && !isPreset}
          className="plug-color-preset plug-color-preset--custom"
          title={customLabel}
          type="button"
          onClick={openPicker}
        >
          <span className="plug-color-preset__rainbow" aria-hidden="true" />
        </button>
      </div>

      <Modal
        actions={
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              onChange(pickerRgb);
              setPickerOpen(false);
            }}
          >
            {applyLabel}
          </button>
        }
        closeLabel={cancelLabel}
        open={pickerOpen}
        title={`${ariaPrefix} · ${customTitle}`}
        onClose={() => setPickerOpen(false)}
      >
        <div className="plug-color-picker">
          <div className="plug-color-picker__preview" aria-hidden="true">
            <ColorSwatch color={plugLedRgbToHex(pickerRgb)} />
          </div>
          <label className="plug-color-picker__field">
            <span>
              {hueLabel} <strong>{pickerHsl.hue}°</strong>
            </span>
            <input
              aria-label={`${ariaPrefix} ${hueLabel}`}
              className="plug-color-picker__range plug-color-picker__range--hue"
              max="360"
              min="0"
              type="range"
              value={pickerHsl.hue}
              onChange={(event) => updatePicker('hue', Number(event.currentTarget.value))}
            />
          </label>
          <label className="plug-color-picker__field">
            <span>
              {saturationLabel} <strong>{pickerHsl.saturation}%</strong>
            </span>
            <input
              aria-label={`${ariaPrefix} ${saturationLabel}`}
              className="plug-color-picker__range"
              max="100"
              min="0"
              type="range"
              value={pickerHsl.saturation}
              onChange={(event) =>
                updatePicker('saturation', Number(event.currentTarget.value))
              }
            />
          </label>
          <label className="plug-color-picker__field">
            <span>
              {lightnessLabel} <strong>{pickerHsl.lightness}%</strong>
            </span>
            <input
              aria-label={`${ariaPrefix} ${lightnessLabel}`}
              className="plug-color-picker__range"
              max="100"
              min="0"
              type="range"
              value={pickerHsl.lightness}
              onChange={(event) =>
                updatePicker('lightness', Number(event.currentTarget.value))
              }
            />
          </label>
        </div>
      </Modal>
    </div>
  );
};
