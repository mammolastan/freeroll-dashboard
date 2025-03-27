// components/ui/tooltip.tsx

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TooltipPrimitive.Trigger
        ref={ref}
        className={cn("focus:outline-none", className)}
        {...props}
    />
))
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
            "z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-gray-50 max-w-[70%] whitespace-normal break-words",
            className
        )}
        {...props}
    />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// A mobile-friendly tooltip trigger wrapper
function MobileTooltipTrigger({
    children,
    content,
    className,
    ...tooltipProps
}: {
    children: React.ReactNode;
    content: React.ReactNode;
    className?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof TooltipRoot>, "children">) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Close tooltip when clicking outside
    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = () => setIsOpen(false);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <TooltipRoot
            open={isOpen}
            onOpenChange={setIsOpen}
            delayDuration={0}
            {...tooltipProps}
        >
            <TooltipTrigger
                asChild
                onClick={(e) => {
                    // Prevent the click from bubbling up and triggering the document click handler
                    e.stopPropagation();
                    setIsOpen(prev => !prev);
                }}
            >
                <span className={cn("cursor-help", className)}>
                    {children}
                </span>
            </TooltipTrigger>
            <TooltipContent onClick={(e) => e.stopPropagation()}>
                {content}
            </TooltipContent>
        </TooltipRoot>
    );
}

export {
    TooltipRoot,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
    MobileTooltipTrigger
}