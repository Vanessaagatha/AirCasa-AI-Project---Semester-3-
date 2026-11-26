import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Check, Copy, Crown, Info, LogOut, MessageSquare, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import type { HouseholdRole } from '@/types'
import { Avatar } from '@/components/Avatar'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, Select } from '@/components/ui'
import { ROLE_DESCRIPTION, ROLE_LABEL, useHousehold } from '@/context/HouseholdContext'
import { useAuth } from '@/context/AuthContext'
import { useRooms } from '@/context/RoomsContext'
import { fmtDateTime, fmtRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'rooms' | 'people' | 'comments'

export default function HouseholdPage() {
  const h = useHousehold()
  const { user, allUsers } = useAuth()
  const { rooms, selectRoom } = useRooms()
  const navigate = useNavigate()
  const isOwner = h.role === 'owner'
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(h.household.name)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<HouseholdRole>('editor')
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; text: string; code?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const users = useMemo(() => allUsers(), [allUsers])
  const colorFor = useMemo(() => {
    const map = new Map(users.map((u) => [u.email, u.avatarColor]))
    return (email: string) => map.get(email) ?? '#73858d'
  }, [users])
  const actorColor = (id: string | null, name: string) =>
    (users.find((u) => u.id === id) ?? users.find((u) => u.name === name))?.avatarColor ?? '#73858d'

  const onlineIds = new Set(h.presence.map((p) => p.userId))
  const owners = h.household.members.filter((m) => m.role === 'owner' && m.status === 'active')
  const active = h.household.members.filter((m) => m.status === 'active')
  const pending = h.household.members.filter((m) => m.status === 'pending')

  const sendInvite = (e: FormEvent) => {
    e.preventDefault()
    const r = h.invite(inviteEmail, inviteName, inviteRole)
    if (r.ok) {
      setInviteResult({ ok: true, text: `Invitation created for ${inviteEmail.trim()}.`, code: r.code })
      setInviteEmail('')
      setInviteName('')
    } else setInviteResult({ ok: false, text: r.error })
  }

  const activity = h.activity.filter((a) => {
    if (filter === 'all') return true
    if (filter === 'comments') return a.action.startsWith('commented')
    if (filter === 'people') return /invited|role|removed|joined|left|cancelled|household/.test(a.action)
    return /created|updated|deleted|duplicated|imported|added/.test(a.action)
  })

  return (
    <div>
      <PageHeader
        title="Household"
        description="People who share this home in CoolNest. Members see the same rooms, comments and activity."
        actions={
          h.role && h.role !== 'owner' ? (
            <Button
              size="sm"
              variant="danger"
              icon={<LogOut className="size-3.5" />}
              onClick={() => {
                if (window.confirm(`Leave ${h.household.name}? You will lose access to its rooms.`)) {
                  h.leaveHousehold()
                  navigate('/app')
                }
              }}
            >
              Leave household
            </Button>
          ) : undefined
        }
      />

      {/* Household banner */}
      <Card className="relative mb-6 overflow-hidden p-6">
        <svg className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-96 text-breeze-200 opacity-30" viewBox="0 0 400 160" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M0 ${40 + i * 28} C 80 ${20 + i * 28}, 160 ${70 + i * 28}, 240 ${40 + i * 28} S 360 ${20 + i * 28}, 420 ${48 + i * 28}`} fill="none" stroke="currentColor" strokeWidth="2" />
          ))}
        </svg>
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {editingName ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (name.trim()) h.renameHousehold(name.trim())
                  setEditingName(false)
                }}
              >
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-64" autoFocus aria-label="Household name" />
                <Button type="submit" size="sm" variant="primary">
                  Save
                </Button>
              </form>
            ) : (
              <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em]">
                {h.household.name}
                {isOwner && (
                  <button onClick={() => setEditingName(true)} className="rounded-lg p-1 text-ink-muted hover:bg-breeze-50 hover:text-ink" aria-label="Rename household">
                    <Pencil className="size-4" />
                  </button>
                )}
              </h2>
            )}
            <p className="mt-1 text-[13px] text-ink-muted">Created {fmtDateTime(h.household.createdAt)}</p>
            <div className="mt-4 flex -space-x-2">
              {active.map((m) => (
                <Avatar key={m.email} name={m.name} color={colorFor(m.email)} size="sm" ring />
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-4 gap-6 text-center sm:text-right">
            {[
              ['Members', active.length],
              ['Invited', pending.length],
              ['Rooms', rooms.length],
              ['Comments', h.comments.length],
            ].map(([k, v]) => (
              <div key={k}>
                <dd className="tabular text-2xl font-semibold">{v}</dd>
                <dt className="text-xs text-ink-muted">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          {/* Members */}
          <Card>
            <CardHeader title="Members" description="Roles decide who can edit rooms and manage the household." icon={<Users className="size-4" />} />
            <ul className="divide-y divide-line px-5 pb-2">
              {h.household.members.map((m) => {
                const isMe = m.email === user?.email
                const lastOwner = m.role === 'owner' && owners.length <= 1
                return (
                  <li key={m.email} className="flex flex-wrap items-center gap-3 py-3.5">
                    <span className="relative">
                      <Avatar name={m.name} color={colorFor(m.email)} size="md" className={m.status === 'pending' ? 'opacity-50' : ''} />
                      {m.userId && onlineIds.has(m.userId) && <span className="absolute right-0 bottom-0 size-3 rounded-full bg-[#3fae6a] ring-2 ring-surface" title="Online now" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {m.name}
                        {isMe && <Badge>You</Badge>}
                        {m.status === 'pending' && <Badge tone="ochre">Invite pending</Badge>}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {m.email}
                        {m.status === 'pending' ? `, invited ${fmtRelative(m.invitedAt)}` : m.joinedAt ? `, joined ${fmtRelative(m.joinedAt)}` : ''}
                      </p>
                      {m.status === 'pending' && isOwner && (
                        <p className="mt-1 text-xs text-ink-muted">
                          Invite code <span className="font-mono font-medium text-ink">{h.inviteCode(m.email)}</span>
                        </p>
                      )}
                    </div>
                    {isOwner && !isMe && !lastOwner ? (
                      <div className="flex items-center gap-1.5">
                        <Select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => h.changeRole(m.email, e.target.value as HouseholdRole)} className="h-9 w-28 text-[13px]">
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={m.status === 'pending' ? `Cancel invite for ${m.name}` : `Remove ${m.name}`}
                          onClick={() => window.confirm(m.status === 'pending' ? `Cancel the invite for ${m.name}?` : `Remove ${m.name} from the household?`) && h.removeMember(m.email)}
                        >
                          <Trash2 className="size-3.5 text-clay-700" />
                        </Button>
                      </div>
                    ) : (
                      <Badge tone={m.role === 'owner' ? 'sage' : 'neutral'} icon={m.role === 'owner' ? <Crown className="size-3" /> : undefined}>
                        {ROLE_LABEL[m.role]}
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* Invite */}
          <Card>
            <CardHeader title="Invite someone" description={isOwner ? 'Add a family member or housemate.' : 'Only owners can invite people.'} icon={<UserPlus className="size-4" />} />
            <form onSubmit={sendInvite} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_130px_auto] sm:items-end">
              <Field label="Name" htmlFor="inv-name">
                <Input id="inv-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} disabled={!isOwner} placeholder="Optional" />
              </Field>
              <Field label="Email" htmlFor="inv-email">
                <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={!isOwner} placeholder="name@example.com" />
              </Field>
              <Field label="Role" htmlFor="inv-role">
                <Select id="inv-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as HouseholdRole)} disabled={!isOwner}>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                  <option value="owner">Owner</option>
                </Select>
              </Field>
              <Button type="submit" variant="primary" disabled={!isOwner || !inviteEmail.trim()} icon={<UserPlus className="size-4" />}>
                Invite
              </Button>
            </form>
            {inviteResult && (
              <div className={cn('mx-5 mb-5 rounded-xl border p-3 text-[13px]', inviteResult.ok ? 'border-breeze-200 bg-breeze-50 text-breeze-700' : 'border-clay-100 bg-clay-50 text-clay-700')}>
                <p>{inviteResult.text}</p>
                {inviteResult.code && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-surface px-2.5 py-1 font-mono text-sm font-semibold text-ink ring-1 ring-line">{inviteResult.code}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      onClick={() => {
                        void navigator.clipboard?.writeText(inviteResult.code!).then(() => {
                          setCopied(true)
                          setTimeout(() => setCopied(false), 1500)
                        })
                      }}
                    >
                      {copied ? 'Copied' : 'Copy code'}
                    </Button>
                    <span className="text-xs">Share it with them; they create an account with the invited email.</span>
                  </div>
                )}
              </div>
            )}
            <p className="flex gap-2 border-t border-line px-5 py-3 text-xs leading-5 text-ink-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              No email is sent in this prototype. Invites and accounts live in this browser, so collaboration works between tabs and windows on
              this device. Syncing across devices needs the backend.
            </p>
          </Card>

          <Card>
            <CardHeader title="What each role can do" />
            <ul className="grid gap-3 p-5 sm:grid-cols-3">
              {(['owner', 'editor', 'viewer'] as HouseholdRole[]).map((r) => (
                <li key={r} className={cn('rounded-xl border p-3', h.role === r ? 'border-breeze-300 bg-breeze-50' : 'border-line')}>
                  <p className="text-[13px] font-semibold">
                    {ROLE_LABEL[r]}
                    {h.role === r && <span className="ml-1.5 text-xs font-normal text-breeze-700">(you)</span>}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">{ROLE_DESCRIPTION[r]}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Activity */}
          <Card>
            <CardHeader
              title="Activity"
              icon={<Activity className="size-4" />}
              action={
                <Segmented<Filter>
                  ariaLabel="Activity filter"
                  size="sm"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'rooms', label: 'Rooms' },
                    { value: 'people', label: 'People' },
                    { value: 'comments', label: 'Comments' },
                  ]}
                />
              }
            />
            {activity.length === 0 ? (
              <EmptyState title="Nothing here yet" description="Changes to rooms and members will appear here." />
            ) : (
              <ol className="scrollbar-thin max-h-[440px] space-y-0 overflow-y-auto px-5 py-4">
                {activity.slice(0, 60).map((a, i) => (
                  <li key={a.id} className="relative flex gap-3 pb-4">
                    {i < activity.length - 1 && <span className="absolute top-7 bottom-0 left-[11px] w-px bg-line" aria-hidden />}
                    <Avatar name={a.actorName} color={actorColor(a.actorId, a.actorName)} size="xs" />
                    <div className="min-w-0 text-[13px] leading-5">
                      <p className="text-ink-soft">
                        <span className="font-medium text-ink">{a.actorName}</span> {a.action}
                        {a.target && <span className="font-medium text-ink"> {a.target}</span>}
                      </p>
                      <p className="text-[11px] text-ink-muted">{fmtRelative(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Recent comments */}
          <Card>
            <CardHeader title="Recent room comments" icon={<MessageSquare className="size-4" />} />
            <ul className="space-y-3 p-5 pt-4">
              {[...h.comments]
                .reverse()
                .slice(0, 5)
                .map((c) => {
                  const room = rooms.find((r) => r.id === c.roomId)
                  return (
                    <li key={c.id} className="flex gap-3">
                      <Avatar name={c.authorName} color={c.authorColor} size="xs" />
                      <div className="min-w-0 text-[13px]">
                        <p className="text-ink-soft">
                          <span className="font-medium text-ink">{c.authorName}</span> on{' '}
                          {room ? (
                            <Link
                              to="/app/rooms"
                              onClick={() => selectRoom(room.id)}
                              className="font-medium text-breeze-700 hover:underline"
                            >
                              {room.name}
                            </Link>
                          ) : (
                            'a deleted room'
                          )}
                        </p>
                        <p className="line-clamp-2 text-ink-muted">{c.text}</p>
                      </div>
                    </li>
                  )
                })}
              {h.comments.length === 0 && <p className="text-[13px] text-ink-muted">No comments yet. Open a room’s Comments tab to start a discussion.</p>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
