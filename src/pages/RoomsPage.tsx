import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Box,
  Check,
  Copy,
  DoorOpen,
  Download,
  FileJson,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import type { Appliance, ApplianceType, Opening, Room, RoomType } from '@/types'
import { useHousehold } from '@/context/HouseholdContext'
import { ApplianceEditor } from '@/features/rooms/ApplianceEditor'
import { ApplianceMeshes } from '@/features/rooms/ApplianceMeshes'
import { ApplianceIcon } from '@/features/rooms/ApplianceIcon'
import { APPLIANCE_CATALOG, APPLIANCE_TYPES, createAppliance, dailyKWh, fitAppliance, totalHeatNow } from '@/features/rooms/appliances'
import { RoomComments } from '@/features/collab/RoomComments'
import { Lock } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, MeasureInput, PageHeader, Segmented, Select, Toggle } from '@/components/ui'
import { useRooms } from '@/context/RoomsContext'
import { LazyRoomViewer } from '@/features/rooms/LazyRoomViewer'
import { OpeningEditor } from '@/features/rooms/OpeningEditor'
import { OrientationPicker } from '@/features/rooms/OrientationPicker'
import {
  DIMENSION_LIMITS,
  createDoor,
  createWindow,
  findOpeningIssues,
  fitOpening,
  floorArea,
  refitRoom,
  roomVolume,
  windowArea,
} from '@/features/rooms/roomGeometry'
import { parseRoomJson, serializeRoom } from '@/features/rooms/roomSchema'
import { clamp, cn, round } from '@/lib/utils'

type Tab = 'room' | 'openings' | 'appliances' | 'comments' | 'json'

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living', label: 'Living room' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'office', label: 'Office / study' },
  { value: 'other', label: 'Other' },
]

