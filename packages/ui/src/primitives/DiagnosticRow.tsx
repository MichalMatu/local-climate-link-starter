export interface DiagnosticRowProps {
  label: string;
  value: string;
  tone?: 'normal' | 'warning' | 'danger';
  href?: string;
  linkLabel?: string;
}

export const DiagnosticRow = ({
  label,
  value,
  tone = 'normal',
  href,
  linkLabel
}: DiagnosticRowProps) => {
  const className = `lcl-diagnostic-row lcl-diagnostic-row--${tone}${
    href ? ' lcl-diagnostic-row--link' : ''
  }`;
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );

  if (href) {
    return (
      <a
        aria-label={linkLabel}
        className={className}
        href={href}
        rel="noreferrer noopener"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
};
