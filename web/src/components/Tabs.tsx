import { useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./format";

export type TabItem<Id extends string = string> = {
  id: Id;
  /** The tab's name, for example "Lander's eye". */
  label: ReactNode;
  /** A short second line saying what the tab is for. */
  caption?: ReactNode;
  /** A small mark after the name, for example the 3D badge. */
  badge?: ReactNode;
};

type TabsProps<Id extends string> = {
  /** Prefix for the ids that tie each tab to its panel. */
  idPrefix: string;
  label: string;
  items: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  className?: string;
};

export function tabId(idPrefix: string, id: string) {
  return `${idPrefix}-tab-${id}`;
}

export function tabPanelId(idPrefix: string, id: string) {
  return `${idPrefix}-panel-${id}`;
}

/**
 * A row of tabs (WAI-ARIA tabs, manual activation). Arrow keys, Home and End move focus
 * between tabs; Enter or Space opens the focused one. Manual activation keeps a heavy
 * view, such as a 3D scene, from loading while the user only passes over its tab.
 *
 * Selected: --raised fill and a 2 px --accent underline. Only the selected tab names its
 * panel in `aria-controls`, because only that panel is in the page.
 */
export function Tabs<Id extends string>({ idPrefix, label, items, value, onChange, className }: TabsProps<Id>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={cx("tabs", className)} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={tabId(idPrefix, item.id)}
            aria-selected={selected}
            aria-controls={selected ? tabPanelId(idPrefix, item.id) : undefined}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => onChange(item.id)}
          >
            <span className="tab-name">
              {item.label}
              {item.badge}
            </span>
            {item.caption ? <span className="tab-caption">{item.caption}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

type TabPanelProps = HTMLAttributes<HTMLDivElement> & {
  idPrefix: string;
  id: string;
  children: ReactNode;
};

/** The region a tab controls. Render only the selected one. */
export function TabPanel({ idPrefix, id, className, children, ...rest }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      className={className}
      {...rest}
    >
      {children}
    </div>
  );
}
