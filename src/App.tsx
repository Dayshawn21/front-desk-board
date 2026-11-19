import { Board } from './components/Board'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SignInPage } from './components/SignInPage'
import { BookVisitPage } from './components/patient/BookVisitPage'
import { CheckInPage } from './components/patient/CheckInPage'
import { ChoosePracticePage } from './components/patient/ChoosePracticePage'
import { PatientHomePage } from './components/patient/PatientHomePage'
import { PatientSignUpPage } from './components/patient/PatientSignUpPage'
import {
  DemoInboxPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from './components/patient/PasswordResetPages'
import { useLiveScheduleUpdates } from './hooks/useSchedule'
import { useTheme } from './hooks/useTheme'
import { parseRoute } from './lib/route'
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

  // Patient pages are public: no staff sign-in.
  const route = parseRoute(window.location.pathname)
  if (route.page === 'choose-practice') {
    return (
      <ErrorBoundary where="choose-practice">
        <ChoosePracticePage />
      </ErrorBoundary>
    )
  }
  if (route.page === 'patient-forgot-password') {
    return (
      <ErrorBoundary where="patient-forgot-password">
        <ForgotPasswordPage />
      </ErrorBoundary>
    )
  }
  if (route.page === 'patient-reset-password') {
    return (
      <ErrorBoundary where="patient-reset-password">
        <ResetPasswordPage />
      </ErrorBoundary>
    )
  }
  if (route.page === 'patient-demo-inbox') {
    return (
      <ErrorBoundary where="patient-demo-inbox">
        <DemoInboxPage />
      </ErrorBoundary>
    )
  }
  if (route.page === 'patient-sign-up') {
    return (
      <ErrorBoundary where="patient-sign-up">
        <PatientSignUpPage />
      </ErrorBoundary>
    )
  }
  if (route.page === 'patient-home') {
    return (
      <ErrorBoundary where="patient-home">
        <PatientHomePage />
      </ErrorBoundary>
    )
  }
  if (route.page === 'book') {
    return (
      <ErrorBoundary where="book">
        <BookVisitPage key={route.practiceId} practiceId={route.practiceId} />
      </ErrorBoundary>
    )
  }

  if (route.page === 'check-in') {
    return (
      <ErrorBoundary where="check-in">
        <CheckInPage
          key={`${route.practiceId}/${route.visitId}`}
          practiceId={route.practiceId}
          visitId={route.visitId}
        />
      </ErrorBoundary>
    )
  }

  return user ? (
    <ErrorBoundary key={user.id} where="board" onSignOut={signOut}>
      <Board theme={theme} onThemeChange={setTheme} />
    </ErrorBoundary>
  ) : (
    <SignInPage />
  )
}

export default App
