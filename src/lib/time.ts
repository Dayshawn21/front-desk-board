// Times are practice wall-clock strings like "2026-11-17T09:15:00".
// We read the HH:MM directly instead of using Date, so results are the
// same in every timezone (your laptop in Houston, CI in UTC, a reviewer anywhere).

export function toMinutes(value: string): number {
  const time = value.includes('T') ? value.slice(value.indexOf('T') + 1) : value
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time: ${value}`)
  }
  return hours * 60 + minutes
}

export function formatTime(value: string | number): string {
  const total = typeof value === 'number' ? value : toMinutes(value)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const suffix = hours < 12 ? 'AM' : 'PM'
  const hour12 = ((hours + 11) % 12) + 1
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}
