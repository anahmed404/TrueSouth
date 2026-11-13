import { GripVertical, MapPin, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import type { MissionProfile, Site } from "../../contracts/generated";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatNumber, formatUtc } from "../../components/format";
import { Panel } from "../../components/Panel";
import { Popover } from "../../components/Popover";
import { StatusBadge, StatusLamp } from "../../components/StatusLamp";
import { Tip } from "../../components/Tip";
import { useSites } from "../../data/hooks";
import { MAX_SITES } from "../../state/scenario";
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
            {siteIds.length} of {MAX_SITES}
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
                <RailLamp key={id} siteId={id} name={siteName(byId(id), id)} profile={profile} landingUtc={landingUtc} focused={id === focusedSiteId} />
              ))}
            </ul>
            <AddSite selected={siteIds} compact />
          </>
        ) : (
          <SiteList siteIds={siteIds} focusedSiteId={focusedSiteId} profile={profile} landingUtc={landingUtc} byId={byId} />
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
};

type Drag = { id: string; from: number; over: number; middles: number[] };

function SiteList({ siteIds, focusedSiteId, profile, landingUtc, byId }: SiteListProps) {
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
      store.getState().removeSite(id);
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
      {siteIds.length === 0 ? <p className="rail-empty">No sites yet. Add one from the catalog, or pick a point on the Polar map.</p> : null}
      <ul ref={listRef} className="rail-sites">
        {siteIds.map((id, index) => (
          <SiteRow
            key={id}
            siteId={id}
            site={byId(id)}
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
        ))}
      </ul>
      <AddSite selected={siteIds} />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

type SiteRowProps = {
  siteId: string;
  site: Site | null;
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

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      onMove(siteId, -1);
    } else if (event.key === "ArrowDown" && index < count - 1) {
      event.preventDefault();
      onMove(siteId, 1);
    }
  };

  return (
    <li data-row className="site-item" data-dragging={dragging || undefined} data-drop={dropMark}>
      <button
        type="button"
        className="site-row"
        data-site={siteId}
        aria-current={focused ? "true" : undefined}
        onClick={() => store.getState().focusSite(siteId)}
      >
        <span className="site-name">{name}</span>
        <RowLine status={status} />
        {status.kind === "ready" && moreBroken(status.evaluation) ? <span className="site-note">{moreBroken(status.evaluation)}</span> : null}
        {isSphere(site) ? <span className="site-note">Terrain not modelled</span> : null}
      </button>
      <span className="site-actions">
        <button
          type="button"
          className="site-action site-handle"
          data-handle={siteId}
          aria-label={`Move ${name}, position ${index + 1} of ${count}. Use the up and down arrow keys.`}
          onKeyDown={onHandleKey}
          onPointerDown={(event) => onDragStart(siteId, event)}
        >
          <GripVertical size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <IconButton label={`Remove ${name}`} icon={<X size={16} strokeWidth={1.8} />} className="site-action" onClick={() => onRemove(siteId)} />
      </span>
    </li>
  );
});

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

type RailLampProps = { siteId: string; name: string; profile: MissionProfile; landingUtc: string; focused: boolean };

const RailLamp = memo(function RailLamp({ siteId, name, profile, landingUtc, focused }: RailLampProps) {
  const store = useScenarioStore();
  const status = useSiteStatus(siteId, profile, landingUtc);
  const word =
    status.kind === "ready" ? status.evaluation.status : status.kind === "loading" ? "loading" : status.kind === "none" ? "no result" : "error";
  const fact = status.kind === "ready" ? railFact(status.evaluation) : status.kind === "none" ? NO_RESULT_TEXT : null;
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
            {status.kind === "ready" ? <StatusLamp status={status.evaluation.status} /> : <span className="lamp-none" aria-hidden="true" />}
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
function AddSite({ selected, compact = false }: { selected: readonly string[]; compact?: boolean }) {
  const store = useScenarioStore();
  const sites = useSites();
  const full = selected.length >= MAX_SITES;
  const name = full ? `Add site (${MAX_SITES} is the most)` : "Add site";

  return (
    <Popover
      label="Add a site"
      width={320}
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
        const free = sites.data.filter((site) => !selected.includes(site.id));
        const groups = (Object.keys(GROUP_NAMES) as Site["group"][])
          .map((group) => ({ group, items: free.filter((site) => site.group === group) }))
          .filter((entry) => entry.items.length > 0);
        return (
          <div className="pick">
            <div className="pick-head">
              <h2 className="pe-title">Add a site</h2>
              <span className="rail-count">
                {selected.length} of {MAX_SITES} selected
              </span>
            </div>
            {groups.length === 0 ? <p className="pick-note">Every catalog site is already selected.</p> : null}
            {groups.map(({ group, items }) => (
              <section key={group} className="pick-group" aria-label={GROUP_NAMES[group]}>
                <h3 className="pick-group-title">{GROUP_NAMES[group]}</h3>
                <ul className="pick-list">
                  {items.map((site) => (
                    <li key={site.id}>
                      <button
                        type="button"
                        className="pick-site"
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
