type AppPageBackProps = {
  label: string;
  onBack(): void;
};

export const AppPageBack = ({ label, onBack }: AppPageBackProps) => (
  <div className="setup-context app-page-back-row">
    <button className="setup-context__back" type="button" onClick={onBack}>
      ‹ {label}
    </button>
  </div>
);
