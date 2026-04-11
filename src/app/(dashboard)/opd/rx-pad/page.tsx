import { Suspense } from "react";
import { RxPad } from "./rx-pad-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Rx Pad · HIS" };

export default function RxPadPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <RxPad />
    </Suspense>
  );
}
