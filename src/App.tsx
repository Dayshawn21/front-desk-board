import { Board } from './components/Board'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SignInPage } from './components/SignInPage'
import { useLiveScheduleUpdates } from './hooks/useSchedule'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './session/SessionContext'

// Signed out: the sign-in page. Signed in: the board, keyed by user so a
// new sign-in starts with fresh screen state (no drawer or toast left over).
// A crash anywhere in the board shows a recoverable message (and is logged)
// instead of a blank page.
function App() {
  const { user, signOut } = useAuth()
  // Here, not in the menu, so "System" keeps following the device even on
  // the sign-in page.
  const [theme, setTheme] = useTheme()
  // Changes made in other tabs show up here without a reload.
  useLiveScheduleUpdates()
  return user ? (
    <ErrorBoundary key={user.id} where="board" onSignOut={signOut}>
      <Board theme={theme} onThemeChange={setTheme} />
    </ErrorBoundary>
  ) : (
    <SignInPage />
  )
}

export default App
