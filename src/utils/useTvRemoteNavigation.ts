import { useEffect, useCallback } from 'react';

export interface UseTvRemoteNavigationOptions {
  /** CSS selector for focusable items. Defaults to standard interactive elements. */
  selector?: string;
  /** Whether navigation is currently active. */
  active?: boolean;
  /** Container ref to search focusable items within. Defaults to document. */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Automatically focus the first item when ready. */
  autoFocus?: boolean;
  /** Ref to a specific element to focus initially. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Custom hook providing robust TV remote D-pad spatial navigation for TV web apps.
 * Catches ArrowUp, ArrowDown, ArrowLeft, ArrowRight and Enter/OK on the capture phase,
 * preventing default page scrolling and smoothly moving focus between 2D UI elements.
 */
export function useTvRemoteNavigation({
  selector = 'button:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"]:not([aria-disabled="true"]), a[href]',
  active = true,
  containerRef,
  autoFocus = true,
  initialFocusRef,
}: UseTvRemoteNavigationOptions = {}) {
  const getFocusables = useCallback((): HTMLElement[] => {
    const root = containerRef?.current || document;
    const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
    return elements.filter(el => {
      // Must be visible, not disabled, and not display:none
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      return el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });
  }, [containerRef, selector]);

  // Initial focus setup
  useEffect(() => {
    if (!active) return;

    const timer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      if (autoFocus) {
        const focusables = getFocusables();
        if (focusables.length > 0) {
          const current = document.activeElement;
          if (!current || current === document.body || !focusables.includes(current as HTMLElement)) {
            focusables[0].focus();
          }
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [active, autoFocus, getFocusables, initialFocusRef]);

  // Handle D-pad navigation
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const keyCode = (e as any).keyCode;
      const isArrow = key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
      const isAction = key === 'Enter' || key === ' ' || keyCode === 23 || keyCode === 66 || keyCode === 160;

      if (!isArrow && !isAction) return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;

      const current = document.activeElement as HTMLElement | null;
      const currentIndex = current ? focusables.indexOf(current) : -1;

      // Handle Enter/OK action on focused item
      if (isAction) {
        if (current && focusables.includes(current)) {
          // If it's a div role=button, trigger click
          if (current.tagName !== 'BUTTON' && current.tagName !== 'A') {
            e.preventDefault();
            e.stopPropagation();
            current.click();
          }
          return;
        } else if (focusables.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          focusables[0].focus();
          return;
        }
      }

      if (isArrow) {
        // ALWAYS prevent default page scrolling when arrow keys are pressed on TV
        e.preventDefault();
        e.stopPropagation();

        if (!current || currentIndex === -1) {
          focusables[0].focus();
          focusables[0].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          return;
        }

        const rectA = current.getBoundingClientRect();
        const centerAX = rectA.left + rectA.width / 2;
        const centerAY = rectA.top + rectA.height / 2;

        let bestCandidate: HTMLElement | null = null;
        let bestScore = Infinity;

        for (const candidate of focusables) {
          if (candidate === current) continue;

          const rectB = candidate.getBoundingClientRect();
          const centerBX = rectB.left + rectB.width / 2;
          const centerBY = rectB.top + rectB.height / 2;

          let isCandidate = false;
          let primaryDist = 0;
          let secondaryDist = 0;

          switch (key) {
            case 'ArrowDown':
              if (centerBY > centerAY + 15) {
                isCandidate = true;
                primaryDist = centerBY - centerAY;
                secondaryDist = Math.abs(centerBX - centerAX);
              }
              break;
            case 'ArrowUp':
              if (centerBY < centerAY - 15) {
                isCandidate = true;
                primaryDist = centerAY - centerBY;
                secondaryDist = Math.abs(centerBX - centerAX);
              }
              break;
            case 'ArrowRight':
              if (centerBX > centerAX + 15) {
                isCandidate = true;
                primaryDist = centerBX - centerAX;
                secondaryDist = Math.abs(centerBY - centerAY);
              }
              break;
            case 'ArrowLeft':
              if (centerBX < centerAX - 15) {
                isCandidate = true;
                primaryDist = centerAX - centerBX;
                secondaryDist = Math.abs(centerBY - centerAY);
              }
              break;
          }

          if (isCandidate) {
            // Strongly penalize perpendicular drift so movement prefers aligned cards
            const score = primaryDist + secondaryDist * 2.5;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = candidate;
            }
          }
        }

        // Fallback: wrap-around or step to next/prev index if no 2D candidate
        if (!bestCandidate) {
          if (key === 'ArrowDown' || key === 'ArrowRight') {
            const nextIdx = (currentIndex + 1) % focusables.length;
            bestCandidate = focusables[nextIdx];
          } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
            const prevIdx = (currentIndex - 1 + focusables.length) % focusables.length;
            bestCandidate = focusables[prevIdx];
          }
        }

        if (bestCandidate) {
          bestCandidate.focus();
          bestCandidate.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [active, getFocusables]);
}
