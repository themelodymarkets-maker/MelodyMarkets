/**
 * Merges class name fragments, skipping any falsy values.
 * A lightweight stand-in for libraries like `clsx` so components can
 * conditionally compose Tailwind classes without an extra dependency.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
