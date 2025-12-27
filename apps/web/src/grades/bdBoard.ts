export function bdGpaFromPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent))

  if (p >= 80) return 5.0
  if (p >= 70) return 4.0
  if (p >= 60) return 3.5
  if (p >= 50) return 3.0
  if (p >= 40) return 2.0
  if (p >= 33) return 1.0
  return 0.0
}
