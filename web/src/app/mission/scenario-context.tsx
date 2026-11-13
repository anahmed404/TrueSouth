import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useStore } from "zustand";
import { useManifest, useProfiles, useSites } from "../../data/hooks";
import {
  bindScenarioUrl,
  browserScenarioHistory,
  createScenarioStore,
  writeScenarioQuery,
  type ScenarioCatalog,
  type ScenarioState,
  type ScenarioStore,
} from "../../state/scenario";
import { throttledHistory } from "./throttled-history";

const ScenarioContext = createContext<ScenarioStore | null>(null);

/** The Mission Control scenario store. Only inside `ScenarioProvider`. */
export function useScenarioStore(): ScenarioStore {
  const store = useContext(ScenarioContext);
  if (!store) throw new Error("useScenarioStore must be used inside ScenarioProvider");
  return store;
}

/**
 * One slice of the scenario. Pass a narrow selector (`(s) => s.landingUtc`), so a panel
 * re-renders only when what it shows changes: a scrub of the current time must not
 * re-render the sites rail.
 */
export function useScenario<T>(selector: (state: ScenarioState) => T): T {
  return useStore(useScenarioStore(), selector);
}

/**
 * Provides an existing store, without loading data or binding the address bar: for tests of
 * the shell's parts.
 */
export function ScenarioStoreProvider({ store, children }: { store: ScenarioStore; children: ReactNode }) {
  return <ScenarioContext value={store}>{children}</ScenarioContext>;
}

type ScenarioProviderProps = {
  children: ReactNode;
  /** Shown until the manifest, `sites.json` and `profiles.json` have loaded. */
  loading: ReactNode;
  error: (message: string) => ReactNode;
};

/**
 * Builds the store once the catalog has loaded, from the link the page was opened with,
 * and keeps the address bar and the store equal from then on.
 */
export function ScenarioProvider({ children, loading, error }: ScenarioProviderProps) {
  const manifest = useManifest();
  const sites = useSites();
  const profiles = useProfiles();

  for (const result of [manifest, sites, profiles]) {
    if (result.status === "error") return <>{error(result.error)}</>;
  }
  if (manifest.status !== "ready" || sites.status !== "ready" || profiles.status !== "ready") return <>{loading}</>;
  if (profiles.data.length === 0) return <>{error("profiles.json lists no mission profiles.")}</>;

  return (
    <BoundStore catalog={{ profiles: profiles.data, sites: sites.data, grid: manifest.data.time_grid }}>
      {children}
    </BoundStore>
  );
}

function BoundStore({ catalog, children }: { catalog: ScenarioCatalog; children: ReactNode }) {
  // Read the link once, on load. Back and Forward are applied by `bindScenarioUrl`.
  const [store] = useState(() => createScenarioStore(catalog, window.location.search));

  useEffect(() => {
    const history = throttledHistory(browserScenarioHistory());
    const unbind = bindScenarioUrl(store, history);
    // Before anything can navigate, write the last waiting replace to this page's entry, so
    // the link is never behind: on a click (in the capture phase, before the router's own
    // handler on a link) and when the page is hidden or closed.
    document.addEventListener("click", history.flush, true);
    window.addEventListener("pagehide", history.flush);
    return () => {
      document.removeEventListener("click", history.flush, true);
      window.removeEventListener("pagehide", history.flush);
      // By now the router may have moved to another page: `flush` writes only if the
      // browser is still on the entry the replace was meant for, and drops it otherwise.
      history.flush();
      unbind();
    };
  }, [store]);

  // A router navigation inside the app (the "Mission Control" mode link, or a link from
  // the Academy) changes the address without a popstate. A bare /mission keeps the
  // current scenario; a link with a query loads that scenario.
  const location = useLocation();
  const seen = useRef(location.key);
  useEffect(() => {
    if (seen.current === location.key) return;
    seen.current = location.key;
    const search = location.search.replace(/^\?/, "");
    const current = writeScenarioQuery(store.getState());
    if (search === current) return;
    if (search === "") {
      window.history.replaceState(window.history.state, "", `${location.pathname}?${current}${location.hash}`);
      return;
    }
    store.getState().applySearch(location.search);
  }, [location.key, location.search, location.pathname, location.hash, store]);

  return <ScenarioContext value={store}>{children}</ScenarioContext>;
}
