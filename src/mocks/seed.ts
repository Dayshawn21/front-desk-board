import type {
  Appointment,
  Chair,
  CheckInChecklist,
  Patient,
  Practice,
} from '../types'

// FAKE DATA ONLY. Names are invented. Phone numbers use 555-01xx,
// a range reserved for fictional use.

import { DEMO_DATE } from '../config.ts'

export const practices: Practice[] = [
  {
    id: 'maple',
    name: 'Maple Street Dental',
    openTime: '08:00',
    closeTime: '17:00',
  },
  {
    id: 'riverbend',
    name: 'Riverbend Family Dental',
    openTime: '07:30',
    closeTime: '16:00',
  },
]

export const chairs: Chair[] = [
  {
    id: 'maple-c1',
    practiceId: 'maple',
    name: 'Chair 1',
    provider: 'Dr. Okafor',
  },
  {
    id: 'maple-c2',
    practiceId: 'maple',
    name: 'Chair 2',
    provider: 'Hygienist Patel',
  },
  {
    id: 'maple-c3',
    practiceId: 'maple',
    name: 'Chair 3',
    provider: 'Dr. Lindqvist',
  },
  {
    id: 'river-c1',
    practiceId: 'riverbend',
    name: 'Chair 1',
    provider: 'Dr. Haddad',
  },
  {
    id: 'river-c2',
    practiceId: 'riverbend',
    name: 'Chair 2',
    provider: 'Hygienist Moreau',
  },
]

let phoneSeq = 0
function patient(
  id: string,
  practiceId: string,
  firstName: string,
  lastName: string,
  insuranceProvider: string | null,
): Patient {
  phoneSeq += 1
  const phone = `555-01${String(phoneSeq).padStart(2, '0')}`
  return { id, practiceId, firstName, lastName, phone, insuranceProvider }
}

export const patients: Patient[] = [
  // Maple Street
  patient('p-ana', 'maple', 'Ana', 'Diaz', 'Bluebird Dental'),
  patient('p-marcus', 'maple', 'Marcus', 'Bell', 'Acme Dental PPO'),
  patient('p-grace', 'maple', 'Grace', 'Liu', 'Acme Dental PPO'),
  patient('p-owen', 'maple', 'Owen', 'Hart', null),
  patient('p-priya', 'maple', 'Priya', 'Shah', 'Bluebird Dental'),
  patient('p-jon', 'maple', 'Jon', 'Kim', 'Acme Dental PPO'),
  patient('p-lena', 'maple', 'Lena', 'Ortiz', null),
  patient('p-sam', 'maple', 'Sam', 'Whitfield', 'Bluebird Dental'),
  patient('p-tomas', 'maple', 'Tomás', 'Reyes', 'Acme Dental PPO'),
  patient('p-nia', 'maple', 'Nia', 'Brooks', null),
  patient('p-ravi', 'maple', 'Ravi', 'Menon', 'Bluebird Dental'),
  patient('p-jade', 'maple', 'Jade', 'Ellis', 'Acme Dental PPO'),
  patient('p-elena', 'maple', 'Elena', 'Park', 'Bluebird Dental'),
  patient('p-dev', 'maple', 'Dev', 'Coleman', 'Acme Dental PPO'),
  patient('p-marta', 'maple', 'Marta', 'Silva', null),
  // Riverbend
  patient('p-hana', 'riverbend', 'Hana', 'Sato', 'Bluebird Dental'),
  patient('p-luis', 'riverbend', 'Luis', 'Moreno', 'Acme Dental PPO'),
  patient('p-beth', 'riverbend', 'Beth', 'Carver', null),
  patient('p-kofi', 'riverbend', 'Kofi', 'Mensah', 'Bluebird Dental'),
  patient('p-iris', 'riverbend', 'Iris', 'Novak', 'Acme Dental PPO'),
]

function checklist(done: Partial<CheckInChecklist> = {}): CheckInChecklist {
  return {
    insuranceVerified: false,
    formsComplete: false,
    medicalHistoryReviewed: false,
    copayCollected: false,
    ...done,
  }
}

const ALL_DONE = checklist({
  insuranceVerified: true,
  formsComplete: true,
  medicalHistoryReviewed: true,
  copayCollected: true,
})

// Seed rows use "HH:MM" for readability; appt() converts them to ISO strings.
type SeedRow = Omit<Appointment, 'start' | 'end' | 'checklist' | 'notes'> & {
  from: string
  to: string
  checklist?: CheckInChecklist
  notes?: string
}

function at(time: string): string {
  return `${DEMO_DATE}T${time.padStart(5, '0')}:00`
}

function appt({
  from,
  to,
  checklist: cl,
  notes,
  ...rest
}: SeedRow): Appointment {
  return {
    ...rest,
    start: at(from),
    end: at(to),
    checklist: cl ?? checklist(),
    notes: notes ?? '',
  }
}

