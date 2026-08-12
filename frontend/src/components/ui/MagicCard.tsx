import React, { useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    gradientSize?: number;
    gradientColor?: string;
    gradientOpacity?: number;
}

export function MagicCard({
    children,
    className,
    gradientSize = 250,
    gradientColor = '#9333ea',
    gradientOpacity = 0.5,
    ...props
}: MagicCardProps) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({
        currentTarget,
        clientX,
        clientY,
    }: React.MouseEvent<HTMLDivElement>) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <div
            onMouseMove={handleMouseMove}
            className={cn(
                "group relative flex size-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300",
                className
            )}
            {...props}
        >
            {/* Spotlight effect background */}
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
            radial-gradient(
              ${gradientSize}px circle at ${mouseX}px ${mouseY}px,
              rgba(147, 51, 234, 0.2),
              rgba(59, 130, 246, 0.15),
              rgba(236, 72, 153, 0.1),
              transparent 80%
            )
          `,
                }}
            />

            {/* Rainbow border effect */}
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100 z-10"
                style={{
                    background: useMotionTemplate`
            radial-gradient(
              ${gradientSize / 1.5}px circle at ${mouseX}px ${mouseY}px,
              #9333ea,
              #3b82f6,
              #10b981,
              #f59e0b,
              #ef4444,
              transparent 100%
            )
          `,
                    maskImage: 'radial-gradient(circle at center, transparent 96%, black 100%)',
                    WebkitMaskImage: 'radial-gradient(circle at center, transparent 96% , black 100%)',
                    padding: '2px', // Slightly thicker for vibrant effect
                }}
            />

            {/* Content wrapper to ensure it stays above the spot background but below the border if needed */}
            <div className="relative z-0 size-full">
                {children}
            </div>
        </div>
    );
}
