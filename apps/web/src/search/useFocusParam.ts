import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// When the URL carries ?focus=<id> and the module's data has loaded, call
// onFocus(entity) for the matching id, then strip the param so it does not
// re-fire on reload or back-navigation. An id that matches nothing (once
// loaded) just clears the param.
export function useFocusParam<T extends { id: string }>(
  entities: T[],
  loading: boolean,
  onFocus: (entity: T) => void,
): void {
  const [params, setParams] = useSearchParams();
  const focus = params.get("focus");
  useEffect(() => {
    if (focus === null || loading) return;
    const entity = entities.find((e) => e.id === focus);
    if (entity) onFocus(entity);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("focus");
      return next;
    }, { replace: true });
  }, [focus, loading, entities]); // params/setParams/onFocus intentionally excluded — focus drives re-runs
  // Contract: onFocus is invoked once when focus is set; callers needn't memoize it.
}
