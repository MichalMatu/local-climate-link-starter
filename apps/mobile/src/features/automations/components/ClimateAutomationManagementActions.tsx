type ClimateAutomationManagementActionsProps = {
  editLabel: string;
  diagnosticsLabel: string;
  deleteLabel: string;
  deletePending: boolean;
  onEdit?: (() => void) | undefined;
  onDiagnostics?: (() => void) | undefined;
  onDelete(): void;
};

export const ClimateAutomationManagementActions = ({
  editLabel,
  diagnosticsLabel,
  deleteLabel,
  deletePending,
  onEdit,
  onDiagnostics,
  onDelete
}: ClimateAutomationManagementActionsProps) => (
  <article className="automation-card installation-detail-management">
    <div className="installation-detail-actions installation-detail-management__actions">
      {onEdit && (
        <button className="secondary-action" type="button" onClick={onEdit}>
          {editLabel}
        </button>
      )}
      <button className="secondary-action" type="button" onClick={onDiagnostics}>
        {diagnosticsLabel}
      </button>
      <button
        className="secondary-action secondary-action--danger"
        type="button"
        disabled={deletePending}
        onClick={onDelete}
      >
        {deleteLabel}
      </button>
    </div>
  </article>
);
