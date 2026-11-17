// All data in this app is fake. No real patient or health information.

export type Role = 'front-desk' | 'provider' | 'office-manager'

export type Practice = {
  id: string
  name: string
  openTime: string // "08:00", 24h local time
  closeTime: string // "17:00"
}

export type Chair = {
  id: string
  practiceId: string
  name: string // e.g. "Chair 1"
  provider: string // fake provider name
}

export type Patient = {
  id: string
  practiceId: string
  firstName: string
  lastName: string
  phone: string // fake 555 numbers only
  insuranceProvider: string | null // null = self-pay / not on file
}

export type AppointmentType =
  'cleaning' | 'exam' | 'filling' | 'crown' | 'consult' | 'emergency'

export type AppointmentStatus =
  'scheduled' | 'confirmed' | 'arrived' | 'in-chair' | 'completed' | 'cancelled'

export type CheckInChecklist = {
  insuranceVerified: boolean
  formsComplete: boolean
  medicalHistoryReviewed: boolean
  copayCollected: boolean
}

export type Appointment = {
  id: string
  practiceId: string
  patientId: string
  chairId: string
  start: string // ISO 8601 local time, e.g. "2026-11-17T09:00:00"
  end: string // ISO 8601 local time
  type: AppointmentType
  status: AppointmentStatus
  checklist: CheckInChecklist
  notes: string
}

// What the mock API returns for one practice on one day.
export type ScheduleDay = {
  practice: Practice
  date: string // "2026-11-17"
  chairs: Chair[]
  patients: Patient[]
  appointments: Appointment[]
}
