import type { Appointment } from '../types'
import { toMinutes } from './time'

export type LanePosition = { lane: number; laneCount: number }

// Side-by-side layout for overlapping visits in the same chair.
// Visits that overlap, directly or through a chain, form a cluster.
// Each visit takes the first free lane; the whole cluster shares one lane count.
export function assignLanes(
  appointments: Appointment[],
): Map<string, LanePosition> {
  const result = new Map<string, LanePosition>()

  const byChair = new Map<string, Appointment[]>()
  for (const appt of appointments) {
    const list = byChair.get(appt.chairId) ?? []
    list.push(appt)
    byChair.set(appt.chairId, list)
  }

  for (const list of byChair.values()) {
    const sorted = [...list].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start),
    )
    let cluster: { id: string; lane: number }[] = []
    let laneEnds: number[] = [] // end time of the last visit in each lane
    let clusterEnd = -Infinity

    const flush = () => {
      for (const item of cluster) {
        result.set(item.id, { lane: item.lane, laneCount: laneEnds.length })
      }
      cluster = []
      laneEnds = []
    }

    for (const appt of sorted) {
      const start = toMinutes(appt.start)
      const end = toMinutes(appt.end)

      if (start >= clusterEnd) {
        flush() // nothing in the current cluster reaches this visit: start a new one
        clusterEnd = -Infinity
      }

      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(end)
      } else {
        laneEnds[lane] = end
      }

      cluster.push({ id: appt.id, lane })
      clusterEnd = Math.max(clusterEnd, end)
    }
    flush()
  }

  return result
}
