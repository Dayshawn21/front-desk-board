// Error logging. STUB: filled in by the next commit.

export type ErrorReport = {
  name: string
  message: string
  where: string
  componentStack?: string
  time: string
}

export const LOG_PREFIX = '[front-desk-board] error'

export function toErrorReport(
  error: unknown,
  where: string,
  componentStack?: string,
): ErrorReport {
  void error
  void componentStack
  return { name: '', message: '', where, time: '' }
}

export function logError(
  error: unknown,
  where: string,
  componentStack?: string,
): void {
  void error
  void where
  void componentStack
}

export function installGlobalErrorLogging(target: Window = window): () => void {
  void target
  return () => {}
}
