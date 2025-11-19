"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FloorPlan, Point, Wall, Room, Door, Window, Cabinet, ToolType, Measurement, PhotoReference, Model3D } from '@/lib/floorplan-types';
import { distance, snapToGrid, pointToLineDistance, findNearestPoint, isPointInPolygon, getWallAngle, generateRoomTemplate, createCabinet, formatMeasurement, uploadImageToDataURL, calculateAutoMeasurements } from '@/lib/floorplan-utils';
import { Button } from '@/components/ui/button';
import { Move, Square, DoorOpen, Maximize, Trash2, Hand, CookingPot, Ruler, ImagePlus, Box, Eye, EyeOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface FloorPlan2DEditorProps {
  floorPlan: FloorPlan;
  onFloorPlanChange: (floorPlan: FloorPlan) => void;
  width?: number;
  height?: number;
}

export default function FloorPlan2DEditor({
  floorPlan,
  onFloorPlanChange,
  width = 800,
  height = 600,
}: FloorPlan2DEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const model3DInputRef = useRef<HTMLInputElement>(null);
  
  const [tool, setTool] = useState<ToolType>('select');
  const [cabinetType, setCabinetType] = useState<Cabinet['type']>('base');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize] = useState(20);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(floorPlan.metadata?.showMeasurements ?? true);
  const [scaleDistance, setScaleDistance] = useState<string>('');
  const [scaleUnit, setScaleUnit] = useState<'meters' | 'feet' | 'inches'>('meters');
  
  const scale = floorPlan.metadata?.scale || 20;
  const unit = floorPlan.metadata?.unit || 'meters';

  const drawArrowLine = useCallback((ctx: CanvasRenderingContext2D, start: Point, end: Point, label: string, color: string = '#2196f3') => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const len = Math.sqrt(dx * dx + dy * dy);

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw arrow heads
    const arrowSize = 10;
    
    // Arrow at start
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(
      start.x + arrowSize * Math.cos(angle + Math.PI + 0.3),
      start.y + arrowSize * Math.sin(angle + Math.PI + 0.3)
    );
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(
      start.x + arrowSize * Math.cos(angle + Math.PI - 0.3),
      start.y + arrowSize * Math.sin(angle + Math.PI - 0.3)
    );
    ctx.stroke();

    // Arrow at end
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x + arrowSize * Math.cos(angle + 0.3),
      end.y + arrowSize * Math.sin(angle + 0.3)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x + arrowSize * Math.cos(angle - 0.3),
      end.y + arrowSize * Math.sin(angle - 0.3)
    );
    ctx.stroke();

    // Draw label
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    
    // Background for text
    ctx.fillStyle = 'white';
    ctx.fillRect(-30, -15, 60, 20);
    
    // Text
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    
    ctx.restore();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Apply pan offset
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - panOffset.x, -panOffset.y);
        ctx.lineTo(x - panOffset.x, height - panOffset.y);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-panOffset.x, y - panOffset.y);
        ctx.lineTo(width - panOffset.x, y - panOffset.y);
        ctx.stroke();
      }
    }

    // Draw photo references
    floorPlan.photos?.forEach((photo) => {
      const img = new Image();
      img.src = photo.url;
      ctx.globalAlpha = photo.opacity;
      ctx.drawImage(img, photo.position.x, photo.position.y, photo.width, photo.height);
      ctx.globalAlpha = 1;

      // Draw border if selected
      if (selectedId === photo.id) {
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 3;
        ctx.strokeRect(photo.position.x, photo.position.y, photo.width, photo.height);
      }
    });

    // Draw rooms first (as background)
    floorPlan.rooms.forEach((room) => {
      ctx.fillStyle = room.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      room.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Draw room outline
      ctx.strokeStyle = selectedId === room.id ? '#2196f3' : '#666';
      ctx.lineWidth = selectedId === room.id ? 3 : 1;
      ctx.stroke();

      // Draw room label
      if (room.points.length > 0) {
        const centerX = room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length;
        const centerY = room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length;
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, centerX, centerY);
      }
    });

    // Draw walls
    floorPlan.walls.forEach((wall) => {
      ctx.strokeStyle = selectedId === wall.id ? '#2196f3' : '#333';
      ctx.lineWidth = selectedId === wall.id ? wall.thickness + 4 : wall.thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wall.start.x, wall.start.y);
      ctx.lineTo(wall.end.x, wall.end.y);
      ctx.stroke();
    });

    // Draw cabinets
    floorPlan.cabinets.forEach((cabinet) => {
      ctx.save();
      ctx.translate(cabinet.position.x, cabinet.position.y);
      ctx.rotate(cabinet.angle);
      
      // Cabinet body
      ctx.fillStyle = selectedId === cabinet.id ? '#2196f3' : cabinet.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-cabinet.width / 2, -cabinet.depth / 2, cabinet.width, cabinet.depth);
      ctx.globalAlpha = 1;
      
      // Cabinet outline
      ctx.strokeStyle = selectedId === cabinet.id ? '#2196f3' : '#654321';
      ctx.lineWidth = 2;
      ctx.strokeRect(-cabinet.width / 2, -cabinet.depth / 2, cabinet.width, cabinet.depth);
      
      // Cabinet type label
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cabinet.type.toUpperCase(), 0, 4);
      
      ctx.restore();
    });

    // Draw 3D models (as placeholders)
    floorPlan.models3D?.forEach((model) => {
      ctx.save();
      ctx.translate(model.position.x, model.position.y);
      ctx.rotate(model.angle);
      
      const size = 40 * model.scale;
      
      // Draw box icon
      ctx.fillStyle = selectedId === model.id ? '#2196f3' : '#9c27b0';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.globalAlpha = 1;
      
      ctx.strokeStyle = selectedId === model.id ? '#2196f3' : '#7b1fa2';
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      
      // Draw 3D icon
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('3D', 0, -5);
      ctx.fillText(model.name, 0, 8);
      
      ctx.restore();
    });

    // Draw doors
    floorPlan.doors.forEach((door) => {
      ctx.save();
      ctx.translate(door.position.x, door.position.y);
      ctx.rotate(door.angle);
      
      // Door frame
      ctx.strokeStyle = selectedId === door.id ? '#2196f3' : '#8B4513';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-door.width / 2, 0);
      ctx.lineTo(door.width / 2, 0);
      ctx.stroke();

      // Door arc
      ctx.strokeStyle = selectedId === door.id ? '#2196f3' : '#DEB887';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(door.width / 2, 0, door.width, Math.PI, Math.PI / 2, true);
      ctx.stroke();
      
      ctx.restore();
    });

    // Draw windows
    floorPlan.windows.forEach((window) => {
      ctx.save();
      ctx.translate(window.position.x, window.position.y);
      ctx.rotate(window.angle);
      
      ctx.fillStyle = selectedId === window.id ? '#2196f3' : '#87CEEB';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-window.width / 2, -3, window.width, 6);
      ctx.globalAlpha = 1;
      
      ctx.strokeStyle = selectedId === window.id ? '#2196f3' : '#4682B4';
      ctx.lineWidth = 2;
      ctx.strokeRect(-window.width / 2, -3, window.width, 6);
      
      ctx.restore();
    });

    // Draw measurements
    if (showMeasurements) {
      const measurements = floorPlan.measurements.length > 0 
        ? floorPlan.measurements 
        : calculateAutoMeasurements(floorPlan);

      measurements.forEach((measurement) => {
        if (measurement.visible) {
          drawArrowLine(
            ctx,
            measurement.start,
            measurement.end,
            measurement.label || formatMeasurement(distance(measurement.start, measurement.end), scale, unit),
            '#ff5722'
          );
        }
      });
    }

    // Draw temporary line/shape while dragging
    if (isDragging && dragStart && currentPoint) {
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      if (tool === 'wall') {
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
      } else if (tool === 'room') {
        ctx.strokeRect(
          Math.min(dragStart.x, currentPoint.x),
          Math.min(dragStart.y, currentPoint.y),
          Math.abs(currentPoint.x - dragStart.x),
          Math.abs(currentPoint.y - dragStart.y)
        );
      } else if (tool === 'measure') {
        const dist = distance(dragStart, currentPoint);
        drawArrowLine(ctx, dragStart, currentPoint, formatMeasurement(dist, scale, unit), '#ff9800');
      }
      
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [floorPlan, width, height, showGrid, gridSize, isDragging, dragStart, currentPoint, selectedId, tool, panOffset, showMeasurements, scale, unit, drawArrowLine]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left - panOffset.x,
      y: e.clientY - rect.top - panOffset.y,
    };
    
    return showGrid ? snapToGrid(point, gridSize) : point;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    
    if (tool === 'select' && e.button === 1) {
      setIsPanning(true);
      setDragStart(point);
      return;
    }

    if (tool === 'select') {
      // Check for selection
      let found = false;

      // Check photos
      for (const photo of floorPlan.photos || []) {
        if (
          point.x >= photo.position.x &&
          point.x <= photo.position.x + photo.width &&
          point.y >= photo.position.y &&
          point.y <= photo.position.y + photo.height
        ) {
          setSelectedId(photo.id);
          found = true;
          break;
        }
      }

      if (!found) {
        // Check 3D models
        for (const model of floorPlan.models3D || []) {
          const size = 40 * model.scale;
          const dx = Math.abs(point.x - model.position.x);
          const dy = Math.abs(point.y - model.position.y);
          if (dx < size / 2 && dy < size / 2) {
            setSelectedId(model.id);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Check cabinets
        for (const cabinet of floorPlan.cabinets) {
          const dx = Math.abs(point.x - cabinet.position.x);
          const dy = Math.abs(point.y - cabinet.position.y);
          if (dx < cabinet.width / 2 && dy < cabinet.depth / 2) {
            setSelectedId(cabinet.id);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Check walls
        for (const wall of floorPlan.walls) {
          if (pointToLineDistance(point, wall.start, wall.end) < 10) {
            setSelectedId(wall.id);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Check rooms
        for (const room of floorPlan.rooms) {
          if (isPointInPolygon(point, room.points)) {
            setSelectedId(room.id);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Check doors
        for (const door of floorPlan.doors) {
          if (distance(point, door.position) < 20) {
            setSelectedId(door.id);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Check windows
        for (const window of floorPlan.windows) {
          if (distance(point, window.position) < 20) {
            setSelectedId(window.id);
            found = true;
            break;
          }
        }
      }

      if (!found) setSelectedId(null);
    } else if (tool === 'delete') {
      // Delete selected item
      const updatedFloorPlan = { ...floorPlan };
      
      updatedFloorPlan.photos = (updatedFloorPlan.photos || []).filter(photo => {
        return !(
          point.x >= photo.position.x &&
          point.x <= photo.position.x + photo.width &&
          point.y >= photo.position.y &&
          point.y <= photo.position.y + photo.height
        );
      });

      updatedFloorPlan.models3D = (updatedFloorPlan.models3D || []).filter(model => {
        const size = 40 * model.scale;
        const dx = Math.abs(point.x - model.position.x);
        const dy = Math.abs(point.y - model.position.y);
        return dx >= size / 2 || dy >= size / 2;
      });

      updatedFloorPlan.cabinets = updatedFloorPlan.cabinets.filter(cabinet => {
        const dx = Math.abs(point.x - cabinet.position.x);
        const dy = Math.abs(point.y - cabinet.position.y);
        return dx >= cabinet.width / 2 || dy >= cabinet.depth / 2;
      });
      
      updatedFloorPlan.walls = updatedFloorPlan.walls.filter(wall => 
        pointToLineDistance(point, wall.start, wall.end) >= 10
      );
      updatedFloorPlan.rooms = updatedFloorPlan.rooms.filter(room => 
        !isPointInPolygon(point, room.points)
      );
      updatedFloorPlan.doors = updatedFloorPlan.doors.filter(door => 
        distance(point, door.position) >= 20
      );
      updatedFloorPlan.windows = updatedFloorPlan.windows.filter(window => 
        distance(point, window.position) >= 20
      );
      
      onFloorPlanChange(updatedFloorPlan);
    } else {
      setIsDragging(true);
      setDragStart(point);
      setCurrentPoint(point);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    
    if (isPanning && dragStart) {
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;
      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      return;
    }

    if (isDragging) {
      setCurrentPoint(point);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setDragStart(null);
      return;
    }

    if (!isDragging || !dragStart || !currentPoint) return;

    const updatedFloorPlan = { ...floorPlan };

    if (tool === 'wall') {
      const newWall: Wall = {
        id: `wall-${Date.now()}`,
        start: dragStart,
        end: currentPoint,
        thickness: 8,
        height: 2.7,
      };
      updatedFloorPlan.walls.push(newWall);
    } else if (tool === 'room') {
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        name: 'Room',
        color: '#e3f2fd',
        points: [
          dragStart,
          { x: currentPoint.x, y: dragStart.y },
          currentPoint,
          { x: dragStart.x, y: currentPoint.y },
        ],
      };
      updatedFloorPlan.rooms.push(newRoom);
    } else if (tool === 'door') {
      const newDoor: Door = {
        id: `door-${Date.now()}`,
        position: currentPoint,
        angle: 0,
        width: 40,
      };
      updatedFloorPlan.doors.push(newDoor);
    } else if (tool === 'window') {
      const newWindow: Window = {
        id: `window-${Date.now()}`,
        position: currentPoint,
        angle: 0,
        width: 40,
        height: 1.5,
      };
      updatedFloorPlan.windows.push(newWindow);
    } else if (tool === 'cabinet') {
      const newCabinet = createCabinet(cabinetType, currentPoint, 0);
      updatedFloorPlan.cabinets.push(newCabinet);
    } else if (tool === 'measure') {
      const dist = distance(dragStart, currentPoint);
      const newMeasurement: Measurement = {
        id: `measurement-${Date.now()}`,
        start: dragStart,
        end: currentPoint,
        label: formatMeasurement(dist, scale, unit),
        visible: true,
      };
      if (!updatedFloorPlan.measurements) {
        updatedFloorPlan.measurements = [];
      }
      updatedFloorPlan.measurements.push(newMeasurement);
    }

    onFloorPlanChange(updatedFloorPlan);
    setIsDragging(false);
    setDragStart(null);
    setCurrentPoint(null);
  };

  const addRoomTemplate = (type: 'living' | 'bedroom' | 'kitchen' | 'bathroom') => {
    const centerX = width / 2 - panOffset.x;
    const centerY = height / 2 - panOffset.y;
    const newRoom = generateRoomTemplate(type, centerX, centerY);
    const updatedFloorPlan = { ...floorPlan };
    updatedFloorPlan.rooms.push(newRoom);
    onFloorPlanChange(updatedFloorPlan);
  };

  const addCabinet = (type: Cabinet['type']) => {
    const centerX = width / 2 - panOffset.x;
    const centerY = height / 2 - panOffset.y;
    const newCabinet = createCabinet(type, { x: centerX, y: centerY }, 0);
    const updatedFloorPlan = { ...floorPlan };
    updatedFloorPlan.cabinets.push(newCabinet);
    onFloorPlanChange(updatedFloorPlan);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await uploadImageToDataURL(file);
      const img = new Image();
      img.onload = () => {
        const centerX = width / 2 - panOffset.x;
        const centerY = height / 2 - panOffset.y;
        const maxWidth = 300;
        const maxHeight = 300;
        let imgWidth = img.width;
        let imgHeight = img.height;

        if (imgWidth > maxWidth || imgHeight > maxHeight) {
          const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
          imgWidth *= ratio;
          imgHeight *= ratio;
        }

        const newPhoto: PhotoReference = {
          id: `photo-${Date.now()}`,
          name: file.name,
          url: dataUrl,
          position: { x: centerX - imgWidth / 2, y: centerY - imgHeight / 2 },
          width: imgWidth,
          height: imgHeight,
          opacity: 0.5,
          locked: false,
        };

        const updatedFloorPlan = { ...floorPlan };
        if (!updatedFloorPlan.photos) {
          updatedFloorPlan.photos = [];
        }
        updatedFloorPlan.photos.push(newPhoto);
        onFloorPlanChange(updatedFloorPlan);
        toast.success('Photo added to floor plan!');
      };
      img.src = dataUrl;
    } catch (error) {
      toast.error('Failed to upload photo');
      console.error(error);
    }
  };

  const handleModel3DUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await uploadImageToDataURL(file);
      const centerX = width / 2 - panOffset.x;
      const centerY = height / 2 - panOffset.y;

      const newModel: Model3D = {
        id: `model-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        position: { x: centerX, y: centerY },
        angle: 0,
        scale: 1,
        height: 0,
        modelUrl: dataUrl,
      };

      const updatedFloorPlan = { ...floorPlan };
      if (!updatedFloorPlan.models3D) {
        updatedFloorPlan.models3D = [];
      }
      updatedFloorPlan.models3D.push(newModel);
      onFloorPlanChange(updatedFloorPlan);
      toast.success('3D model added to floor plan!');
    } catch (error) {
      toast.error('Failed to upload 3D model');
      console.error(error);
    }
  };

  const toggleMeasurements = () => {
    const newValue = !showMeasurements;
    setShowMeasurements(newValue);
    const updatedFloorPlan = {
      ...floorPlan,
      metadata: {
        ...floorPlan.metadata!,
        showMeasurements: newValue,
      },
    };
    onFloorPlanChange(updatedFloorPlan);
  };

  const handleSetScale = () => {
    if (!dragStart || !currentPoint || !scaleDistance) {
      toast.error('Please draw a measurement line and enter the real-world distance');
      return;
    }

    const pixels = distance(dragStart, currentPoint);
    const realWorld = parseFloat(scaleDistance);

    if (isNaN(realWorld) || realWorld <= 0) {
      toast.error('Please enter a valid distance');
      return;
    }

    // Calculate new scale (pixels per meter)
    let meters = realWorld;
    switch (scaleUnit) {
      case 'feet':
        meters = realWorld / 3.28084;
        break;
      case 'inches':
        meters = realWorld / 39.3701;
        break;
    }

    const newScale = pixels / meters;

    const updatedFloorPlan = {
      ...floorPlan,
      scaleCalibration: {
        point1: dragStart,
        point2: currentPoint,
        realWorldDistance: realWorld,
        unit: scaleUnit,
      },
      metadata: {
        ...floorPlan.metadata!,
        scale: newScale,
        unit: scaleUnit,
      },
    };

    onFloorPlanChange(updatedFloorPlan);
    toast.success(`Scale set: ${realWorld} ${scaleUnit}`);
    setScaleDistance('');
    setTool('select');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 p-4 bg-muted rounded-lg">
        <Button
          variant={tool === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('select')}
        >
          <Hand className="w-4 h-4 mr-2" />
          Select
        </Button>
        <Button
          variant={tool === 'wall' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('wall')}
        >
          <Move className="w-4 h-4 mr-2" />
          Wall
        </Button>
        <Button
          variant={tool === 'room' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('room')}
        >
          <Square className="w-4 h-4 mr-2" />
          Room
        </Button>
        <Button
          variant={tool === 'door' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('door')}
        >
          <DoorOpen className="w-4 h-4 mr-2" />
          Door
        </Button>
        <Button
          variant={tool === 'window' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('window')}
        >
          <Maximize className="w-4 h-4 mr-2" />
          Window
        </Button>
        <Button
          variant={tool === 'cabinet' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('cabinet')}
        >
          <CookingPot className="w-4 h-4 mr-2" />
          Cabinet
        </Button>
        <Button
          variant={tool === 'measure' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('measure')}
        >
          <Ruler className="w-4 h-4 mr-2" />
          Measure
        </Button>
        <Button
          variant={tool === 'photo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => photoInputRef.current?.click()}
        >
          <ImagePlus className="w-4 h-4 mr-2" />
          Add Photo
        </Button>
        <Button
          variant={tool === 'model3d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => model3DInputRef.current?.click()}
        >
          <Box className="w-4 h-4 mr-2" />
          Add 3D Model
        </Button>
        <Button
          variant={tool === 'delete' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setTool('delete')}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleMeasurements}
        >
          {showMeasurements ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
          {showMeasurements ? 'Hide' : 'Show'} Measurements
        </Button>

        {tool === 'cabinet' && (
          <Select value={cabinetType} onValueChange={(v) => setCabinetType(v as Cabinet['type'])}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base Cabinet</SelectItem>
              <SelectItem value="wall">Wall Cabinet</SelectItem>
              <SelectItem value="tall">Tall Cabinet</SelectItem>
              <SelectItem value="corner">Corner Cabinet</SelectItem>
              <SelectItem value="island">Island Cabinet</SelectItem>
            </SelectContent>
          </Select>
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <input
          ref={model3DInputRef}
          type="file"
          accept=".glb,.gltf"
          onChange={handleModel3DUpload}
          className="hidden"
        />
      </div>

      {tool === 'measure' && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h3 className="font-semibold text-sm">Scale Calibration</h3>
          <p className="text-sm text-muted-foreground">
            Draw a measurement line, then enter its real-world distance to calibrate the scale
          </p>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <Label htmlFor="scale-distance">Distance</Label>
              <Input
                id="scale-distance"
                type="number"
                step="0.1"
                placeholder="10"
                value={scaleDistance}
                onChange={(e) => setScaleDistance(e.target.value)}
              />
            </div>
            <div className="w-[120px]">
              <Label htmlFor="scale-unit">Unit</Label>
              <Select value={scaleUnit} onValueChange={(v) => setScaleUnit(v as any)}>
                <SelectTrigger id="scale-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meters">Meters</SelectItem>
                  <SelectItem value="feet">Feet</SelectItem>
                  <SelectItem value="inches">Inches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleSetScale}>
              Set Scale
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Current scale: {scale.toFixed(2)} pixels per meter ({unit})
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">Quick Add Rooms:</span>
        <Button variant="outline" size="sm" onClick={() => addRoomTemplate('living')}>
          Living Room
        </Button>
        <Button variant="outline" size="sm" onClick={() => addRoomTemplate('bedroom')}>
          Bedroom
        </Button>
        <Button variant="outline" size="sm" onClick={() => addRoomTemplate('kitchen')}>
          Kitchen
        </Button>
        <Button variant="outline" size="sm" onClick={() => addRoomTemplate('bathroom')}>
          Bathroom
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">Quick Add Cabinets:</span>
        <Button variant="outline" size="sm" onClick={() => addCabinet('base')}>
          Base Cabinet
        </Button>
        <Button variant="outline" size="sm" onClick={() => addCabinet('wall')}>
          Wall Cabinet
        </Button>
        <Button variant="outline" size="sm" onClick={() => addCabinet('tall')}>
          Tall Cabinet
        </Button>
        <Button variant="outline" size="sm" onClick={() => addCabinet('island')}>
          Island
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="cursor-crosshair"
          style={{ display: 'block' }}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Use Wall tool to draw walls by clicking and dragging</li>
          <li>Use Room tool to create rectangular rooms</li>
          <li>Click Door/Window tools then click to place</li>
          <li>Click Cabinet tool, select type, then click to place</li>
          <li>Use Measure tool to add custom measurements or calibrate scale</li>
          <li>Use Add Photo to import reference images (floor plans, sketches)</li>
          <li>Use Add 3D Model to place .glb/.gltf models</li>
          <li>Use Select tool to highlight elements</li>
          <li>Use Delete tool to remove elements</li>
          <li>Use Quick Add buttons for preset templates</li>
        </ul>
      </div>
    </div>
  );
}