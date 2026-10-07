export default function GradeBadge({ grade }) {
  const key = !grade || grade === '-' ? 'none' : grade.replace('+', 'p')
  return <span className={`grade grade-${key}`}>{grade || '-'}</span>
}
