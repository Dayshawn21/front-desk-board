// The "now" marker is a pill centred on the now line, over the time axis.
// A half-hour label sits at the top of its row, so when "now" is from just
// before a label to a little after it, the pill covers the label. Then the
// label is hidden: the pill already says the exact time.
//
// In minutes, at the board's scale (32 px for 15 minutes): the pill is about
// 18 px tall and the label about 16 px, starting 2 px into its row.
const BEFORE = 3 // minutes before the label that the pill reaches it
const AFTER = 12 // minutes after the label that the pill still covers it

export function labelCoveredByNow(
  labelMinutes: number,
  nowMinutes: number,
): boolean {
  return (
    nowMinutes >= labelMinutes - BEFORE && nowMinutes <= labelMinutes + AFTER
  )
}
