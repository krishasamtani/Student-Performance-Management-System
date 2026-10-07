import StatCard from '../components/StatCard'
import SubjectChart from '../components/SubjectChart'
import TopPerformers from '../components/TopPerformers'

export default function Dashboard({ summary, onReport }) {
  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>How your students are doing at a glance.</p>
      </div>
      <div className="grid-stats">
        <StatCard label="Total students" value={summary.students} />
        <StatCard label="Average score" value={summary.average_score} unit="/ 100" tone="blue" />
        <StatCard label="Average attendance" value={summary.average_attendance} unit="%" tone="amber" />
      </div>
      <div className="grid-2">
        <SubjectChart subjects={summary.subjects} />
        <TopPerformers top={summary.top} onOpen={onReport} />
      </div>
    </>
  )
}
