"use client";

import FloorPlanBuilder from '@/components/FloorPlanBuilder';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Toaster />
      <FloorPlanBuilder />
    </div>
  );
}