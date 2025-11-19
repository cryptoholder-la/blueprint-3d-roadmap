export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  texture?: string; // Photo URL for wall texture
}

export interface Room {
  id: string;
  name: string;
  points: Point[];
  color: string;
  floorTexture?: string; // Photo URL for floor texture
  wallTexture?: string; // Photo URL for wall texture
}

export interface Door {
  id: string;
  position: Point;
  angle: number;
  width: number;
  wallId?: string;
}

export interface Window {
  id: string;
  position: Point;
  angle: number;
  width: number;
  height: number;
  wallId?: string;
}

export interface Cabinet {
  id: string;
  type: 'base' | 'wall' | 'tall' | 'corner' | 'island';
  position: Point;
  angle: number;
  width: number;
  depth: number;
  height: number;
  color: string;
}

export interface Model3D {
  id: string;
  name: string;
  position: Point;
  angle: number;
  scale: number;
  height: number; // Height off the floor
  modelUrl: string; // URL to .glb or .gltf file
}

export interface PhotoReference {
  id: string;
  name: string;
  url: string;
  position: Point;
  width: number;
  height: number;
  opacity: number;
  locked: boolean; // Lock to prevent accidental moves
}

export interface ScaleCalibration {
  point1: Point;
  point2: Point;
  realWorldDistance: number; // In meters
  unit: 'meters' | 'feet' | 'inches';
}

export interface Measurement {
  id: string;
  start: Point;
  end: Point;
  label?: string;
  visible: boolean;
}

export interface FloorPlan {
  id: string;
  name: string;
  walls: Wall[];
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  cabinets: Cabinet[];
  models3D: Model3D[];
  photos: PhotoReference[];
  measurements: Measurement[];
  scaleCalibration?: ScaleCalibration;
  metadata?: {
    createdAt: string;
    updatedAt: string;
    scale: number; // pixels per meter
    unit: 'meters' | 'feet' | 'inches';
    showMeasurements: boolean;
  };
}

export type ToolType = 'select' | 'wall' | 'room' | 'door' | 'window' | 'cabinet' | 'delete' | 'measure' | 'model3d' | 'photo';