export const appointments: Appointment[] = [
  // ── Maple Street: 15 visits. "Now" in the demo is about 9:40. ──
  appt({
    id: 'a-01',
    practiceId: 'maple',
    patientId: 'p-ana',
    chairId: 'maple-c1',
    from: '8:00',
    to: '8:45',
    type: 'cleaning',
    status: 'completed',
    checklist: ALL_DONE,
  }),
  appt({
    id: 'a-02',
    practiceId: 'maple',
    patientId: 'p-marcus',
    chairId: 'maple-c1',
    from: '9:00',
    to: '10:30',
    type: 'crown',
    status: 'in-chair',
    checklist: ALL_DONE,
  }),
  appt({
    id: 'a-03',
    practiceId: 'maple',
    patientId: 'p-grace',
    chairId: 'maple-c1',
    from: '10:30',
    to: '11:00',
    type: 'exam',
    status: 'confirmed',
    checklist: checklist({ formsComplete: true }),
  }),
  appt({
    id: 'a-04',
    practiceId: 'maple',
    patientId: 'p-owen',
    chairId: 'maple-c1',
    from: '11:15',
    to: '12:00',
    type: 'filling',
    status: 'scheduled',
    notes: 'No insurance on file. Confirm self-pay.',
  }),
  appt({
    id: 'a-05',
    practiceId: 'maple',
    patientId: 'p-priya',
    chairId: 'maple-c2',
    from: '8:00',
    to: '9:00',
    type: 'cleaning',
    status: 'completed',
    checklist: ALL_DONE,
  }),
  // Deliberate overlap: a-06 and a-07 share Chair 2 from 9:45 to 10:00.
  appt({
    id: 'a-06',
    practiceId: 'maple',
    patientId: 'p-jon',
    chairId: 'maple-c2',
    from: '9:15',
    to: '10:00',
    type: 'filling',
    status: 'arrived',
    checklist: checklist({ insuranceVerified: true, formsComplete: true }),
    notes: 'Asked to confirm copay amount before visit.',
  }),
  appt({
    id: 'a-07',
    practiceId: 'maple',
    patientId: 'p-lena',
    chairId: 'maple-c2',
    from: '9:45',
    to: '10:30',
    type: 'exam',
    status: 'confirmed',
    checklist: checklist({ formsComplete: true, medicalHistoryReviewed: true }),
  }),
  appt({
    id: 'a-08',
    practiceId: 'maple',
    patientId: 'p-sam',
    chairId: 'maple-c2',
    from: '10:30',
    to: '11:30',
    type: 'cleaning',
    status: 'scheduled',
  }),
  appt({
    id: 'a-09',
    practiceId: 'maple',
    patientId: 'p-tomas',
    chairId: 'maple-c3',
    from: '8:30',
    to: '9:15',
    type: 'consult',
    status: 'completed',
    checklist: ALL_DONE,
  }),
  appt({
    id: 'a-10',
    practiceId: 'maple',
    patientId: 'p-nia',
    chairId: 'maple-c3',
    from: '9:30',
    to: '10:00',
    type: 'emergency',
    status: 'in-chair',
    checklist: checklist({
      formsComplete: true,
      medicalHistoryReviewed: true,
      copayCollected: true,
    }),
  }),
  appt({
    id: 'a-11',
    practiceId: 'maple',
    patientId: 'p-ravi',
    chairId: 'maple-c3',
    from: '10:15',
    to: '11:00',
    type: 'cleaning',
    status: 'scheduled',
    checklist: checklist({ insuranceVerified: true }),
  }),
  appt({
    id: 'a-12',
    practiceId: 'maple',
    patientId: 'p-jade',
    chairId: 'maple-c3',
    from: '11:00',
    to: '11:45',
    type: 'exam',
    status: 'confirmed',
  }),
  appt({
    id: 'a-13',
    practiceId: 'maple',
    patientId: 'p-elena',
    chairId: 'maple-c1',
    from: '13:00',
    to: '13:45',
    type: 'cleaning',
    status: 'scheduled',
  }),
  appt({
    id: 'a-14',
    practiceId: 'maple',
    patientId: 'p-dev',
    chairId: 'maple-c3',
    from: '13:30',
    to: '15:00',
    type: 'crown',
    status: 'confirmed',
    checklist: checklist({ insuranceVerified: true, formsComplete: true }),
  }),
  appt({
    id: 'a-15',
    practiceId: 'maple',
    patientId: 'p-marta',
    chairId: 'maple-c2',
    from: '14:00',
    to: '15:00',
    type: 'cleaning',
    status: 'scheduled',
  }),

  // ── Riverbend: 5 visits, no conflicts ──
  appt({
    id: 'a-16',
    practiceId: 'riverbend',
    patientId: 'p-hana',
    chairId: 'river-c1',
    from: '7:30',
    to: '8:15',
    type: 'cleaning',
    status: 'completed',
    checklist: ALL_DONE,
  }),
  appt({
    id: 'a-17',
    practiceId: 'riverbend',
    patientId: 'p-luis',
    chairId: 'river-c1',
    from: '8:30',
    to: '9:30',
    type: 'filling',
    status: 'in-chair',
    checklist: ALL_DONE,
  }),
  appt({
    id: 'a-18',
    practiceId: 'riverbend',
    patientId: 'p-beth',
    chairId: 'river-c2',
    from: '9:00',
    to: '9:45',
    type: 'exam',
    status: 'arrived',
    checklist: checklist({ formsComplete: true }),
  }),
  appt({
    id: 'a-19',
    practiceId: 'riverbend',
    patientId: 'p-kofi',
    chairId: 'river-c2',
    from: '10:00',
    to: '10:45',
    type: 'cleaning',
    status: 'confirmed',
  }),
  appt({
    id: 'a-20',
    practiceId: 'riverbend',
    patientId: 'p-iris',
    chairId: 'river-c1',
    from: '11:00',
    to: '12:00',
    type: 'consult',
    status: 'scheduled',
  }),
]
