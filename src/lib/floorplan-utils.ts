import { Point, Wall, Room, Door, Window, FloorPlan, Cabinet, Measurement, Model3D, PhotoReference } from './floorplan-types';

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function findNearestPoint(point: Point, points: Point[], threshold: number): Point | null {
  let nearest: Point | null = null;
  let minDist = threshold;

  for (const p of points) {
    const dist = distance(point, p);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }

  return nearest;
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function exportFloorPlan(floorPlan: FloorPlan): string {
  return JSON.stringify(floorPlan, null, 2);
}

export function importFloorPlan(jsonString: string): FloorPlan {
  return JSON.parse(jsonString);
}

export function createDefaultFloorPlan(): FloorPlan {
  return {
    id: `floorplan-${Date.now()}`,
    name: 'New Floor Plan',
    walls: [],
    rooms: [],
    doors: [],
    windows: [],
    cabinets: [],
    models3D: [],
    photos: [],
    measurements: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scale: 20, // 20 pixels per meter
      unit: 'meters',
      showMeasurements: true,
    },
  };
}

export function getWallAngle(wall: Wall): number {
  return Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
}

export function generateRoomTemplate(type: 'living' | 'bedroom' | 'kitchen' | 'bathroom', centerX: number, centerY: number, scale: number = 20): Room {
  const templates = {
    living: { width: 5, height: 6, name: 'Living Room', color: '#e3f2fd' },
    bedroom: { width: 4, height: 4, name: 'Bedroom', color: '#fff3e0' },
    kitchen: { width: 4, height: 3, name: 'Kitchen', color: '#f3e5f5' },
    bathroom: { width: 2, height: 2.5, name: 'Bathroom', color: '#e0f2f1' },
  };

  const template = templates[type];
  const w = template.width * scale;
  const h = template.height * scale;

  return {
    id: `room-${Date.now()}-${Math.random()}`,
    name: template.name,
    color: template.color,
    points: [
      { x: centerX - w / 2, y: centerY - h / 2 },
      { x: centerX + w / 2, y: centerY - h / 2 },
      { x: centerX + w / 2, y: centerY + h / 2 },
      { x: centerX - w / 2, y: centerY + h / 2 },
    ],
  };
}

export function createCabinet(
  type: Cabinet['type'],
  position: Point,
  angle: number = 0
): Cabinet {
  const presets: Record<Cabinet['type'], { width: number; depth: number; height: number; color: string }> = {
    base: { width: 0.6, depth: 0.6, height: 0.9, color: '#8B4513' },
    wall: { width: 0.6, depth: 0.35, height: 0.7, color: '#A0522D' },
    tall: { width: 0.6, depth: 0.6, height: 2.2, color: '#654321' },
    corner: { width: 0.9, depth: 0.9, height: 0.9, color: '#8B4513' },
    island: { width: 1.2, depth: 0.9, height: 0.9, color: '#A0522D' },
  };

  const preset = presets[type];
  const scale = 20; // pixels per meter

  return {
    id: `cabinet-${Date.now()}-${Math.random()}`,
    type,
    position,
    angle,
    width: preset.width * scale,
    depth: preset.depth * scale,
    height: preset.height,
    color: preset.color,
  };
}

export function convertPixelsToRealWorld(pixels: number, scale: number, unit: 'meters' | 'feet' | 'inches'): number {
  const meters = pixels / scale;
  switch (unit) {
    case 'feet':
      return meters * 3.28084;
    case 'inches':
      return meters * 39.3701;
    default:
      return meters;
  }
}

export function convertRealWorldToPixels(realWorld: number, scale: number, unit: 'meters' | 'feet' | 'inches'): number {
  let meters = realWorld;
  switch (unit) {
    case 'feet':
      meters = realWorld / 3.28084;
      break;
    case 'inches':
      meters = realWorld / 39.3701;
      break;
  }
  return meters * scale;
}

export function formatMeasurement(pixels: number, scale: number, unit: 'meters' | 'feet' | 'inches'): string {
  const value = convertPixelsToRealWorld(pixels, scale, unit);
  switch (unit) {
    case 'feet':
      return `${value.toFixed(2)} ft`;
    case 'inches':
      return `${value.toFixed(1)} in`;
    default:
      return `${value.toFixed(2)} m`;
  }
}

export function calculateAutoMeasurements(floorPlan: FloorPlan): Measurement[] {
  const measurements: Measurement[] = [];
  const scale = floorPlan.metadata?.scale || 20;
  const unit = floorPlan.metadata?.unit || 'meters';

  // Add measurements for all walls
  floorPlan.walls.forEach(wall => {
    const dist = distance(wall.start, wall.end);
    measurements.push({
      id: `measure-wall-${wall.id}`,
      start: wall.start,
      end: wall.end,
      label: formatMeasurement(dist, scale, unit),
      visible: true,
    });
  });

  // Add measurements for rooms (perimeter)
  floorPlan.rooms.forEach(room => {
    for (let i = 0; i < room.points.length; i++) {
      const start = room.points[i];
      const end = room.points[(i + 1) % room.points.length];
      const dist = distance(start, end);
      measurements.push({
        id: `measure-room-${room.id}-${i}`,
        start,
        end,
        label: formatMeasurement(dist, scale, unit),
        visible: true,
      });
    }
  });

  return measurements;
}

export function uploadImageToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}