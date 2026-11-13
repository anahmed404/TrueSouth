import { Info, X } from "lucide-react";
import { memo } from "react";
import { IconButton } from "../../components/Button";
import { useScenario, useScenarioStore } from "./scenario-context";

/**
 * The store's notices, quietly: a part of a link that was ignored, or a value that was
 * refused. One line each, with one button that dismisses them all.
 */
export const NoticeStrip = memo(function NoticeStrip() {
  const store = useScenarioStore();
  const notices = useScenario((s) => s.notices);
  if (notices.length === 0) return null;
  return (
    <div className="notices" role="status">
      <Info className="notices-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
      <ul className="notices-list">
        {notices.map((notice, index) => (
          <li key={`${index}-${notice}`}>{notice}</li>
        ))}
      </ul>
      <IconButton
        label={notices.length === 1 ? "Dismiss this notice" : "Dismiss these notices"}
        icon={<X size={16} strokeWidth={1.8} />}
        onClick={() => store.getState().dismissNotices()}
        className="notices-close"
      />
    </div>
  );
});
