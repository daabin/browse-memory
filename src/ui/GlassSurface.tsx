import type { HTMLAttributes } from "react";

import { cn } from "./utils";

export function GlassSurface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-surface", className)} {...props} />;
}
