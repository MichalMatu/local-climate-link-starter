export interface ScriptPreviewProps {
  label: string;
  code: string;
  copyLabel: string;
  copyAriaLabel?: string;
  variant?: 'default' | 'fill' | 'tall';
  onCopy?: () => void;
}

export const ScriptPreview = ({
  label,
  code,
  copyLabel,
  copyAriaLabel,
  variant = 'default',
  onCopy
}: ScriptPreviewProps) => {
  const className =
    variant === 'default'
      ? 'lcl-script-preview'
      : `lcl-script-preview lcl-script-preview--${variant}`;

  return (
    <section className={className} aria-label={label}>
      <div className="lcl-script-preview__header">
        <span>{label}</span>
        {onCopy && (
          <button
            aria-label={copyAriaLabel ?? copyLabel}
            className="lcl-script-preview__copy"
            type="button"
            title={copyAriaLabel ?? copyLabel}
            onClick={onCopy}
          >
            {copyLabel}
          </button>
        )}
      </div>
      <pre className="lcl-script-preview__code">{code}</pre>
    </section>
  );
};
