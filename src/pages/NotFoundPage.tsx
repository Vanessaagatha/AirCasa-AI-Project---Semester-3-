import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'

export default function NotFoundPage({ standalone }: { standalone?: boolean }) {
  const content = (
    <EmptyState
      icon={<MapPin className="size-5" />}
      title="This page does not exist"
      description="The link may be out of date. Head back to the dashboard to continue."
      action={
        <Link to="/app">
          <Button variant="primary">Go to dashboard</Button>
        </Link>
      }
    />
  )
  return standalone ? <div className="grid min-h-screen place-items-center">{content}</div> : content
}
