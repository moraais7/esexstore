import React from "react";
import { Image } from "@/components/ui/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductMedia({ src, alt, className, placeholderLabel = "Foto a importar", fittingType = "fill" }) {
  if (src) {
    return <Image src={src} alt={alt || ""} fittingType={fittingType} className={cn("h-full w-full object-cover", className)} />;
  }
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-clay text-muted-foreground", className)}>
      <ImageIcon className="h-6 w-6" strokeWidth={1.2} />
      <span className="px-4 text-center text-[11px] uppercase tracking-[0.18em]">{placeholderLabel}</span>
    </div>
  );
}