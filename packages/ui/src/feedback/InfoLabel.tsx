import type { ReactNode } from 'react';
import { InfoPopover } from './InfoPopover.js';

export interface InfoLabelProps {
  label: ReactNode;
  infoLabel: string;
  title?: string;
  children: ReactNode;
  className?: string;
}

export const InfoLabel = ({
  label,
  infoLabel,
  title,
  children,
  className
}: InfoLabelProps) => (
  <span className={['lcl-info-label', className].filter(Boolean).join(' ')}>
    <span className="lcl-info-label__text">{label}</span>
    <InfoPopover label={infoLabel} title={title}>
      {children}
    </InfoPopover>
  </span>
);
