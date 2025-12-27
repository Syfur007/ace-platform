export type EliteCoinsInputs = {
  streakDays: number
  completedMockExams: number
  correctRatePercent: number
}

export function getEliteCoinsSummary(inputs: EliteCoinsInputs) {
  const streak = Math.max(0, Math.floor(inputs.streakDays))
  const exams = Math.max(0, Math.floor(inputs.completedMockExams))
  const accuracy = Math.max(0, Math.min(100, inputs.correctRatePercent))

  const streakCoins = Math.min(30, streak) * 2
  const examCoins = exams * 25
  const accuracyCoins = Math.round((accuracy / 100) * 20)

  const total = streakCoins + examCoins + accuracyCoins

  return {
    total,
    breakdown: {
      streakCoins,
      examCoins,
      accuracyCoins,
    },
  }
}
