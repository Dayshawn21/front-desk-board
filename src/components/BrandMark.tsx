// The product's mark: a tooth outline in a rounded teal tile. Decorative
// (the product name always sits next to it), so it's hidden from screen
// readers.
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-xl bg-teal-700 text-white"
      style={{ width: size, height: size }}
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.5 3.5C5 3.5 3.5 5.4 3.5 7.6c0 1.9.8 3.2 1.4 4.8.6 1.7.8 3.5 1.1 5.4.3 1.7.9 2.7 1.8 2.7 1.2 0 1.5-1.7 1.9-3.3.4-1.4.9-2.6 2.3-2.6s1.9 1.2 2.3 2.6c.4 1.6.7 3.3 1.9 3.3.9 0 1.5-1 1.8-2.7.3-1.9.5-3.7 1.1-5.4.6-1.6 1.4-2.9 1.4-4.8 0-2.2-1.5-4.1-4-4.1-1.8 0-2.6 1-4.5 1s-2.7-1-4.5-1Z" />
      </svg>
    </span>
  )
}
