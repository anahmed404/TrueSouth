import { ChevronDown, Crosshair, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "zustand";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { cx } from "../../components/format";
import { Tip } from "../../components/Tip";
import { customSitesStore, type CustomEntry } from "../../state/custom-sites";
import { removeCustomSite, retryCustomSite, startCustomSite } from "./custom-site-actions";
import { beforeComputing, checkForm, tierHint } from "./custom-site-form";
import { customRowView, STOPPED_WAITING, YOUR_SITE_TAG, YOUR_SITE_TIP, type CustomRowView } from "./custom-site-row";
import { useScenarioStore } from "./scenario-context";

/** One custom entry, by key. */
export function useCustomEntry(key: string): CustomEntry | undefined {
  return useStore(customSitesStore, (state) => state.entries[key]);
}

/**
 * One clock for every pending row: a single one-second timer, running only while some row
 * shows a time.
 */
const ticker = (() => {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let now = Date.now();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!timer) {
        now = Date.now();
        timer = setInterval(() => {
          now = Date.now();
          listeners.forEach((l) => l());
        }, 1000);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    get: () => now,
  };
})();

const idle = () => () => undefined;

/** The shared clock while `active`; a fixed time otherwise, so idle rows never re-render. */
function useNow(active: boolean): number {
  const now = useSyncExternalStore(active ? ticker.subscribe : idle, ticker.get);
  return active ? now : ticker.get();
}

/** The row's view, kept current: the clock ticks while the job is busy or a retry waits. */
export function useCustomRowView(entry: CustomEntry): CustomRowView {
  const waiting = entry.phase === "failed" && entry.retryAtMs !== null;
  const busy = entry.phase === "sending" || entry.phase === "queued" || entry.phase === "running" || entry.phase === "checking";
  const now = useNow(busy || waiting);
  return customRowView(entry, now);
}

/**
 * A name typed by someone, safely shown: isolated from the text around it (`dir="auto"`,
 * `unicode-bidi: isolate`), on one line with an ellipsis, and always with "Your site" beside
 * it, so it cannot pass for a catalog site.
 */
export function CustomName({ name, tag = "plain" }: { name: string; tag?: "plain" | "tip" | "none" }) {
  return (
    <span className="cs-name-line">
      <bdi className="cs-name" dir="auto" title={name}>
        {name}
      </bdi>
      {tag === "none" ? null : tag === "tip" ? <YourSiteTag /> : <span className="tag tag-yours">{YOUR_SITE_TAG}</span>}
    </span>
  );
}

/** "Your site": a filled tag, unlike sourced (solid), assumed (dashed) and chosen by TrueSouth (dotted). */
export function YourSiteTag() {
  return (
    <Tip content={YOUR_SITE_TIP}>
      {(trigger) => (
        <span {...trigger} tabIndex={0} className="tag tag-yours">
          {YOUR_SITE_TAG}
        </span>
      )}
    </Tip>
  );
}

/**
 * The state of a custom site that is not a normal site yet, with its one action. Used in
 * its rail row and in the focused-site panel.
 */
export function CustomState({ entry, compact = false }: { entry: CustomEntry; onAnnounce?: (text: string) => void; compact?: boolean }) {
  const scenario = useScenarioStore();
  const view = useCustomRowView(entry);
  return (
    <span className={cx("cs-state", compact && "cs-state-compact")}>
      <span className={cx("site-line", !view.busy && "site-line-quiet")}>
        <span className={cx("lamp-none", view.busy && "lamp-busy")} aria-hidden="true" />
        <span className={view.failed ? "cs-failed" : undefined}>{view.line}</span>
      </span>
      {view.detail ? <span className="site-note tabular">{view.detail}</span> : null}
      {view.busy ? <span className="cs-progress" aria-hidden="true" /> : null}
      {view.primary ? (
        <Button
          className="cs-action"
          disabled={view.primary.disabled}
          onClick={() => retryCustomSite(scenario, entry.key)}
        >
          {view.primary.label}
        </Button>
      ) : null}
    </span>
  );
}

/**
 * A custom site's rail row while it computes, waits or has failed. Not a button: focusing
 * it would show nothing yet. `handle` is the reorder grip, when the id is in the scenario.
 */
export function CustomPendingRow({ entry, handle, onAnnounce }: { entry: CustomEntry; handle?: ReactNode; onAnnounce: (text: string) => void }) {
  const scenario = useScenarioStore();
  const view = useCustomRowView(entry);
  const close = () => {
    removeCustomSite(scenario, entry.key);
    onAnnounce(view.close.action === "stop" ? STOPPED_WAITING : `${view.title} removed.`);
    // The row is gone: keep the keyboard in the rail.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".rail-full .rail-add")?.focus());
  };
  return (
    <div className="site-row cs-row" data-site={entry.siteId ?? entry.key} aria-busy={view.busy || undefined}>
      <span className="site-name">
        <CustomName name={view.title} tag="tip" />
      </span>
      <span className="cs-sub tabular">{view.coordinates}</span>
      {/* The state changes are announced once by the rail; the ticking time is not live. */}
      <span className="cs-live" aria-live="off">
        <CustomState entry={entry} onAnnounce={onAnnounce} />
      </span>
      <span className="site-actions cs-actions">
        {handle}
        <IconButton label={view.close.label} icon={<X size={16} strokeWidth={1.8} />} className="site-action" onClick={close} />
      </span>
    </div>
  );
}

