"use client";

import { buttonVariants } from "@egocapture/ui/components/button";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import Link from "next/link";
import { memo, type MouseEvent } from "react";

export const MagneticLink = memo(function MagneticLink({ href, children }: { href: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 280, damping: 22, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 280, damping: 22, mass: 0.6 });

  function move(event: MouseEvent<HTMLAnchorElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set((event.clientX - rect.left - rect.width / 2) * 0.12);
    rawY.set((event.clientY - rect.top - rect.height / 2) * 0.12);
  }

  function reset() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div style={{ x, y }}>
      <Link href={href} onMouseMove={move} onMouseLeave={reset} className={buttonVariants({ className: "" })}>
        {children}
      </Link>
    </motion.div>
  );
});
