import { GripVertical, MapPin, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import type { MissionProfile, Site } from "../../contracts/generated";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { cx, formatNumber, formatUtc } from "../../components/format";
import { Panel } from "../../components/Panel";
import { Popover } from "../../components/Popover";
import { StatusBadge, StatusLamp } from "../../components/StatusLamp";
import { Tip } from "../../components/Tip";
import { useStore } from "zustand";
import { useCatalogSites, useSites } from "../../data/hooks";
import { isCustomSiteId } from "../../data/paths";
import { customSitesStore, isLocalKey, type CustomEntry } from "../../state/custom-sites";
import { MAX_SITES } from "../../state/scenario";
import { removeCustomSite } from "./custom-site-actions";
import { COMPUTING_TEXT, NOT_COMPUTED_TEXT, YOUR_SITE_TAG } from "./custom-site-row";
import { CustomCoordinates, CustomPendingRow } from "./custom-site-ui";
import { CHOSEN_TAG, isVariant, pickerOrder, variantLine } from "./site-labels";
import { dropIndex, moveById, moveItem } from "./reorder";
import { moreBroken, railFact, scoreTitle, worstBrokenVeto } from "./rules";
import { useScenario, useScenarioStore } from "./scenario-context";
import { SHELL_SHORTCUTS } from "./shell-layout";
import { NO_RESULT_TEXT, isSphere, siteName, useSiteStatus, type SiteStatus } from "./site-status";

type SitesRailProps = {
  collapsed: boolean;
  onToggle: () => void;
  regionRef?: Ref<HTMLElement>;
  toggleRef?: Ref<HTMLButtonElement>;
};

const REGION_ID = "sites-rail";

/**
 * The left rail: the selected sites, each with its status for the landing date. It reads
 * the sites, the focused site, the profile and the landing date, never the current time.
 * Collapsed, it keeps a slim column of status lamps, and each lamp still focuses its site.
 */
export const SitesRail = memo(function SitesRail({ collapsed, onToggle, regionRef, toggleRef }: SitesRailProps) {
  const siteIds = useScenario((s) => s.siteIds);
  const focusedSiteId = useScenario((s) => s.focusedSiteId);
  const profile = useScenario((s) => s.profile);
  const landingUtc = useScenario((s) => s.landingUtc);
  const sites = useSites();
  const catalog = sites.status === "ready" ? sites.data : null;
  const byId = useCallback((id: string): Site | null => catalog?.find((s) => s.id === id) ?? null, [catalog]);
  const toggleLabel = collapsed ? "Show the sites rail" : "Hide the sites rail";
  const entries = useStore(customSitesStore, (state) => state.entries);
  const local = Object.values(entries).filter((entry) => isLocalKey(entry.key));
  useCustomSitesInScenario(siteIds);

  return (
    <Panel as="aside" ref={regionRef} id={REGION_ID} aria-label="Selected sites" className="shell-rail" data-collapsed={collapsed}>
      <div className="rail-head">
        {collapsed ? null : (
          <h2 className="rail-title">
            <Explain term="selected_sites">Selected sites</Explain>
          </h2>
        )}
        {collapsed ? null : (
          <span className="rail-count">
            {siteIds.length + local.length} of {MAX_SITES}
          </span>
        )}
        <IconButton
          ref={toggleRef}
          label={toggleLabel}
          hint={`· shortcut ${SHELL_SHORTCUTS.sitesRail}`}
          aria-expanded={!collapsed}
          aria-controls={`${REGION_ID}-body`}
          aria-keyshortcuts={SHELL_SHORTCUTS.sitesRail}
          icon={collapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
          onClick={onToggle}
          className="shell-toggle"
        />
      </div>

      <div id={`${REGION_ID}-body`} className="rail-body">
        {collapsed ? (
          <>
            <ul className="rail-lamps" aria-label="Site status">
              {siteIds.map((id) => (
                <RailLamp
                  key={id}
                  siteId={id}
                  name={siteName(byId(id), id)}
                  profile={profile}
                  landingUtc={landingUtc}
                  focused={id === focusedSiteId}
                  pending={pendingEntry(id, entries) ?? (isCustomSiteId(id) && !byId(id) ? placeholderEntry(id) : null)}
                />
              ))}
              {local.map((entry) => (
                <li key={entry.key}>
                  <span
                    className="rail-lamp rail-lamp-static"
                    role="img"
                    aria-label={`${entry.name ?? "Custom site"}, ${entry.phase === "failed" ? "could not be computed" : "computing"}`}
                  >
                    <span className={cx("lamp-none", entry.phase !== "failed" && "lamp-busy")} aria-hidden="true" />
                  </span>
                </li>
              ))}
            </ul>
            <AddSite selected={siteIds} pendingCount={local.length} compact />
          </>
        ) : (
          <SiteList
            siteIds={siteIds}
            focusedSiteId={focusedSiteId}
            profile={profile}
            landingUtc={landingUtc}
            byId={byId}
            entries={entries}
            local={local}
          />
        )}
      </div>
    </Panel>
  );
});

type SiteListProps = {
  siteIds: readonly string[];
  focusedSiteId: string | null;
  profile: MissionProfile;
  landingUtc: string;
  byId: (id: string) => Site | null;
  entries: Record<string, CustomEntry>;
  /** Typed points the server has not named yet: shown after the scenario's sites. */
  local: readonly CustomEntry[];
};

/** A custom site's entry while it is not a normal site yet. */
function pendingEntry(siteId: string, entries: Record<string, CustomEntry>): CustomEntry | null {
  if (!isCustomSiteId(siteId)) return null;
  const entry = entries[siteId];
  if (!entry || (entry.phase === "ready" && entry.site)) return null;
  return entry;
}

/** Before the first look-up has started, a link's id reads as being checked. */
function placeholderEntry(siteId: string): CustomEntry {
  const [, lat, lon] = siteId.split("_");
  return {
    key: siteId,
    siteId,
    latDeg: Number(lat),
    lonDeg: Number(lon),
    name: null,
    phase: "checking",
    position: null,
    site: null,
    problem: null,
    retryAtMs: null,
    sinceMs: Date.now(),
  };
}

/**
 * Keeps the custom-site jobs in step with the scenario: an id from a link is looked up once
 * (never computed without a click), and a job whose site has left the scenario (Back, a new
 * link) stops waiting.
 */
function useCustomSitesInScenario(siteIds: readonly string[]) {
  useEffect(() => {
    const store = customSitesStore.getState();
    for (const id of siteIds) if (isCustomSiteId(id)) store.check(id);
    for (const entry of Object.values(store.entries)) {
      if (isLocalKey(entry.key) || entry.phase === "ready" || siteIds.includes(entry.key)) continue;
      store.forget(entry.key);
    }
  }, [siteIds]);
}

/** The best-lit variant's parent's name, for "149 m from Connecting Ridge". */
function parentName(site: Site | null, byId: (id: string) => Site | null): string | null {
  return isVariant(site) ? (byId(site.variant_of)?.name ?? null) : null;
}

type Drag = { id: string; from: number; over: number; middles: number[] };

function SiteList({ siteIds, focusedSiteId, profile, landingUtc, byId, entries, local }: SiteListProps) {
  const store = useScenarioStore();
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const refocus = (selector: string) =>
    requestAnimationFrame(() => listRef.current?.closest(".rail-full")?.querySelector<HTMLElement>(selector)?.focus());

  const moveBy = useCallback(
    (id: string, delta: number) => {
      const next = moveById(store.getState().siteIds, id, delta);
      store.getState().reorderSites(next);
      const position = next.indexOf(id) + 1;
      setAnnouncement(`${siteName(byId(id), id)} moved to position ${position} of ${next.length}.`);
      refocus(`[data-handle="${CSS.escape(id)}"]`);
    },
    [store, byId],
  );

  const remove = useCallback(
    (id: string) => {
      const ids = store.getState().siteIds;
      const index = ids.indexOf(id);
      const neighbour = ids[index + 1] ?? ids[index - 1];
      if (isCustomSiteId(id)) removeCustomSite(store, id);
      else store.getState().removeSite(id);
      setAnnouncement(`${siteName(byId(id), id)} removed.`);
      refocus(neighbour ? `[data-site="${CSS.escape(neighbour)}"]` : ".rail-add");
    },
    [store, byId],
  );

  // Pointer drag. The rows stay where they are while dragging (moving a row in the page
  // would drop the pointer); a line marks where the row will land.
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const startDrag = (id: string, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>("li[data-row]");
    if (!rows) return;
    event.preventDefault();
    const middles = Array.from(rows, (row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const from = siteIds.indexOf(id);
    setDrag({ id, from, over: from, middles });
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const over = dropIndex(event.clientY, current.middles, current.from);
      if (over !== current.over) setDrag({ ...current, over });
    };
    const onUp = () => {
      const current = dragRef.current;
      setDrag(null);
      if (!current || current.over === current.from) return;
      const ids = store.getState().siteIds;
      store.getState().reorderSites(moveItem(ids, current.from, current.over));
      setAnnouncement(`${siteName(byId(current.id), current.id)} moved to position ${current.over + 1} of ${ids.length}.`);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [dragging, store, byId]);

  const dropMark = (index: number): "before" | "after" | undefined => {
    if (!drag || drag.over === drag.from || index !== drag.over) return undefined;
    return drag.over < drag.from ? "before" : "after";
  };

  return (
    <div className="rail-full">
      <p className="rail-sub">Status if landing {formatUtc(landingUtc)}</p>
      {siteIds.length === 0 && local.length === 0 ? <p className="rail-empty">No sites yet. Add one from the catalog, or pick a point on the Polar map.</p> : null}
      <ul ref={listRef} className="rail-sites">
        {siteIds.map((id, index) => {
          const pending = pendingEntry(id, entries) ?? (isCustomSiteId(id) && !byId(id) ? placeholderEntry(id) : null);
          if (pending) {
            return (
              <li key={id} data-row className="site-item cs-item" data-dragging={drag?.id === id || undefined} data-drop={dropMark(index)}>
                <CustomPendingRow
                  entry={pending}
                  onAnnounce={setAnnouncement}
                  handle={
                    <Handle siteId={id} name={siteName(null, id)} index={index} count={siteIds.length} onMove={moveBy} onDragStart={startDrag} />
                  }
                />
              </li>
            );
          }
          return (
          <SiteRow
            key={id}
            siteId={id}
            site={byId(id)}
            parentName={parentName(byId(id), byId)}
            profile={profile}
            landingUtc={landingUtc}
            focused={id === focusedSiteId}
            index={index}
            count={siteIds.length}
            dragging={drag?.id === id}
            dropMark={dropMark(index)}
            onMove={moveBy}
            onRemove={remove}
            onDragStart={startDrag}
          />
          );
        })}
        {local.map((entry) => (
          <li key={entry.key} className="site-item cs-item">
            <CustomPendingRow entry={entry} onAnnounce={setAnnouncement} />
          </li>
        ))}
      </ul>
      <AddSite selected={siteIds} pendingCount={local.length} />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

type SiteRowProps = {
  siteId: string;
  site: Site | null;
  /** A best-lit variant's parent's name. */
  parentName: string | null;
  profile: MissionProfile;
  landingUtc: string;
  focused: boolean;
  index: number;
  count: number;
  dragging: boolean;
  /** Where a dragged row would land, drawn as a line on this row. */
  dropMark: "before" | "after" | undefined;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string, event: PointerEvent<HTMLButtonElement>) => void;
};

const SiteRow = memo(function SiteRow({
  siteId,
  site,
  parentName,
  profile,
  landingUtc,
  focused,
  index,
  count,
  dragging,
  dropMark,
  onMove,
  onRemove,
  onDragStart,
}: SiteRowProps) {
  const store = useScenarioStore();
  const status = useSiteStatus(siteId, profile, landingUtc);
  const name = siteName(site, siteId);

  const variant = site ? variantLine(site, parentName) : null;
  const custom = isCustomSiteId(siteId);

  return (
    <li data-row className="site-item" data-dragging={dragging || undefined} data-drop={dropMark}>
      <button
        type="button"
        className="site-row"
        data-site={siteId}
        aria-current={focused ? "true" : undefined}
        onClick={() => store.getState().focusSite(siteId)}
      >
        <span className="site-name">
          {name}
          {custom ? (
            <>
              {" "}
              <span className="tag tag-yours site-name-tag">{YOUR_SITE_TAG}</span>
            </>
          ) : null}
        </span>
        <RowLine status={status} />
        {status.kind === "ready" && moreBroken(status.evaluation) ? <span className="site-note">{moreBroken(status.evaluation)}</span> : null}
        {isSphere(site) ? <span className="site-note">Terrain not modelled</span> : null}
        {variant ? (
          <span className="site-note">
            <span className="tag tag-chosen">{CHOSEN_TAG}</span> {variant}
          </span>
        ) : null}
      </button>
      <span className="site-actions">
        <Handle siteId={siteId} name={name} index={index} count={count} onMove={onMove} onDragStart={onDragStart} />
        <IconButton label={`Remove ${name}`} icon={<X size={16} strokeWidth={1.8} />} className="site-action" onClick={() => onRemove(siteId)} />
      </span>
    </li>
  );
});

type HandleProps = {
  siteId: string;
  name: string;
  index: number;
  count: number;
  onMove: (id: string, delta: number) => void;
  onDragStart: (id: string, event: PointerEvent<HTMLButtonElement>) => void;
};

/** The reorder grip: drag it, or use the up and down arrow keys. */
function Handle({ siteId, name, index, count, onMove, onDragStart }: HandleProps) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      onMove(siteId, -1);
    } else if (event.key === "ArrowDown" && index < count - 1) {
      event.preventDefault();
      onMove(siteId, 1);
    }
  };
  return (
    <button
      type="button"
      className="site-action site-handle"
      data-handle={siteId}
      aria-label={`Move ${name}, position ${index + 1} of ${count}. Use the up and down arrow keys.`}
      onKeyDown={onKey}
      onPointerDown={(event) => onDragStart(siteId, event)}
    >
      <GripVertical size={16} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

function RowLine({ status }: { status: SiteStatus }) {
  if (status.kind === "loading") {
    return (
      <span className="site-line" aria-label="Loading">
        <span className="lamp-none" aria-hidden="true" />
        <span className="skeleton" aria-hidden="true" />
      </span>
    );
  }
  if (status.kind === "error") {
    return (
      <span className="site-line site-line-quiet">
        <span className="lamp-none" aria-hidden="true" />
        Could not load this site's data
      </span>
    );
  }
  if (status.kind === "none") {
    return (
      <span className="site-line site-line-quiet">
        <span className="lamp-none" aria-hidden="true" />
        {NO_RESULT_TEXT}
      </span>
    );
  }
  return (
    <span className="site-line">
      <StatusBadge status={status.evaluation.status} />
      <span className="site-fact" title={worstBrokenVeto(status.evaluation) ? undefined : scoreTitle(status.evaluation.score)}>
        {railFact(status.evaluation)}
      </span>
    </span>
  );
}

type RailLampProps = {
  siteId: string;
  name: string;
  profile: MissionProfile;
  landingUtc: string;
  focused: boolean;
  /** A custom site that is not ready: its lamp says so instead of "loading". */
  pending: CustomEntry | null;
};

function pendingWord(entry: CustomEntry): string {
  if (entry.phase === "failed") return "could not be computed";
  if (entry.phase === "not_computed") return NOT_COMPUTED_TEXT.toLowerCase();
  return COMPUTING_TEXT.replace("…", "").toLowerCase();
}

const RailLamp = memo(function RailLamp({ siteId, name, profile, landingUtc, focused, pending }: RailLampProps) {
  const store = useScenarioStore();
  const status = useSiteStatus(siteId, profile, landingUtc);
  const word = pending
    ? pendingWord(pending)
    : status.kind === "ready"
      ? status.evaluation.status
      : status.kind === "loading"
        ? "loading"
        : status.kind === "none"
          ? "no result"
          : "error";
  const fact = pending ? null : status.kind === "ready" ? railFact(status.evaluation) : status.kind === "none" ? NO_RESULT_TEXT : null;
  return (
    <li>
      <Tip
        content={
          <>
            <span className="tip-title">{name}</span>
            <span>{fact ? `${word} · ${fact}` : word}</span>
          </>
        }
      >
        {(trigger) => (
          <button
            {...trigger}
            type="button"
            className="rail-lamp"
            aria-label={`${name}, ${word}`}
            aria-current={focused ? "true" : undefined}
            onClick={() => store.getState().focusSite(siteId)}
          >
            {status.kind === "ready" && !pending ? (
              <StatusLamp status={status.evaluation.status} />
            ) : (
              <span className={cx("lamp-none", pending && pending.phase !== "failed" && pending.phase !== "not_computed" && "lamp-busy")} aria-hidden="true" />
            )}
          </button>
        )}
      </Tip>
    </li>
  );
});

const GROUP_NAMES: Record<Site["group"], string> = {
  artemis: "Artemis regions",
  sunlit_peak: "Sunlit peaks",
  polar_lander: "Polar landers",
  contrast: "Contrast sites",
};

/** "Add site": the catalog sites not yet selected, grouped, up to eight in all. */
/**
 * "Add site": the catalog sites not yet selected. In the folded rail (`compact`) the button
 * is a 44 px square with only the plus, named "Add site" for screen readers.
 */
function AddSite({ selected, pendingCount, compact = false }: { selected: readonly string[]; pendingCount: number; compact?: boolean }) {
  const store = useScenarioStore();
  const sites = useCatalogSites();
  const used = selected.length + pendingCount;
  const full = used >= MAX_SITES;
  const name = full ? `Add site (${MAX_SITES} is the most)` : "Add site";

  return (
    <Popover
      label="Add a site"
      width={320}
      placement="auto"
      trigger={(props) =>
        compact ? (
          <button {...props} type="button" className="btn btn-quiet rail-add-compact" aria-label={name} title={name} disabled={full}>
            <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : (
          <Button {...props} size="md" className="rail-add" icon={<Plus size={16} strokeWidth={1.8} aria-hidden="true" />} disabled={full}>
            {name}
          </Button>
        )
      }
    >
      {(close) => {
        if (sites.status === "loading") return <p className="pick-note">Loading the site catalog…</p>;
        if (sites.status === "error") return <p className="pick-note">Could not load the site catalog: {sites.error}</p>;
        const free = pickerOrder(sites.data.filter((site) => !selected.includes(site.id)));
        const byId = (id: string) => sites.data.find((site) => site.id === id) ?? null;
        const groups = (Object.keys(GROUP_NAMES) as Site["group"][])
          .map((group) => ({ group, items: free.filter((site) => site.group === group) }))
          .filter((entry) => entry.items.length > 0);
        return (
          <div className="pick">
            <div className="pick-head">
              <h2 className="pe-title">Add a site</h2>
              <span className="rail-count">
                {used} of {MAX_SITES} selected
              </span>
            </div>
            <CustomCoordinates full={full} onStarted={close} />
            {groups.length === 0 ? <p className="pick-note">Every catalog site is already selected.</p> : null}
            {groups.map(({ group, items }) => (
              <section key={group} className="pick-group" aria-label={GROUP_NAMES[group]}>
                <h3 className="pick-group-title">{GROUP_NAMES[group]}</h3>
                <ul className="pick-list">
                  {items.map((site) => (
                    <li key={site.id}>
                      <button
                        type="button"
                        className={cx("pick-site", isVariant(site) && "pick-variant")}
                        onClick={() => {
                          store.getState().addSite(site.id);
                          close();
                        }}
                      >
                        <span className="pick-name">{site.name}</span>
                        <span className="pick-sub tabular">
                          {formatNumber(site.lat_deg, 2)}°, {formatNumber(site.lon_deg, 2)}° E
                          {isSphere(site) ? " · terrain not modelled" : ` · ${site.terrain_tier}`}
                        </span>
                        {isVariant(site) ? (
                          <span className="pick-sub">
                            <span className="tag tag-chosen">{CHOSEN_TAG}</span> {variantLine(site, byId(site.variant_of)?.name ?? null)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Button
              className="pick-map"
              icon={<MapPin size={14} strokeWidth={1.8} aria-hidden="true" />}
              onClick={() => {
                store.getState().setView("map");
                close();
              }}
            >
              Or pick a point on the Polar map
            </Button>
          </div>
        );
      }}
    </Popover>
  );
}
