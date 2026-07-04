export type RuntimeIssueKind = 'error' | 'unhandledrejection' | 'manual';

export type RuntimeIssue = {
  id: number;
  kind: RuntimeIssueKind;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  atIso: string;
};

export const runtimeIssuesChangeEvent = 'lcl:runtime-issues-change';

const maxRuntimeIssues = 50;
const runtimeIssues: RuntimeIssue[] = [];
let issueSequence = 0;
let cleanupRuntimeCapture: (() => void) | null = null;

const dispatchRuntimeIssuesChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(runtimeIssuesChangeEvent));
  }
};

const messageFromUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

const stackFromUnknown = (value: unknown): string | undefined =>
  value instanceof Error ? value.stack : undefined;

export const reportRuntimeIssue = (
  kind: RuntimeIssueKind,
  value: unknown,
  metadata: Partial<Pick<RuntimeIssue, 'source' | 'line' | 'column'>> = {}
): RuntimeIssue => {
  const stack = stackFromUnknown(value);
  const issue: RuntimeIssue = {
    id: ++issueSequence,
    kind,
    message: messageFromUnknown(value),
    atIso: new Date().toISOString(),
    ...metadata
  };
  if (stack) {
    issue.stack = stack;
  }

  runtimeIssues.push(issue);
  if (runtimeIssues.length > maxRuntimeIssues) {
    runtimeIssues.splice(0, runtimeIssues.length - maxRuntimeIssues);
  }
  dispatchRuntimeIssuesChange();
  return issue;
};

export const getRuntimeIssues = (): readonly RuntimeIssue[] => [...runtimeIssues];

export const clearRuntimeIssues = (): readonly RuntimeIssue[] => {
  runtimeIssues.splice(0, runtimeIssues.length);
  dispatchRuntimeIssuesChange();
  return [];
};

export const installRuntimeDiagnostics = (): (() => void) => {
  if (cleanupRuntimeCapture || typeof window === 'undefined') {
    return cleanupRuntimeCapture ?? (() => undefined);
  }

  const handleError = (event: ErrorEvent) => {
    const metadata: Partial<Pick<RuntimeIssue, 'source' | 'line' | 'column'>> = {};
    if (event.filename) {
      metadata.source = event.filename;
    }
    if (event.lineno) {
      metadata.line = event.lineno;
    }
    if (event.colno) {
      metadata.column = event.colno;
    }

    reportRuntimeIssue('error', event.error ?? event.message, metadata);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportRuntimeIssue('unhandledrejection', event.reason);
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  cleanupRuntimeCapture = () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    cleanupRuntimeCapture = null;
  };
  return cleanupRuntimeCapture;
};
