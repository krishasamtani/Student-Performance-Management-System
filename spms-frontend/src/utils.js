export const EXAMS = ['Unit test', 'Mid-term', 'Final']

export function gradeFor(score) {
  if (score == null) return '-'
  for (const [cutoff, letter] of [[90, 'A+'], [80, 'A'], [70, 'B'], [60, 'C'], [50, 'D']]) {
    if (score >= cutoff) return letter
  }
  return 'F'
}
