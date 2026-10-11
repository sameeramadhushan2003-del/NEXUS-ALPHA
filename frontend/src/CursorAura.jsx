

import React, { useEffect, useRef } from "react";


export default function CursorAura() {
  const glowRef = useRef(null);

  useEffect(() => {
    const glow = glowRef.current;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const touchDevice = window.matchMedia(
      "(pointer: coarse)"
    ).matches;

    if (!glow || reducedMotion || touchDevice) {
      return;
    }

    let frame = 0;
    let x = -1000;
    let y = -1000;

    const moveGlow = (event) => {
      x = event.clientX - 230;
      y = event.clientY - 230;

      if (frame) return;

      frame = requestAnimationFrame(() => {
        glow.style.transform =
          `translate3d(${x}px, ${y}px, 0)`;

        frame = 0;
      });
    };

    window.addEventListener(
      "pointermove",
      moveGlow,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        moveGlow
      );

      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div
        className="nexus-ambient-layer"
        aria-hidden="true"
      />

      <div
        ref={glowRef}
        className="nexus-cursor-layer"
        aria-hidden="true"
      />
    </>
  );
}
