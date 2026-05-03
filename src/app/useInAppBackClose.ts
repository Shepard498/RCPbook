import { useEffect, useRef } from "react";

const mobileBackQuery = "(max-width: 720px)";

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

    if (!window.matchMedia(mobileBackQuery).matches || isArmedRef.current) {
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

    function handlePopState() {
      if (!isArmedRef.current || !activeRef.current) {
        return;
      }

      isArmedRef.current = false;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [active, key]);
}
