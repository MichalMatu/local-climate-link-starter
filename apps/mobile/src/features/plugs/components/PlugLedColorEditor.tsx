import { ColorSwatch } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { plugLedHexToRgb, plugLedRgbToHex } from '../data/plugLedColor.js';

const COLOR_PRESETS = [
  { id: 'green', hex: '#00ff00' },
  { id: 'red', hex: '#ff0000' },
  { id: 'blue', hex: '#0088ff' },
  { id: 'amber', hex: '#ff9d00' },
  { id: 'white', hex: '#ffffff' },
  { id: 'cyan', hex: '#00ffff' }
] as const;

const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

type PlugLedColorEditorProps = {
  ariaPrefix: string;
  colorLabel: string;
  value: [number, number, number];
  onChange(value: [number, number, number]): void;
};

export const PlugLedColorEditor = ({
  ariaPrefix,
  colorLabel,
  value,
  onChange
}: PlugLedColorEditorProps) => {
  const canonicalHex = plugLedRgbToHex(value);
  const [hexDraft, setHexDraft] = useState(canonicalHex);

  useEffect(() => {
    setHexDraft(canonicalHex);
  }, [canonicalHex]);

  const commitHex = (valueToCommit: string) => {
    if (!isHexColor(valueToCommit)) {
      setHexDraft(canonicalHex);
      return;
    }
    const normalized = valueToCommit.toLowerCase();
    setHexDraft(normalized);
    onChange(plugLedHexToRgb(normalized));
  };

  return (
    <div className="plug-color-editor">
      <div className="plug-color-presets" aria-label={`${ariaPrefix} ${colorLabel}`}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            aria-label={`${ariaPrefix} ${preset.hex}`}
            aria-pressed={canonicalHex.toLowerCase() === preset.hex}
            className="plug-color-preset"
            title={preset.hex}
            type="button"
            onClick={() => commitHex(preset.hex)}
          >
            <ColorSwatch color={preset.hex} />
          </button>
        ))}
      </div>
      <label className="field plug-color-hex">
        <span>{colorLabel}</span>
        <div className="plug-color-hex__control">
          <span className="plug-color-preview">
            <ColorSwatch color={canonicalHex} />
          </span>
          <input
            aria-label={`${ariaPrefix} ${colorLabel}`}
            autoCapitalize="off"
            autoCorrect="off"
            inputMode="text"
            maxLength={7}
            spellCheck={false}
            value={hexDraft}
            onBlur={() => commitHex(hexDraft)}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setHexDraft(next);
              if (isHexColor(next)) onChange(plugLedHexToRgb(next));
            }}
          />
        </div>
      </label>
    </div>
  );
};
