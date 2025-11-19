"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, PerspectiveCamera, Text, Line } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { FloorPlan } from '@/lib/floorplan-types';
import { convertFloorPlanTo3D, FloorPlan3DData } from '@/lib/floorplan-3d-converter';
import { distance, formatMeasurement } from '@/lib/floorplan-utils';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface FloorPlan3DViewerProps {
  floorPlan: FloorPlan;
  width?: number;
  height?: number;
}

function Model3DLoader({ modelUrl, position, rotation, scale }: { 
  modelUrl: string; 
  position: [number, number, number]; 
  rotation: [number, number, number];
  scale: number;
}) {
  try {
    const gltf = useLoader(GLTFLoader, modelUrl);
    return (
      <primitive 
        object={gltf.scene} 
        position={position} 
        rotation={rotation}
        scale={[scale, scale, scale]}
        castShadow
        receiveShadow
      />
    );
  } catch (error) {
    // Fallback to placeholder box if model fails to load
    return (
      <mesh position={position} rotation={rotation} castShadow receiveShadow>
        <boxGeometry args={[0.5 * scale, 0.5 * scale, 0.5 * scale]} />
        <meshStandardMaterial color={0x9c27b0} />
      </mesh>
    );
  }
}

function Measurement3D({ 
  start, 
  end, 
  label, 
  offset = 0.3 
}: { 
  start: [number, number, number]; 
  end: [number, number, number]; 
  label: string;
  offset?: number;
}) {
  const midpoint: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2 + offset,
    (start[2] + end[2]) / 2,
  ];

  return (
    <group>
      <Line
        points={[start, end]}
        color="#ff5722"
        lineWidth={2}
      />
      <Text
        position={midpoint}
        fontSize={0.15}
        color="#ff5722"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#ffffff"
      >
        {label}
      </Text>
    </group>
  );
}

