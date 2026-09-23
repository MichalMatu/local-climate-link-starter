import './ToggleSwitch.css';
import type { ChangeEvent, ReactNode } from 'react';

export type ToggleSwitchProps = {
  checked: boolean;
  children: ReactNode;
  disabled?: boolean;
  name?: string;
  onChange(checked: boolean): void;
};

export const ToggleSwitch = ({
  checked,
  children,
  disabled = false,
  name,
  onChange
}: ToggleSwitchProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.checked);
  };

  return (
    <label
      className={
        disabled ? 'lcl-toggle-switch lcl-toggle-switch--disabled' : 'lcl-toggle-switch'
      }
    >
      <input
        className="lcl-toggle-switch__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        name={name}
        onChange={handleChange}
      />
      <span className="lcl-toggle-switch__track" aria-hidden="true">
        <span className="lcl-toggle-switch__thumb" />
      </span>
      <span className="lcl-toggle-switch__label">{children}</span>
    </label>
  );
};
