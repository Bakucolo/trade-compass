import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse duration-700">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-card/80 border border-border/50" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-card/80 rounded-md" />
            <div className="h-3 w-64 bg-card/60 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-card/70 rounded-lg" />
          <div className="h-8 w-28 bg-primary/20 rounded-lg" />
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50 border border-border/50 rounded-xl overflow-hidden">
            <CardHeader className="p-3.5 pb-1">
              <div className="h-3 w-20 bg-muted/40 rounded" />
            </CardHeader>
            <CardContent className="p-3.5 pt-1 space-y-1.5">
              <div className="h-6 w-28 bg-muted/60 rounded-md" />
              <div className="h-2.5 w-16 bg-muted/30 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Area / Table Skeleton */}
      <Card className="bg-card/50 border border-border/50 rounded-2xl overflow-hidden p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="h-4 w-32 bg-muted/50 rounded" />
          <div className="h-7 w-48 bg-muted/40 rounded-lg" />
        </div>
        <div className="space-y-2.5 pt-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-full bg-accent/20 rounded-lg border border-border/30 flex items-center justify-between px-4"
            >
              <div className="h-3.5 w-24 bg-muted/40 rounded" />
              <div className="h-3.5 w-16 bg-muted/30 rounded" />
              <div className="h-3.5 w-20 bg-muted/40 rounded" />
              <div className="h-3.5 w-12 bg-muted/30 rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