function Scene3D({ 
  floorPlan3DData, 
  floorPlan, 
  showMeasurements 
}: { 
  floorPlan3DData: FloorPlan3DData; 
  floorPlan: FloorPlan;
  showMeasurements: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const scale = floorPlan.metadata?.scale || 20;
  const unit = floorPlan.metadata?.unit || 'meters';

  return (
    <group ref={groupRef}>
      {/* Render all meshes */}
      {floorPlan3DData.meshes.map((meshData, index) => {
        // If it's a 3D model with a valid URL, use the GLTF loader
        if (meshData.type === 'model3d' && meshData.modelUrl && meshData.modelUrl.endsWith('.glb') || meshData.modelUrl?.endsWith('.gltf')) {
          return (
            <Model3DLoader
              key={`${meshData.id}-${index}`}
              modelUrl={meshData.modelUrl}
              position={meshData.position}
              rotation={meshData.rotation || [0, 0, 0]}
              scale={1}
            />
          );
        }

        // Otherwise render as a regular mesh
        return (
          <mesh
            key={`${meshData.id}-${index}`}
            geometry={meshData.geometry}
            material={meshData.material}
            position={meshData.position}
            rotation={meshData.rotation ? meshData.rotation : [0, 0, 0]}
            castShadow
            receiveShadow
            userData={{ id: meshData.id, type: meshData.type }}
          />
        );
      })}

      {/* Render 3D measurements */}
      {showMeasurements && (
        <>
          {/* Wall measurements */}
          {floorPlan.walls.map((wall) => {
            const minX = Math.min(...floorPlan.walls.map(w => Math.min(w.start.x, w.end.x)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.x)));
            const maxX = Math.max(...floorPlan.walls.map(w => Math.max(w.start.x, w.end.x)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.x)));
            const minY = Math.min(...floorPlan.walls.map(w => Math.min(w.start.y, w.end.y)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.y)));
            const maxY = Math.max(...floorPlan.walls.map(w => Math.max(w.start.y, w.end.y)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.y)));
            
            const scaleVal = (floorPlan.metadata?.scale || 20) / 20;
            const x1 = (wall.start.x - (minX + maxX) / 2) * 0.1 * scaleVal;
            const z1 = (wall.start.y - (minY + maxY) / 2) * 0.1 * scaleVal;
            const x2 = (wall.end.x - (minX + maxX) / 2) * 0.1 * scaleVal;
            const z2 = (wall.end.y - (minY + maxY) / 2) * 0.1 * scaleVal;

            const dist = distance(wall.start, wall.end);
            const label = formatMeasurement(dist, scale, unit);

            return (
              <Measurement3D
                key={`measure-wall-${wall.id}`}
                start={[x1, 0.1, z1]}
                end={[x2, 0.1, z2]}
                label={label}
                offset={0.2}
              />
            );
          })}

          {/* Room perimeter measurements */}
          {floorPlan.rooms.map((room) => {
            const minX = Math.min(...floorPlan.walls.map(w => Math.min(w.start.x, w.end.x)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.x)));
            const maxX = Math.max(...floorPlan.walls.map(w => Math.max(w.start.x, w.end.x)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.x)));
            const minY = Math.min(...floorPlan.walls.map(w => Math.min(w.start.y, w.end.y)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.y)));
            const maxY = Math.max(...floorPlan.walls.map(w => Math.max(w.start.y, w.end.y)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.y)));
            
            const scaleVal = (floorPlan.metadata?.scale || 20) / 20;

            return room.points.map((point, i) => {
              const nextPoint = room.points[(i + 1) % room.points.length];
              const x1 = (point.x - (minX + maxX) / 2) * 0.1 * scaleVal;
              const z1 = (point.y - (minY + maxY) / 2) * 0.1 * scaleVal;
              const x2 = (nextPoint.x - (minX + maxX) / 2) * 0.1 * scaleVal;
              const z2 = (nextPoint.y - (minY + maxY) / 2) * 0.1 * scaleVal;

              const dist = distance(point, nextPoint);
              const label = formatMeasurement(dist, scale, unit);

              return (
                <Measurement3D
                  key={`measure-room-${room.id}-${i}`}
                  start={[x1, 0.05, z1]}
                  end={[x2, 0.05, z2]}
                  label={label}
                  offset={0.15}
                />
              );
            });
          })}

          {/* Custom measurements */}
          {floorPlan.measurements?.map((measurement) => {
            if (!measurement.visible) return null;

            const minX = Math.min(...floorPlan.walls.map(w => Math.min(w.start.x, w.end.x)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.x)));
            const maxX = Math.max(...floorPlan.walls.map(w => Math.max(w.start.x, w.end.x)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.x)));
            const minY = Math.min(...floorPlan.walls.map(w => Math.min(w.start.y, w.end.y)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.y)));
            const maxY = Math.max(...floorPlan.walls.map(w => Math.max(w.start.y, w.end.y)), ...floorPlan.rooms.flatMap(r => r.points.map(p => p.y)));
            
            const scaleVal = (floorPlan.metadata?.scale || 20) / 20;
            const x1 = (measurement.start.x - (minX + maxX) / 2) * 0.1 * scaleVal;
            const z1 = (measurement.start.y - (minY + maxY) / 2) * 0.1 * scaleVal;
            const x2 = (measurement.end.x - (minX + maxX) / 2) * 0.1 * scaleVal;
            const z2 = (measurement.end.y - (minY + maxY) / 2) * 0.1 * scaleVal;

            return (
              <Measurement3D
                key={measurement.id}
                start={[x1, 0.3, z1]}
                end={[x2, 0.3, z2]}
                label={measurement.label || ''}
                offset={0.3}
              />
            );
          })}
        </>
      )}
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial 
          color="#7cb342" 
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Grid helper */}
      <Grid
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#9e9e9e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#757575"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
    </group>
  );
}

function CameraController() {
  const { camera, gl } = useThree();
  
  useEffect(() => {
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

export default function FloorPlan3DViewer({
  floorPlan,
  width = 800,
  height = 600,
}: FloorPlan3DViewerProps) {
  const floorPlan3DData = convertFloorPlanTo3D(floorPlan);
  const [showMeasurements, setShowMeasurements] = useState(floorPlan.metadata?.showMeasurements ?? true);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMeasurements(!showMeasurements)}
        >
          {showMeasurements ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
          {showMeasurements ? 'Hide' : 'Show'} Measurements
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-gradient-to-b from-sky-200 to-sky-50">
        <Canvas
          shadows
          style={{ width, height }}
          gl={{ 
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />
          <pointLight position={[0, 5, 0]} intensity={0.5} />
          <hemisphereLight args={[0x87CEEB, 0x7cb342, 0.6]} />

          {/* Scene */}
          <Scene3D 
            floorPlan3DData={floorPlan3DData} 
            floorPlan={floorPlan}
            showMeasurements={showMeasurements}
          />

          {/* Camera and Controls */}
          <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={60} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={50}
            maxPolarAngle={Math.PI / 2.1}
          />

          {/* Environment */}
          <Environment preset="sunset" />
          
          {/* Fog */}
          <fog attach="fog" args={['#87CEEB', 20, 50]} />
          
          <CameraController />
        </Canvas>
      </div>

      <div className="p-4 bg-muted text-sm rounded-lg">
        <p><strong>3D View Controls:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Left click + drag to rotate camera</li>
          <li>Right click + drag to pan</li>
          <li>Scroll to zoom in/out</li>
          <li>Toggle measurements on/off using the button above</li>
          <li>Photo-realistic rendering with shadows and environment mapping</li>
        </ul>
      </div>
    </div>
  );
}