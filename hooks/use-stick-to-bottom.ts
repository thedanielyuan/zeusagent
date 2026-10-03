import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** How close to the bottom (in px) still counts as "at the bottom". */
const THRESHOLD = 32;

/**
 * Keeps a scroll container pinned to the bottom while its content grows (e.g. a streaming
 * reply), until the user scrolls up to read. Scrolling back down re-pins it.
 */
export function useStickToBottom() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    pinned.current = true;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const distanceFromBottom = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    let lastScrollTop = scroller.scrollTop;

    const onScroll = () => {
      const atBottom = distanceFromBottom() <= THRESHOLD;
      // Only scrolling up releases the pin. Programmatic scrolls and growing content only ever
      // move the position down, so they can't accidentally unpin.
      if (atBottom) pinned.current = true;
      else if (scroller.scrollTop < lastScrollTop) pinned.current = false;
      lastScrollTop = scroller.scrollTop;
      setIsAtBottom(atBottom);
    };

    const onResize = () => {
      if (pinned.current) scroller.scrollTop = scroller.scrollHeight;
      setIsAtBottom(distanceFromBottom() <= THRESHOLD);
    };

    scroller.scrollTop = scroller.scrollHeight;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onResize);
    observer.observe(content);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return { scrollRef, contentRef, isAtBottom, scrollToBottom };
}
