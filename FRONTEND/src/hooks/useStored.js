import { useEffect, useRef, useState } from "react";
import api from "../services/api.js";

export function useStored(key, initial, collection = null, enabled = true) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : initial;
    } catch {
      return initial;
    }
  });
  const valueRef = useRef(value);
  const changedBeforeLoad = useRef(false);
  const loadingRef = useRef(false);
  useEffect(() => {
    const syncFromOtherTab = (event) => {
      if (event.key !== key) return;
      try {
        setValue(
          event.newValue === null ? initial : JSON.parse(event.newValue),
        );
      } catch {
        setValue(initial);
      }
    };
    window.addEventListener("storage", syncFromOtherTab);
    return () => window.removeEventListener("storage", syncFromOtherTab);
  }, [key, initial]);
  const [databaseReady, setDatabaseReady] = useState(!collection);
  useEffect(() => {
    if (!collection) return undefined;
    if (!enabled) return undefined;
    let active = true;
    loadingRef.current = true;
    api
      .getCollection(collection)
      .then((records) => {
        if (!active) return;
        if (changedBeforeLoad.current) {
          return api.saveCollection(collection, valueRef.current);
        } else if (records.length) {
          valueRef.current = records;
          setValue(records);
          try {
            localStorage.setItem(key, JSON.stringify(records));
          } catch {
            /* local cache is optional */
          }
        } else {
          // PostgreSQL is authoritative when a collection is empty; do not
          // restore deleted activities or enrollments from an old browser cache.
          const initialRecords = [];
          valueRef.current = initialRecords;
          setValue(initialRecords);
          try {
            localStorage.setItem(key, JSON.stringify(initialRecords));
          } catch {
            /* local cache is optional */
          }
          return api.saveCollection(collection, initialRecords);
        }
      })
      .catch((error) =>
        console.error(
          `Could not load ${collection} from the database:`,
          error.message,
        ),
      )
      .finally(() => {
        if (active) {
          loadingRef.current = false;
          setDatabaseReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [collection, enabled, initial, key]);
  useEffect(() => {
    if (!collection || !enabled || loadingRef.current || !databaseReady) return;
    const timer = window.setTimeout(() => {
      api
        .saveCollection(collection, value)
        .catch((error) =>
          console.error(
            `Could not save ${collection} to the database:`,
            error.message,
          ),
        );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [collection, databaseReady, enabled, value]);
  const set = (next) => {
    if (collection && !databaseReady) changedBeforeLoad.current = true;
    valueRef.current = next;
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return [value, set];
}
