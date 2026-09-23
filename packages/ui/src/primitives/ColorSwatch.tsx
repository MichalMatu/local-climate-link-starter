import type { CSSProperties } from 'react';
import './ColorSwatch.css';

export type ColorSwatchProps = {
  color: string;
};

export const ColorSwatch = ({ color }: ColorSwatchProps) => (
  <span
    aria-hidden="true"
    className="lcl-color-swatch"
    style={{ '--lcl-color-swatch-value': color } as CSSProperties}
  />
);
