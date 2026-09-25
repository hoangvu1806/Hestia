"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const EDGE_INSET = 4;
const MIN_THUMB_HEIGHT = 52;

type ScrollbarState = {
  maxScroll: number;
  thumbHeight: number;
  thumbTop: number;
  visible: boolean;
};

export function PageScrollbar() {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerY: number; scrollY: number } | null>(null);
  const [state, setState] = useState<ScrollbarState>({
    maxScroll: 0,
    thumbHeight: MIN_THUMB_HEIGHT,
    thumbTop: 0,
    visible: false,
  });

  const measure = useCallback(() => {
    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = Math.max(0, pageHeight - viewportHeight);
    const railHeight = Math.max(0, viewportHeight - EDGE_INSET * 2);
    const thumbHeight = Math.min(
      railHeight,
      Math.max(MIN_THUMB_HEIGHT, railHeight * (viewportHeight / pageHeight)),
    );
    const travel = Math.max(0, railHeight - thumbHeight);
    const thumbTop = maxScroll > 0 ? (window.scrollY / maxScroll) * travel : 0;

    setState({ maxScroll, thumbHeight, thumbTop, visible: maxScroll > 1 });
  }, []);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(measure);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    function move(event: PointerEvent) {
      if (!drag.current || !rail.current) return;
      const travel = rail.current.clientHeight - state.thumbHeight;
      if (travel <= 0) return;
      const scrollPerPixel = state.maxScroll / travel;
      window.scrollTo({
        top: drag.current.scrollY + (event.clientY - drag.current.pointerY) * scrollPerPixel,
      });
    }

    function stop() {
      drag.current = null;
      document.documentElement.classList.remove("is-dragging-scrollbar");
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [state.maxScroll, state.thumbHeight]);

  if (!state.visible) return null;

  return (
    <div
      aria-hidden="true"
      className="page-scrollbar"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || !rail.current) return;
        const bounds = rail.current.getBoundingClientRect();
        const travel = rail.current.clientHeight - state.thumbHeight;
        if (travel <= 0) return;
        const target = Math.min(
          travel,
          Math.max(0, event.clientY - bounds.top - state.thumbHeight / 2),
        );
        window.scrollTo({ top: (target / travel) * state.maxScroll, behavior: "smooth" });
      }}
      ref={rail}
    >
      <span
        className="page-scrollbar-thumb"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          drag.current = { pointerY: event.clientY, scrollY: window.scrollY };
          document.documentElement.classList.add("is-dragging-scrollbar");
        }}
        style={{ height: state.thumbHeight, transform: `translateY(${state.thumbTop}px)` }}
      />
    </div>
  );
}
