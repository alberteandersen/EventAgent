"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { AnimatePresence, motion, type MotionProps } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations: MotionProps = {
    initial: { y: 16, scale: 0.97 },
    animate: { y: 0, scale: 1 },
    exit: { y: -10, scale: 0.98 },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  };

  return (
    <motion.div {...animations} layout="position" className="mx-auto w-full will-change-transform">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  delay?: number;
  loop?: boolean;
  loopPause?: number;
}

function getChildKey(item: React.ReactNode, fallback: number) {
  if (React.isValidElement(item) && item.key != null) {
    return String(item.key);
  }
  return String(fallback);
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 1000, loop = false, loopPause = 3000, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children]
    );
    const itemCount = childrenArray.length;

    useEffect(() => {
      if (itemCount === 0) return;

      let timeout: ReturnType<typeof setTimeout> | null = null;
      const atEnd = index >= itemCount - 1;

      if (!atEnd) {
        timeout = setTimeout(() => {
          setIndex((prevIndex) => prevIndex + 1);
        }, delay);
      } else if (loop) {
        timeout = setTimeout(() => {
          setIndex(0);
        }, loopPause);
      }

      return () => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }
      };
    }, [index, delay, loop, loopPause, itemCount]);

    const itemsToShow = useMemo(() => {
      if (itemCount === 0) return [];
      return childrenArray.slice(0, index + 1).reverse();
    }, [index, childrenArray, itemCount]);

    return (
      <div
        className={cn("flex flex-col items-center gap-4", className)}
        {...props}
      >
        <AnimatePresence mode="sync">
          {itemsToShow.map((item, i) => (
            <AnimatedListItem key={getChildKey(item, itemCount - 1 - i)}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedList.displayName = "AnimatedList";
