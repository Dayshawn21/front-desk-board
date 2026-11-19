// Error logging. Today it writes one structured line to the console; in a
// real deployment this is the one place to send it to an error service
// (Sentry, Datadog, …) instead.
//
// What a report holds is deliberately small: the error's name and message,
// where it happened, the React component stack, and the time. Never props,
// state, form values, or the URL query: in a dental office those can hold
// patient details, and logs get copied to places patient data must not go.

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
  const isError = error instanceof Error
  return {
    name: isError ? error.name : 'Unknown',
    message: isError ? error.message : String(error),
    where,
    ...(componentStack ? { componentStack } : {}),
    time: new Date().toISOString(),
  }
}

export function logError(
  error: unknown,
  where: string,
  componentStack?: string,
): void {
  console.error(LOG_PREFIX, toErrorReport(error, where, componentStack))
}

// Error boundaries only catch errors thrown while rendering. Errors in event
// handlers, timers, and rejected promises skip them, so log those here.
// Returns a function that removes the listeners.
export function installGlobalErrorLogging(target: Window = window): () => void {
  const onError = (event: ErrorEvent) =>
    logError(event.error ?? event.message, 'window')
  const onRejection = (event: PromiseRejectionEvent) =>
    logError(event.reason, 'promise')
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
