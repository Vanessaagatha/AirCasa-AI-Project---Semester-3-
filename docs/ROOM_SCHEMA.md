# Room JSON schema (version 1)

Rooms are stored in the browser (`localStorage` key `coolnest.rooms.v1`) and can be exported or imported
as JSON from **My Rooms → JSON**. Validation lives in `src/features/rooms/roomSchema.ts`; the TypeScript
type is `Room` in `src/types/index.ts`. All lengths are in **metres**.

## Example

```json
{
  "schemaVersion": 1,
  "id": "room_master",
  "name": "Master bedroom",
  "type": "bedroom",
  "floorLevel": 2,
  "dimensions": { "length": 4, "width": 3.5, "height": 2.8 },
  "orientation": "W",
  "windows": [
    {
      "id": "win_master_1",
      "kind": "window",
      "label": "Main window",
      "wall": "front",
      "offset": 1.2,
      "width": 1.6,
      "height": 1.3,
      "sillHeight": 0.85,
      "style": "sliding",
      "operable": true,
      "hasShading": false,
      "hasScreen": true
    }
  ],
  "doors": [
    {
      "id": "door_master_1",
      "kind": "door",
      "label": "Hallway door",
      "wall": "back",
      "offset": 0.3,
      "width": 0.85,
      "height": 2.05,
      "leadsTo": "indoor"
    }
  ],
  "appliances": [
    { "id": "appl_master_fan", "type": "ceiling-fan", "label": "Ceiling fan", "powerW": 60, "onFrom": 20, "onTo": 6, "x": 0, "z": 0, "rotationDeg": 0 }
  ],
  "hasCeilingFan": true,
  "hasAirConditioner": false,
  "notes": "Upper floor, afternoon sun on the main window.",
  "createdAt": "2026-10-01T09:00:00.000Z",
  "updatedAt": "2026-10-01T09:00:00.000Z"
}
```

## Fields

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required |
| `type` | `bedroom \| living \| kitchen \| office \| other` | Defaults to `other` |
| `floorLevel` | integer ≥ 1 | 1 = ground floor |
| `dimensions.length` | 1.5–15 | Length of the front and back walls |
| `dimensions.width` | 1.5–15 | Length of the left and right walls |
| `dimensions.height` | 2.2–5 | Floor to ceiling |
| `orientation` | `N NE E SE S SW W NW` | Compass direction the **front wall faces** (approximate) |
| `windows[].wall`, `doors[].wall` | `front \| right \| back \| left` | Walls named from inside the room, facing the front wall |
| `offset` | number | Distance from the wall's **left corner as seen from inside** to the opening's left edge |
| `sillHeight` | number | Windows only: floor to bottom of window |
| `style` | `sliding \| casement \| louvre \| fixed` | Windows only |
| `operable` | boolean | Can be opened; used by ventilation and rain rules |
| `hasShading` | boolean | Curtains, blinds, awning or external shade |
| `leadsTo` | `indoor \| outdoor` | Doors only |
| `appliances[]` | array (optional) | Heat sources and coolers in the room |
| `appliances[].type` | `ceiling-fan, standing-fan, air-conditioner, refrigerator, television, computer, lighting, rice-cooker, water-dispenser, stove, iron, other` | Determines default wattage, duty cycle, heat fraction and 3D shape (`src/features/rooms/appliances.ts`) |
| `appliances[].powerW` | number | Rated power from the appliance label |
| `appliances[].onFrom`, `onTo` | 0–24 | Usual hours of use; `onTo` may be earlier than `onFrom` to wrap past midnight; 0–24 means always on |
| `appliances[].x`, `z` | metres | Position from the room centre (x along length, z along width) |
| `appliances[].rotationDeg` | degrees | Rotation about the vertical axis |

Openings that do not fit their wall are adjusted on import, with a warning.

## 3D coordinate convention

The room is centred on the origin, Y up. X spans the length, Z spans the width.
The front wall is at +Z. Standing inside and facing the front wall, the right wall is at −X and the left wall at +X.
Each wall facing is computed from `orientation`: right = front + 90°, back = front + 180°, left = front + 270° (clockwise).
