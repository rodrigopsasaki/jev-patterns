export interface InspectionIssue {
  readonly path: readonly (string | number)[];
  readonly code: 'invalid-type' | 'out-of-range' | 'invalid-total' | 'inconsistent-answer';
  readonly message: string;
}

/** Internal data failure; ordinary exceptions and invalid options are never swallowed. */
export class InputIssue extends TypeError {
  readonly issue: InspectionIssue;

  constructor(path: InspectionIssue['path'], code: InspectionIssue['code'], message: string) {
    super(message);
    this.issue = { path, code, message };
  }
}

export function object(value: unknown, name: string, path: InspectionIssue['path'] = [name]) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new InputIssue(path, 'invalid-type', `${name} must be a decoded JSON object`);
  }
  return Object.fromEntries(Object.entries(value));
}

export function text(value: unknown, name: string, path: InspectionIssue['path'] = [name]): string {
  if (typeof value !== 'string') {
    throw new InputIssue(path, 'invalid-type', `${name} must be a string`);
  }
  return value;
}

export function probability(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new InputIssue(
      [name],
      typeof value === 'number' ? 'out-of-range' : 'invalid-type',
      `${name} must be finite and in [0, 1]`,
    );
  }
  return value;
}
