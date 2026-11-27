import type { ReactNode } from "react";
import { LazyMotion, useReducedMotion } from "motion/react";
import { div as MotionDiv } from "motion/react-m";
const loadFeatures = () =>
  import("./motion-features").then((module) => module.default);

// Restrained entrance inspired by Aceternity's text/blur reveals; content is visible without JS animation.
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={loadFeatures}>
      <MotionDiv
        className={className}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        whileInView={reduce ? undefined : { y: [8, 0], opacity: [0.8, 1] }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {children}
      </MotionDiv>
    </LazyMotion>
  );
}
