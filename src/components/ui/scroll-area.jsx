import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils-ui";
const ScrollArea=React.forwardRef(function ScrollArea({className,children,...props},ref){return <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden",className)} {...props}><ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport><ScrollBar/><ScrollAreaPrimitive.Corner/></ScrollAreaPrimitive.Root>;});
ScrollArea.displayName=ScrollAreaPrimitive.Root.displayName;
const ScrollBar=React.forwardRef(function ScrollBar({className,orientation="vertical",...props},ref){return <ScrollAreaPrimitive.Scrollbar ref={ref} orientation={orientation} className={cn("flex touch-none select-none p-0.5 transition-colors",orientation==="vertical"&&"h-full w-2.5 border-l border-l-transparent",orientation==="horizontal"&&"h-2.5 flex-col border-t border-t-transparent",className)} {...props}><ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border"/></ScrollAreaPrimitive.Scrollbar>;});
ScrollBar.displayName=ScrollAreaPrimitive.Scrollbar.displayName;
export {ScrollArea,ScrollBar};
