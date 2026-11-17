/**
 * RFC 7807 Problem Details for HTTP APIs
 * Padrão estruturado de resposta para falhas operacionais e de validação.
 */

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalid_params?: InvalidParam[];
  [key: string]: unknown;
}

export class ProblemDetailsError extends Error {
  public readonly problem: ProblemDetails;
  public readonly status: number;
  public readonly type: string;
  public readonly title: string;
  public readonly detail: string;
  public readonly invalidParams?: InvalidParam[];

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title || `Erro HTTP ${problem.status}`);
    this.name = "ProblemDetailsError";
    this.problem = problem;
    this.status = problem.status;
    this.type = problem.type;
    this.title = problem.title;
    this.detail = problem.detail;
    this.invalidParams = problem.invalid_params;

    // Mantém prototype chain correto em TypeScript transpilado
    Object.setPrototypeOf(this, ProblemDetailsError.prototype);
  }
}
