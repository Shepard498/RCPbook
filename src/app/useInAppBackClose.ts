import { useEffect, useRef } from "react";
import { isAndroidApp } from "./platform";

const mobileBackQuery = "(max-width: 720px)";
const closeTargets: object[] = [];
const handledEvents = new WeakSet<PopStateEvent>();

export function useInAppBackClose(active: boolean, onClose: () => void, key: string) {
  const activeRef = useRef(active);
  const onCloseRef = useRef(onClose);
  const isArmedRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
    onCloseRef.current = onClose;
  }, [active, onClose]);

  useEffect(() => {
    if (!active) {
      isArmedRef.current = false;
      return undefined;
    }

    if ((!isAndroidApp && !window.matchMedia(mobileBackQuery).matches) || isArmedRef.current) {
      return undefined;
    }

    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        recipeAppCloseTarget: key,
      },
      "",
      window.location.href,
    );
    isArmedRef.current = true;

    const target = {};
    closeTargets.push(target);

    function handlePopState(event: PopStateEvent) {
      // Only the topmost surface should consume Back, preserving any editor underneath.
      if (handledEvents.has(event) || closeTargets.at(-1) !== target || !isArmedRef.current || !activeRef.current) {
        return;
      }

      handledEvents.add(event);
      isArmedRef.current = false;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      const index = closeTargets.indexOf(target);
      if (index !== -1) closeTargets.splice(index, 1);
      isArmedRef.current = false;
    };
  }, [active, key]);
}