function downloadJson(room: Room) {
  const blob = new Blob([serializeRoom(room)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${room.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'room'}.coolnest.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RoomsPage() {
  const { rooms, selectedRoom, selectRoom, addRoom, saveRoom, deleteRoom, duplicateRoom } = useRooms()
  const [draft, setDraft] = useState<Room | null>(selectedRoom)
  const [tab, setTab] = useState<Tab>('room')
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [selectedAppliance, setSelectedAppliance] = useState<string | null>(null)
  const [newApplianceType, setNewApplianceType] = useState<ApplianceType>('standing-fan')
  const { can, comments } = useHousehold()
  const canEdit = can('edit-rooms')
  const [toast, setToast] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Load the selected room into the editor whenever selection changes.
  useEffect(() => {
    setDraft(selectedRoom ? structuredClone(selectedRoom) : null)
    setSelectedOpening(null)
    setSelectedAppliance(null)
    // only when the selected room id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id])

  const dirty = useMemo(
    () => !!draft && !!selectedRoom && JSON.stringify({ ...draft, updatedAt: '' }) !== JSON.stringify({ ...selectedRoom, updatedAt: '' }),
    [draft, selectedRoom],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const issues = useMemo(() => (draft ? findOpeningIssues(draft) : []), [draft])

  const confirmLeave = () => !dirty || window.confirm('You have unsaved changes to this room. Discard them?')

  const switchRoom = (id: string) => {
    if (id === selectedRoom?.id || !confirmLeave()) return
    selectRoom(id)
  }

  const update = (patch: Partial<Room>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const updateDims = (key: 'length' | 'width' | 'height', v: number) =>
    setDraft((d) => {
      if (!d) return d
      const lim = DIMENSION_LIMITS[key]
      return refitRoom({ ...d, dimensions: { ...d.dimensions, [key]: round(clamp(v, lim.min, lim.max), 2) } })
    })

  const updateOpening = (o: Opening) =>
    setDraft((d) => {
      if (!d) return d
      return o.kind === 'window'
        ? { ...d, windows: d.windows.map((w) => (w.id === o.id ? o : w)) }
        : { ...d, doors: d.doors.map((x) => (x.id === o.id ? o : x)) }
    })

  const addOpening = (o: Opening) => {
    setDraft((d) => (d ? (o.kind === 'window' ? { ...d, windows: [...d.windows, o] } : { ...d, doors: [...d.doors, o] }) : d))
    setSelectedOpening(o.id)
    setTab('openings')
  }

  const removeOpening = (id: string) => {
    setDraft((d) => (d ? { ...d, windows: d.windows.filter((w) => w.id !== id), doors: d.doors.filter((x) => x.id !== id) } : d))
    if (selectedOpening === id) setSelectedOpening(null)
  }

  const updateAppliance = (a: Appliance) =>
    setDraft((d) => (d ? { ...d, appliances: (d.appliances ?? []).map((x) => (x.id === a.id ? a : x)) } : d))

  const addAppliance = (a: Appliance) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            appliances: [...(d.appliances ?? []), a],
            hasAirConditioner: d.hasAirConditioner || a.type === 'air-conditioner',
            hasCeilingFan: d.hasCeilingFan || a.type === 'ceiling-fan' || a.type === 'standing-fan',
          }
        : d,
    )
    setSelectedAppliance(a.id)
    setSelectedOpening(null)
    setTab('appliances')
  }

  const removeAppliance = (id: string) => {
    setDraft((d) => (d ? { ...d, appliances: (d.appliances ?? []).filter((x) => x.id !== id) } : d))
    if (selectedAppliance === id) setSelectedAppliance(null)
  }

  const onSave = () => {
    if (!draft || !canEdit) return
    if (!draft.name.trim()) {
      setToast('Give the room a name before saving.')
      return
    }
    saveRoom({ ...draft, name: draft.name.trim() })
    setToast('Room saved')
  }

  const onImportFile = async (file: File, asNew: boolean) => {
    const text = await file.text()
    const result = parseRoomJson(text)
    if (!result.ok) {
      setToast(`Import failed: ${result.errors[0]}`)
      return
    }
    if (asNew) {
      addRoom(result.room)
      setToast(`Imported “${result.room.name}”`)
    } else if (draft) {
      setDraft({ ...result.room, id: draft.id, createdAt: draft.createdAt })
      setToast('JSON loaded into the editor. Save to keep it.')
    }
  }

  if (!draft) {
    return (
      <div>
        <PageHeader title="My Rooms" description="Describe each room so CoolNest can relate readings and guidance to it." />
        <Card>
          <EmptyState
            icon={<Box className="size-5" />}
            title="No rooms yet"
            description="Create a room, then set its size, windows, doors and orientation. You can also import a room JSON file."
            action={
              <div className="flex gap-2">
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => addRoom()}>
                  New room
                </Button>
                <Button icon={<Upload className="size-4" />} onClick={() => importRef.current?.click()}>
                  Import JSON
                </Button>
              </div>
            }
          />
        </Card>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImportFile(f, true)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  const openings: Opening[] = [...draft.windows, ...draft.doors]
  const appliances = draft.appliances ?? []
  const roomComments = comments.filter((c) => c.roomId === draft.id).length
  const issueFor = (id: string) => issues.find((i) => i.openingId === id)?.message

  return (
    <div>
      <PageHeader
        title="My Rooms"
        description="Edit on the left; the 3D model follows every change. Rooms are saved in this browser."
        actions={
          <>
            <Button
              size="sm"
              icon={<ScanLine className="size-3.5" />}
              disabled
              title="Not supported in this prototype. Rooms are entered manually."
              className="disabled:opacity-70"
            >
              Import room scan
              <Badge tone="ochre" className="ml-1 px-1.5 py-0 text-[10px]">
                Not supported
              </Badge>
            </Button>
            <Button size="sm" icon={<Upload className="size-3.5" />} onClick={() => importRef.current?.click()} disabled={!canEdit}>
              Import JSON
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              disabled={!canEdit}
              onClick={() => {
                if (confirmLeave()) addRoom()
              }}
            >
              New room
            </Button>
          </>
        }
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImportFile(f, true)
          e.target.value = ''
        }}
      />

      {/* Room switcher */}
      <div className="scrollbar-thin -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Rooms">
        {rooms.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={r.id === draft.id}
            onClick={() => switchRoom(r.id)}
            className={cn(
              'shrink-0 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors',
              r.id === draft.id ? 'border-breeze-800 bg-breeze-800 text-white' : 'border-line bg-surface text-ink-soft hover:border-breeze-300',
            )}
          >
            {r.id === draft.id ? draft.name || 'Untitled room' : r.name}
            {r.id === draft.id && dirty && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-ochre-300 align-middle" />}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(340px,420px)_1fr]">
        {/* Editor panel */}
        <Card className="flex flex-col overflow-hidden lg:h-[calc(100vh-16rem)] lg:min-h-[540px]">
          <div className="scrollbar-thin overflow-x-auto border-b border-line px-4 py-3">
            <Segmented<Tab>
              ariaLabel="Editor section"
              size="sm"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'room', label: 'Room' },
                { value: 'openings', label: `Openings ${openings.length}` },
                { value: 'appliances', label: `Appliances ${appliances.length}` },
                { value: 'comments', label: `Comments ${roomComments}` },
                { value: 'json', label: 'JSON' },
              ]}
            />
          </div>
          {!canEdit && (
            <p className="flex items-center gap-2 border-b border-line bg-mist-50 px-4 py-2 text-xs text-mist-700">
              <Lock className="size-3.5" /> You have view access to this household. Ask the owner for edit access.
            </p>
          )}

          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5">
            {tab === 'comments' && <RoomComments roomId={draft.id} roomName={draft.name} />}
            {tab === 'appliances' && (
              <fieldset disabled={!canEdit} className="space-y-4">
                <div className="flex gap-2">
                  <Select aria-label="Appliance type" value={newApplianceType} onChange={(e) => setNewApplianceType(e.target.value as ApplianceType)} className="flex-1">
                    {APPLIANCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {APPLIANCE_CATALOG[t].label}
                      </option>
                    ))}
                  </Select>
                  <Button icon={<ApplianceIcon type={newApplianceType} className="size-4" />} onClick={() => addAppliance(createAppliance(newApplianceType, draft.dimensions, appliances))}>
                    Add
                  </Button>
                </div>
                {appliances.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-xs">
                    <div>
                      <p className="text-ink-muted">Appliances</p>
                      <p className="tabular text-[15px] font-semibold">{appliances.length}</p>
                    </div>
                    <div>
                      <p className="text-ink-muted">Heat right now</p>
                      <p className="tabular text-[15px] font-semibold">{Math.round(totalHeatNow(appliances, new Date().getHours()))} W</p>
                    </div>
                    <div>
                      <p className="text-ink-muted">Energy per day</p>
                      <p className="tabular text-[15px] font-semibold">{appliances.reduce((t, a) => t + dailyKWh(a), 0).toFixed(1)} kWh</p>
                    </div>
                  </div>
                )}
                {appliances.length === 0 ? (
                  <EmptyState
                    icon={<ApplianceIcon type="other" className="size-5" />}
                    title="No appliances yet"
                    description="Appliances release heat into the room. Adding them makes the heat simulation and guidance more specific."
                  />
                ) : (
                  <div className="space-y-2">
                    {appliances.map((a) => (
                      <ApplianceEditor
                        key={a.id}
                        appliance={a}
                        room={draft}
                        disabled={!canEdit}
                        expanded={selectedAppliance === a.id}
                        onToggle={() => setSelectedAppliance((s) => (s === a.id ? null : a.id))}
                        onChange={updateAppliance}
                        onDelete={() => removeAppliance(a.id)}
                        onDuplicate={(copy) => addAppliance(fitAppliance(copy, draft.dimensions))}
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs leading-5 text-ink-muted">
                  Wattages are typical defaults; check the label on your appliance. Click an appliance in the 3D view to select it, then drag it across the floor.
                </p>
              </fieldset>
            )}
            {tab === 'room' && (
              <fieldset disabled={!canEdit} className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Field label="Room name" htmlFor="room-name">
                      <Input id="room-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Master bedroom" />
                    </Field>
                  </div>
                  <Field label="Room type" htmlFor="room-type">
                    <Select id="room-type" value={draft.type} onChange={(e) => update({ type: e.target.value as RoomType })}>
                      {ROOM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Floor level" htmlFor="room-floor">
                    <Select id="room-floor" value={draft.floorLevel} onChange={(e) => update({ floorLevel: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? 'Ground floor' : `Floor ${n}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[13px] font-semibold text-ink">Dimensions</h3>
                  <MeasureInput id="dim-length" label="Length (front and back walls)" value={draft.dimensions.length} {...DIMENSION_LIMITS.length} onChange={(v) => updateDims('length', v)} />
                  <MeasureInput id="dim-width" label="Width (left and right walls)" value={draft.dimensions.width} {...DIMENSION_LIMITS.width} onChange={(v) => updateDims('width', v)} />
                  <MeasureInput id="dim-height" label="Ceiling height" value={draft.dimensions.height} {...DIMENSION_LIMITS.height} onChange={(v) => updateDims('height', v)} />
                  <p className="tabular rounded-xl bg-canvas px-3 py-2 text-xs text-ink-muted">
                    Floor area {floorArea(draft.dimensions).toFixed(1)} m², volume {roomVolume(draft.dimensions).toFixed(1)} m³, window area{' '}
                    {windowArea(draft).toFixed(2)} m²
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[13px] font-semibold text-ink">Orientation</h3>
                  <OrientationPicker value={draft.orientation} onChange={(o) => update({ orientation: o })} />
                </div>

                <div className="space-y-3">
                  <h3 className="text-[13px] font-semibold text-ink">Cooling equipment</h3>
                  <div className="space-y-3 rounded-xl bg-canvas p-3">
                    <Toggle id="fan" label="Ceiling or standing fan" checked={draft.hasCeilingFan} onChange={(v) => update({ hasCeilingFan: v })} />
                    <Toggle id="ac" label="Air conditioner" checked={draft.hasAirConditioner} onChange={(v) => update({ hasAirConditioner: v })} />
                  </div>
                </div>

                <Field label="Notes" htmlFor="room-notes">
                  <textarea
                    id="room-notes"
                    rows={2}
                    value={draft.notes ?? ''}
                    onChange={(e) => update({ notes: e.target.value })}
                    className="w-full rounded-xl border border-line-strong px-3 py-2 text-sm focus:border-breeze-500 focus:ring-2 focus:ring-breeze-200 focus:outline-none"
                    placeholder="Anything that affects this room, such as a neighbouring wall or a tree outside."
                  />
                </Field>

                <div className="flex flex-wrap gap-2 border-t border-line pt-5">
                  <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => confirmLeave() && duplicateRoom(draft.id)}>
                    Duplicate room
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 className="size-3.5" />}
                    onClick={() => {
                      if (window.confirm(`Delete “${draft.name}”? This cannot be undone.`)) deleteRoom(draft.id)
                    }}
                  >
                    Delete room
                  </Button>
                </div>
              </fieldset>
            )}

            {tab === 'openings' && (
              <fieldset disabled={!canEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<AppWindow className="size-4" />} onClick={() => addOpening(createWindow(draft, 'front'))}>
                    Add window
                  </Button>
                  <Button icon={<DoorOpen className="size-4" />} onClick={() => addOpening(createDoor(draft, 'back'))}>
                    Add door
                  </Button>
                </div>
                {issues.length > 0 && (
                  <div className="flex gap-2 rounded-xl border border-ochre-100 bg-ochre-50 p-3 text-[13px] text-ochre-700">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      {issues.map((i) => (
                        <p key={i.openingId + i.message}>{i.message}</p>
                      ))}
                    </div>
                  </div>
                )}
                {openings.length === 0 ? (
                  <EmptyState
                    icon={<AppWindow className="size-5" />}
                    title="No windows or doors yet"
                    description="Add the openings in this room. Windows matter most for ventilation, rain and sun guidance."
                  />
                ) : (
                  <div className="space-y-2">
                    {openings.map((o) => (
                      <OpeningEditor
                        key={o.id}
                        opening={o}
                        room={draft}
                        expanded={selectedOpening === o.id}
                        issue={issueFor(o.id)}
                        onToggle={() => setSelectedOpening((s) => (s === o.id ? null : o.id))}
                        onChange={updateOpening}
                        onDelete={() => removeOpening(o.id)}
                        onDuplicate={(copy) => addOpening(fitOpening({ ...copy, offset: copy.offset + 0.2 }, draft.dimensions))}
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs leading-5 text-ink-muted">
                  Tip: click an opening in the 3D view to select it, then drag it along its wall.
                </p>
              </fieldset>
            )}

            {tab === 'json' && <JsonPanel draft={draft} onLoad={(r) => setDraft({ ...r, id: draft.id, createdAt: draft.createdAt })} onToast={setToast} />}
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/60 px-4 py-3">
            <p className="text-xs text-ink-muted" aria-live="polite">
              {dirty ? <span className="font-medium text-ochre-700">Unsaved changes</span> : 'All changes saved'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} disabled={!dirty} onClick={() => selectedRoom && setDraft(structuredClone(selectedRoom))}>
                Discard
              </Button>
              <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} disabled={!dirty || !canEdit} onClick={onSave}>
                Save changes
              </Button>
            </div>
          </div>
        </Card>

        {/* 3D viewer */}
        <Card className="relative order-first h-[380px] overflow-hidden sm:h-[500px] lg:order-none lg:sticky lg:top-24 lg:h-[calc(100vh-16rem)] lg:min-h-[540px]">
          <LazyRoomViewer
            room={draft}
            interactive={canEdit}
            selectedOpeningId={selectedOpening}
            onSelectOpening={(id) => {
              setSelectedOpening(id)
              if (id) setSelectedAppliance(null)
              if (id) setTab('openings')
            }}
            onMoveOpening={updateOpening}
            sceneChildren={
              <ApplianceMeshes
                room={draft}
                interactive={canEdit}
                selectedId={selectedAppliance}
                onSelect={(id) => {
                  setSelectedAppliance(id)
                  setSelectedOpening(null)
                  if (id) setTab('appliances')
                }}
                onMove={updateAppliance}
              />
            }
          />
          <div className="pointer-events-none absolute top-3 left-3 rounded-xl bg-surface/95 px-3 py-2 shadow-card ring-1 ring-line backdrop-blur">
            <p className="text-[13px] font-semibold">{draft.name || 'Untitled room'}</p>
            <p className="tabular text-[11px] text-ink-muted">
              {draft.dimensions.length} × {draft.dimensions.width} × {draft.dimensions.height} m, front faces {draft.orientation}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#a9cfe9]" /> Window</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#cdbb9f]" /> Indoor door</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#2f849f]" /> Outdoor door</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-ochre-500" /> Selected</span>
            </div>
          </div>
        </Card>
      </div>

      {toast && (
        <div role="status" className="fixed top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-canvas shadow-lift">
          <Check className="size-4 text-breeze-300" />
          {toast}
        </div>
      )}
    </div>
  )
}

function JsonPanel({ draft, onLoad, onToast }: { draft: Room; onLoad: (r: Room) => void; onToast: (m: string) => void }) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const json = serializeRoom(draft)

  const apply = () => {
    const result = parseRoomJson(text)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    onLoad(result.room)
    onToast(result.warnings.length ? result.warnings[0] : 'JSON applied. Save to keep it.')
    setText('')
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <FileJson className="size-4 text-ink-muted" /> Current configuration
          </h3>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              icon={<Copy className="size-3.5" />}
              onClick={() => {
                void navigator.clipboard?.writeText(json).then(
                  () => onToast('JSON copied'),
                  () => onToast('Copy is not available in this browser'),
                )
              }}
            >
              Copy
            </Button>
            <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => downloadJson(draft)}>
              Download
            </Button>
          </div>
        </div>
        <pre className="scrollbar-thin max-h-72 overflow-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] leading-[1.55] text-ink-soft">
          {json}
        </pre>
        <p className="mt-2 text-xs text-ink-muted">Schema version 1. Units are metres. See docs/ROOM_SCHEMA.md for field descriptions.</p>
      </div>

      <div className="border-t border-line pt-5">
        <Field label="Paste room JSON to load it into this room" htmlFor="json-paste">
          <textarea
            id="json-paste"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="w-full rounded-xl border border-line-strong px-3 py-2 font-mono text-[12px] focus:border-breeze-500 focus:ring-2 focus:ring-breeze-200 focus:outline-none"
            placeholder='{ "name": "Bedroom", "dimensions": { "length": 4, "width": 3, "height": 2.8 }, "orientation": "S", "windows": [], "doors": [] }'
          />
        </Field>
        {errors.length > 0 && (
          <ul className="mt-2 space-y-0.5 rounded-xl border border-clay-100 bg-clay-50 p-3 text-xs text-clay-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <Button className="mt-3" size="sm" disabled={!text.trim()} onClick={apply}>
          Load JSON into editor
        </Button>
      </div>
    </div>
  )
}
