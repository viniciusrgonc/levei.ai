import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletBalanceSkeleton() {
  return (
    <Card className="bg-gradient-to-br from-primary to-primary/80">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-24 bg-primary-foreground/20" />
            <Skeleton className="h-10 w-32 mt-2 bg-primary-foreground/20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-full bg-primary-foreground/20" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TransactionItemSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <WalletBalanceSkeleton />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <TransactionListSkeleton count={4} />
        </CardContent>
      </Card>
    </div>
  );
}
