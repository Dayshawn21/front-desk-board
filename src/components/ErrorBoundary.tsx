import { Component, createRef, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../lib/logError'

type Props = {
  where: string // goes into the log, e.g. "board"
  onSignOut?: () => void // a way out if Try again keeps failing
  children: ReactNode
}

type State = { error: Error | null }

// Catches errors thrown while rendering anything inside it, logs them, and
// shows a recoverable message instead of a blank page. React only supports
// this as a class component (getDerivedStateFromError / componentDidCatch).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  private headingRef = createRef<HTMLHeadingElement>()

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, this.props.where, info.componentStack ?? undefined)
  }

  componentDidUpdate(_: Props, prev: State) {
    // The page just changed under the user; start them at the message.
    if (this.state.error && !prev.error) this.headingRef.current?.focus()
  }

  componentDidMount() {
    if (this.state.error) this.headingRef.current?.focus()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900">
        <div
          role="alert"
          className="flex max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h1
            ref={this.headingRef}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            Something went wrong
          </h1>
          <p className="text-sm text-slate-700">
            This screen hit an unexpected error, and it has been logged. Try
            again, or reload the page. (In this demo a reload also resets the
            fake data.)
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Try again
            </button>
            {this.props.onSignOut && (
              <button
                type="button"
                onClick={this.props.onSignOut}
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Back to sign-in
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Reload page
            </button>
          </div>
        </div>
      </main>
    )
  }
}
