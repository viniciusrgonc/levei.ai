import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function ProfileMenuSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4 ml-auto" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <ProfileHeaderSkeleton />
      <ProfileMenuSkeleton />
    </div>
  );
}