/**
 * "Enter coordinates", inside the add-site picker: closed by default, so the picker is no
 * busier for someone who never uses it, but drawn as a control (an outlined full-width row
 * with a crosshair) so nobody takes it for a heading and misses it. Opening it moves focus
 * to the latitude field. When the server has no custom sites the row still shows, with
 * "Not available on this server" under its label. Checks `/api/health` once, when the
 * picker opens.
 */
export function CustomCoordinates({ full, onStarted }: { full: boolean; onStarted: () => void }) {
  const scenario = useScenarioStore();
  const availability = useStore(customSitesStore, (state) => state.availability.state);
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [name, setName] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    customSitesStore.getState().checkAvailability();
  }, []);

  const unavailable = availability === "not_available" || availability === "offline";
  const disabled = unavailable || full;
  const check = checkForm(lat, lon, name);
  const latId = `${id}-lat`;
  const lonId = `${id}-lon`;
  const nameId = `${id}-name`;

  const submit = () => {
    if (!check.ready || check.lat.value === null || check.lon.value === null || disabled) return;
    const result = startCustomSite(scenario, check.lat.value, check.lon.value, name.trim() || null);
    if (!result.ok) {
      setRefusal(result.message);
      return;
    }
    setLat("");
    setLon("");
    setName("");
    setRefusal(null);
    onStarted();
  };

  return (
    <section className="cs" aria-labelledby={`${id}-h`}>
      <h3 className="cs-head" id={`${id}-h`}>
        <button
          type="button"
          className="cs-toggle"
          aria-expanded={open}
          // Only while the form exists: it is unmounted when closed.
          aria-controls={open ? `${id}-body` : undefined}
          aria-describedby={open && (unavailable || full) ? `${id}-why` : undefined}
          onClick={() => {
            const next = !open;
            setOpen(next);
            // Straight to typing: the latitude field, once the form is there and usable.
            if (next && !disabled) requestAnimationFrame(() => document.getElementById(latId)?.focus());
          }}
        >
          <Crosshair size={16} strokeWidth={1.8} aria-hidden="true" className="cs-toggle-icon" />
          <span className="cs-toggle-text">
            <span className="cs-toggle-label">Enter coordinates</span>
            {unavailable ? <span className="cs-toggle-note">Not available on this server</span> : null}
          </span>
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" className="cs-chevron" />
        </button>
      </h3>
      {open ? (
        <form
          ref={formRef}
          id={`${id}-body`}
          className="cs-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {unavailable ? (
            <p id={`${id}-why`} className="cs-unavailable">
              Custom sites are not available on this server.
            </p>
          ) : null}
          {!unavailable && full ? (
            <p id={`${id}-why`} className="cs-unavailable">
              The scenario has 8 sites, the most it holds. Remove one first.
            </p>
          ) : null}
          <fieldset className="cs-fields" disabled={disabled}>
            <legend className="sr-only">A point on the Moon</legend>
            <div className="cs-pair">
              <CoordField
                id={latId}
                label="Latitude"
                term="latitude"
                unit="°"
                value={lat}
                onChange={setLat}
                placeholder="−88.5"
                message={check.lat.message}
                note={check.lat.note}
              />
              <CoordField
                id={lonId}
                label="East longitude"
                term="east_longitude"
                unit="° E"
                value={lon}
                onChange={setLon}
                placeholder="45"
                message={check.lon.message}
                note={check.lon.note}
              />
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor={nameId}>
                Name <span className="cs-optional">(optional)</span>
              </label>
              <input
                id={nameId}
                className={cx("cs-input-text", check.nameMessage && "cs-input-invalid")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={check.nameMessage ? true : undefined}
                aria-describedby={check.nameMessage ? `${nameId}-m` : undefined}
                autoComplete="off"
                maxLength={200}
              />
              {check.nameMessage ? (
                <span id={`${nameId}-m`} className="cs-message">
                  {check.nameMessage}
                </span>
              ) : null}
            </div>
          </fieldset>
          {check.lat.value !== null && !disabled ? (
            <p className={cx("cs-before", tierHint(check.lat.value) === "sphere" && "cs-before-sphere")}>{beforeComputing(check.lat.value)}</p>
          ) : null}
          {refusal ? (
            <p className="cs-message" role="alert">
              {refusal}
            </p>
          ) : null}
          <Button type="submit" className="cs-submit" disabled={disabled || !check.ready || availability === "checking"}>
            {availability === "checking" ? "Checking the server…" : "Compute this site"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

type CoordFieldProps = {
  id: string;
  label: string;
  term: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  message: string | null;
  note: string | null;
};

function CoordField({ id, label, term, unit, value, onChange, placeholder, message, note }: CoordFieldProps) {
  const describedBy = message ? `${id}-m` : note ? `${id}-n` : undefined;
  return (
    <div className="cs-field">
      <span className="cs-label-row">
        <label className="cs-label" htmlFor={id}>
          {label}
        </label>
        <Explain term={term} label={label.toLowerCase()} />
      </span>
      <span className={cx("cs-box", message && "cs-input-invalid")}>
        <input
          id={id}
          className="cs-input tabular"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
        />
        <span className="cs-unit" aria-hidden="true">
          {unit}
        </span>
      </span>
      {message ? (
        <span id={`${id}-m`} className="cs-message">
          {message}
        </span>
      ) : note ? (
        <span id={`${id}-n`} className="cs-note tabular">
          {note}
        </span>
      ) : null}
    </div>
  );
}
