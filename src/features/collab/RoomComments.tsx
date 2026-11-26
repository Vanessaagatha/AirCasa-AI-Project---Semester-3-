import { useState } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { useHousehold } from '@/context/HouseholdContext'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/Avatar'
import { Button, EmptyState } from '@/components/ui'
import { fmtRelative } from '@/lib/format'

/** Household discussion thread for one room. Synced live across open tabs. */
export function RoomComments({ roomId, roomName }: { roomId: string; roomName: string }) {
  const { comments, addComment, deleteComment, can, log, role } = useHousehold()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const thread = comments.filter((c) => c.roomId === roomId)

  const submit = () => {
    if (!text.trim()) return
    addComment(roomId, text)
    log('commented on', roomName)
    setText('')
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {thread.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-5" />}
          title="No comments yet"
          description="Use comments to agree on changes with your household, like adding curtains or moving the fan."
        />
      ) : (
        <ol className="space-y-3">
          {thread.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorName} color={c.authorColor} size="sm" />
              <div className="min-w-0 flex-1 rounded-xl bg-canvas px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold">{c.authorName}</p>
                  <span className="text-[11px] text-ink-muted">{fmtRelative(c.at)}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-5 whitespace-pre-wrap text-ink-soft">{c.text}</p>
                {(c.authorId === user?.id || role === 'owner') && (
                  <button onClick={() => deleteComment(c.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-clay-700">
                    <Trash2 className="size-3" /> Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {can('comment') && (
        <div className="mt-auto space-y-2 border-t border-line pt-4">
          <label htmlFor={`comment-${roomId}`} className="text-[13px] font-medium text-ink-soft">
            Add a comment
          </label>
          <textarea
            id={`comment-${roomId}`}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            placeholder={`Write to your household about ${roomName.toLowerCase()}`}
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-breeze-500 focus:ring-2 focus:ring-breeze-200 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">Ctrl + Enter to send</span>
            <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} disabled={!text.trim()} onClick={submit}>
              Post comment
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
