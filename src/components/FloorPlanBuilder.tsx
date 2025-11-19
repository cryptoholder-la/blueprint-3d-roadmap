"use client";

import React, { useState } from 'react';
import { FloorPlan } from '@/lib/floorplan-types';
import { createDefaultFloorPlan, exportFloorPlan, importFloorPlan } from '@/lib/floorplan-utils';
import FloorPlan2DEditor from './FloorPlan2DEditor';
import FloorPlan3DViewer from './FloorPlan3DViewer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Download, Upload, Eye, PenTool, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FloorPlanBuilder() {
  const [floorPlan, setFloorPlan] = useState<FloorPlan>(createDefaultFloorPlan());
  const [activeView, setActiveView] = useState<'2d' | '3d'>('2d');

  const handleFloorPlanChange = (updatedFloorPlan: FloorPlan) => {
    setFloorPlan({
      ...updatedFloorPlan,
      metadata: {
        ...updatedFloorPlan.metadata!,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleExport = () => {
    const jsonString = exportFloorPlan(floorPlan);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${floorPlan.name.replace(/\s+/g, '-')}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Floor plan exported successfully!');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const importedFloorPlan = importFloorPlan(jsonString);
        setFloorPlan(importedFloorPlan);
        toast.success('Floor plan imported successfully!');
      } catch (error) {
        toast.error('Failed to import floor plan. Invalid file format.');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the floor plan?')) {
      setFloorPlan(createDefaultFloorPlan());
      toast.success('Floor plan cleared');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Floor Plan Builder</h1>
            <p className="text-muted-foreground mt-1">
              Create and visualize 2D floor plans in photo-realistic 3D with measurements
            </p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as '2d' | '3d')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="2d" className="flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              2D Editor
            </TabsTrigger>
            <TabsTrigger value="3d" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              3D View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="2d" className="mt-0">
            <FloorPlan2DEditor
              floorPlan={floorPlan}
              onFloorPlanChange={handleFloorPlanChange}
              width={800}
              height={600}
            />
          </TabsContent>

          <TabsContent value="3d" className="mt-0">
            <FloorPlan3DViewer
              floorPlan={floorPlan}
              width={800}
              height={600}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Floor Plan Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Walls</p>
              <p className="text-2xl font-bold">{floorPlan.walls.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rooms</p>
              <p className="text-2xl font-bold">{floorPlan.rooms.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Doors</p>
              <p className="text-2xl font-bold">{floorPlan.doors.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Windows</p>
              <p className="text-2xl font-bold">{floorPlan.windows.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cabinets</p>
              <p className="text-2xl font-bold">{floorPlan.cabinets.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">3D Models</p>
              <p className="text-2xl font-bold">{floorPlan.models3D?.length || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Photos</p>
              <p className="text-2xl font-bold">{floorPlan.photos?.length || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Measurements</p>
              <p className="text-2xl font-bold">{floorPlan.measurements?.length || 0}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Scale: {floorPlan.metadata?.scale?.toFixed(2) || '20.00'} pixels per meter | 
              Unit: {floorPlan.metadata?.unit || 'meters'} | 
              Measurements: {floorPlan.metadata?.showMeasurements ? 'Visible' : 'Hidden'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}