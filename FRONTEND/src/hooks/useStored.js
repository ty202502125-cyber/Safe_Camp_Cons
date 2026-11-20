import { useEffect, useRef, useState } from "react";
import api from "../services/api.js";

export function useStored(key, initial, collection = null) {
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
    let active = true;
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
          // PostgreSQL is authoritative when a collection is empty. Only use
          // the seed user to initialize a brand-new database; do not restore
          // deleted activities or enrollments from an old browser cache.
          const initialRecords = collection === "users" ? initial : [];
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
        if (active) setDatabaseReady(true);
      });
    return () => {
      active = false;
    };
  }, [collection, initial, key]);
  useEffect(() => {
    if (!collection || !databaseReady) return;
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
  }, [collection, databaseReady, value]);
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
