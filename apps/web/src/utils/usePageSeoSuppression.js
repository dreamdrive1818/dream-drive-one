// src/utils/usePageSeoSuppression.js
import { useEffect } from "react";
import { useLocalContext } from "../context/LocalContext";

/** Suppress global SeoDefaults while this page is mounted */
export const usePageSeoSuppression = (enabled = true) => {
  const { setSuppressSeo } = useLocalContext();
  useEffect(() => {
    if (enabled) setSuppressSeo(true);
    return () => setSuppressSeo(false);
  }, [enabled, setSuppressSeo]);
};
