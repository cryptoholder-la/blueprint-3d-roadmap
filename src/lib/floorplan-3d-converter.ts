import { FloorPlan, Wall, Room, Door, Window, Cabinet, Model3D, PhotoReference } from './floorplan-types';
import * as THREE from 'three';

export interface FloorPlan3DData {
  meshes: Array<{
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    position: [number, number, number];
    rotation?: [number, number, number];
    type: 'wall' | 'floor' | 'door' | 'window' | 'ceiling' | 'cabinet' | 'model3d';
    id: string;
    modelUrl?: string;
  }>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export function convertFloorPlanTo3D(floorPlan: FloorPlan): FloorPlan3DData {
  const meshes: FloorPlan3DData['meshes'] = [];
  const scale = (floorPlan.metadata?.scale || 20) / 20; // Normalize to our base scale
  
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  floorPlan.walls.forEach(wall => {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  });

  floorPlan.rooms.forEach(room => {
    room.points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
  });

  // Convert walls to 3D
  floorPlan.walls.forEach(wall => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const centerX = (wall.start.x + wall.end.x) / 2;
    const centerY = (wall.start.y + wall.end.y) / 2;

    // Convert 2D coordinates to 3D (x, z plane for floor, y for height)
    const x = (centerX - (minX + maxX) / 2) * 0.1 * scale;
    const z = (centerY - (minY + maxY) / 2) * 0.1 * scale;
    const wallHeight = wall.height || 2.7;

    const geometry = new THREE.BoxGeometry(
      length * 0.1 * scale,
      wallHeight,
      wall.thickness * 0.1 * scale
    );

    // Create material with texture if available
    let material: THREE.Material;
    if (wall.texture) {
      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(wall.texture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(length * 0.1 * scale / 2, wallHeight / 2);
      material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.2,
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5,
        roughness: 0.8,
        metalness: 0.2,
      });
    }

    meshes.push({
      geometry,
      material,
      position: [x, wallHeight / 2, z],
      rotation: [0, angle, 0],
      type: 'wall',
      id: wall.id,
    });
  });

  // Convert rooms to floor meshes
  floorPlan.rooms.forEach(room => {
    if (room.points.length < 3) return;

    // Create shape from room points
    const shape = new THREE.Shape();
    room.points.forEach((point, index) => {
      const x = (point.x - (minX + maxX) / 2) * 0.1 * scale;
      const z = (point.y - (minY + maxY) / 2) * 0.1 * scale;
      
      if (index === 0) {
        shape.moveTo(x, z);
      } else {
        shape.lineTo(x, z);
      }
    });
    shape.closePath();

    // Floor
    const floorGeometry = new THREE.ShapeGeometry(shape);
    let floorMaterial: THREE.Material;
    
    if (room.floorTexture) {
      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(room.floorTexture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
      floorMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
    } else {
      floorMaterial = new THREE.MeshStandardMaterial({
        color: room.color || 0xe3f2fd,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
    }

    meshes.push({
      geometry: floorGeometry,
      material: floorMaterial,
      position: [0, 0.01, 0],
      rotation: [-Math.PI / 2, 0, 0],
      type: 'floor',
      id: room.id,
    });

    // Ceiling
    const ceilingGeometry = new THREE.ShapeGeometry(shape);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    meshes.push({
      geometry: ceilingGeometry,
      material: ceilingMaterial,
      position: [0, 2.7, 0],
      rotation: [-Math.PI / 2, 0, 0],
      type: 'ceiling',
      id: `${room.id}-ceiling`,
    });
  });

  // Convert doors to 3D
  floorPlan.doors.forEach(door => {
    const x = (door.position.x - (minX + maxX) / 2) * 0.1 * scale;
    const z = (door.position.y - (minY + maxY) / 2) * 0.1 * scale;

    const geometry = new THREE.BoxGeometry(
      door.width * 0.1 * scale,
      2.0,
      0.05
    );

    const material = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.7,
      metalness: 0.3,
    });

    meshes.push({
      geometry,
      material,
      position: [x, 1.0, z],
      rotation: [0, door.angle, 0],
      type: 'door',
      id: door.id,
    });
  });

  // Convert windows to 3D
  floorPlan.windows.forEach(window => {
    const x = (window.position.x - (minX + maxX) / 2) * 0.1 * scale;
    const z = (window.position.y - (minY + maxY) / 2) * 0.1 * scale;

    const geometry = new THREE.BoxGeometry(
      window.width * 0.1 * scale,
      window.height || 1.5,
      0.05
    );

    const material = new THREE.MeshStandardMaterial({
      color: 0x87CEEB,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.6,
    });

    meshes.push({
      geometry,
      material,
      position: [x, 1.5, z],
      rotation: [0, window.angle, 0],
      type: 'window',
      id: window.id,
    });
  });

  // Convert cabinets to 3D
  floorPlan.cabinets.forEach(cabinet => {
    const x = (cabinet.position.x - (minX + maxX) / 2) * 0.1 * scale;
    const z = (cabinet.position.y - (minY + maxY) / 2) * 0.1 * scale;

    // Different heights based on cabinet type
    const yPosition = cabinet.type === 'wall' ? 1.8 : cabinet.height / 2;

    const geometry = new THREE.BoxGeometry(
      cabinet.width * 0.1 * scale,
      cabinet.height,
      cabinet.depth * 0.1 * scale
    );

    // Parse cabinet color
    const color = new THREE.Color(cabinet.color);

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.4,
    });

    meshes.push({
      geometry,
      material,
      position: [x, yPosition, z],
      rotation: [0, cabinet.angle, 0],
      type: 'cabinet',
      id: cabinet.id,
    });

    // Add handles for cabinets (small cylindrical knobs)
    if (cabinet.type !== 'island') {
      const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8);
      const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.3,
        metalness: 0.8,
      });

      // Position handles on the front of the cabinet
      const handleOffset = cabinet.depth * 0.1 * scale / 2 + 0.025;
      
      meshes.push({
        geometry: handleGeometry,
        material: handleMaterial,
        position: [x, yPosition, z + handleOffset],
        rotation: [Math.PI / 2, 0, cabinet.angle],
        type: 'cabinet',
        id: `${cabinet.id}-handle`,
      });
    }
  });

  // Convert 3D models (add placeholders that will be loaded by GLTFLoader)
  floorPlan.models3D?.forEach(model => {
    const x = (model.position.x - (minX + maxX) / 2) * 0.1 * scale;
    const z = (model.position.y - (minY + maxY) / 2) * 0.1 * scale;

    // Add placeholder box for 3D models
    const size = 0.5 * model.scale;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x9c27b0,
      roughness: 0.5,
      metalness: 0.5,
      transparent: true,
      opacity: 0.7,
    });

    meshes.push({
      geometry,
      material,
      position: [x, model.height + size / 2, z],
      rotation: [0, model.angle, 0],
      type: 'model3d',
      id: model.id,
      modelUrl: model.modelUrl,
    });
  });

  return {
    meshes,
    bounds: { minX, maxX, minY, maxY },
  };
}

export function create3DScene(floorPlan3DData: FloorPlan3DData): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Add directional light (sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  // Add point light for interior
  const pointLight = new THREE.PointLight(0xffffff, 0.5);
  pointLight.position.set(0, 2, 0);
  scene.add(pointLight);

  // Add meshes to scene
  floorPlan3DData.meshes.forEach(meshData => {
    const mesh = new THREE.Mesh(meshData.geometry, meshData.material);
    mesh.position.set(...meshData.position);
    if (meshData.rotation) {
      mesh.rotation.set(...meshData.rotation);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { id: meshData.id, type: meshData.type, modelUrl: meshData.modelUrl };
    scene.add(mesh);
  });

  // Setup camera
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(8, 8, 8);
  camera.lookAt(0, 0, 0);

  return { scene, camera };
}