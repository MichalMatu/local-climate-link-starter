export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type DiagnosticEventKind =
  | 'setup-started'
  | 'ble-permission'
  | 'sensor-reading'
  | 'shelly-status'
  | 'matter-blocked'
  | 'script-upload'
  | 'relay-test'
  | 'automation-decision'
  | 'error';

export interface DiagnosticEvent {
  id: string;
  kind: DiagnosticEventKind;
  severity: DiagnosticSeverity;
  message: string;
  atMs: number;
  fields?: Record<string, unknown>;
}

export interface DiagnosticLogger {
  add(event: Omit<DiagnosticEvent, 'id' | 'atMs'> & { atMs?: number }): DiagnosticEvent;
  list(): DiagnosticEvent[];
  clear(): void;
}

export class InMemoryDiagnosticLogger implements DiagnosticLogger {
  private events: DiagnosticEvent[] = [];
  private sequence = 0;

  constructor(private readonly maxEvents = 100) {}

  add(event: Omit<DiagnosticEvent, 'id' | 'atMs'> & { atMs?: number }): DiagnosticEvent {
    this.sequence += 1;
    const nextEvent: DiagnosticEvent = {
      ...event,
      id: `diag-${this.sequence}`,
      atMs: event.atMs ?? Date.now()
    };

    this.events = [...this.events, nextEvent].slice(-this.maxEvents);
    return nextEvent;
  }

  list(): DiagnosticEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}
