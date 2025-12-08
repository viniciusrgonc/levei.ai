import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-3 w-20 mt-2" />
      </CardContent>
    </Card>
  );
}

export function DeliveryCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 mt-1" />
              <div className="flex-1">
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 mt-1" />
              <div className="flex-1">
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="text-right shrink-0 ml-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-12 mt-1" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DeliveryListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <DeliveryCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DriverDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent>
          <DeliveryListSkeleton count={2} />
        </CardContent>
      </Card>
    </div>
  );
}

export function RestaurantDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent>
          <DeliveryListSkeleton count={3} />
        </CardContent>
      </Card>
    </div>
  );
}
