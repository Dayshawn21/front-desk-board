import { type ReactNode, useId } from 'react'

type Option<T extends string> = { value: T; label: ReactNode }

type SegmentedProps<T extends string> = {
  legend: string
  hideLegend?: boolean // when the options name themselves ("Chair 1")
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  columns?: number // options per row (default: all in one row)
}

// A row of options where exactly one is picked (theme, chair, column).
// Native radios in a fieldset: arrow keys move between them, Tab enters
// and leaves the group as one stop, and it reads as "<legend>, radio
// group" with the current choice checked. No ARIA needed.
export function Segmented<T extends string>({
  legend,
  hideLegend,
  options,
  value,
  onChange,
  size = 'md',
  columns = options.length,
}: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset>
      <legend
        className={
          hideLegend ? 'sr-only' : 'mb-2 text-xs font-semibold text-slate-700'
        }
      >
        {legend}
      </legend>
      <div
        className="grid gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 font-medium text-slate-700 has-checked:bg-teal-700 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal-600 ${size === 'sm' ? 'h-9 text-xs' : 'h-11 text-sm'}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
