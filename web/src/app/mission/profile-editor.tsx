import { Check, RotateCcw } from "lucide-react";
import { memo, useId, useRef, useState, type KeyboardEvent } from "react";
import type { MissionProfile } from "../../contracts/generated";
import { Button } from "../../components/Button";
import { Disclosure } from "../../components/Disclosure";
import { Explain } from "../../components/Explain";
import { cx, formatNumber } from "../../components/format";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { SegmentedControl } from "../../components/SegmentedControl";
import type { ProfileField } from "../../state/scenario";
import {
  FIELD_GROUPS,
  WEIGHT_KEYS,
  WEIGHT_LABELS,
  inputText,
  parseNumberInput,
  profileTitle,
  storeAccepted,
  withWeight,
  type FieldDef,
  type WeightKey,
} from "./profile-fields";
import { formatLimit, formatValue, provenanceOf } from "./rules";
import { useScenario, useScenarioStore } from "./scenario-context";

/**
 * The profile picker's content: the presets, then every field of the mission profile
 * with its unit and its sourced or assumed tag. Every edit goes to the scenario store,
 * which refuses a value that would make the profile invalid; the editor then says what
 * range it accepts and keeps the old value.
 */
export const ProfileEditor = memo(function ProfileEditor({ onChosen }: { onChosen?: () => void }) {
  const store = useScenarioStore();
  const profile = useScenario((s) => s.profile);
  const basePresetId = useScenario((s) => s.basePresetId);
  const changed = useScenario((s) => s.changedFields);
  const presets = useScenario((s) => s.catalog.profiles);
  const base = presets.find((p) => p.id === basePresetId) ?? null;
  const baseName = base?.name ?? basePresetId;
  const title = profileTitle(profile, changed.length, baseName);

  return (
    <div className="profile-editor">
      <div className="pe-head">
        <h2 className="pe-title">Mission profile</h2>
        <p className="pe-current">
          {title}
          {changed.length > 0 ? (
            <>
              {" · "}
              {changed.length === 1 ? "1 change" : `${changed.length} changes`}
            </>
          ) : null}
        </p>
      </div>

      <div role="radiogroup" aria-label="Presets" className="pe-presets">
        {presets.map((preset) => {
          const checked = preset.id === basePresetId && changed.length === 0;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={checked}
              className="pe-preset"
              onClick={() => {
                store.getState().choosePreset(preset.id);
                onChosen?.();
              }}
            >
              <span className="pe-preset-name">
                {preset.name}
                {preset.id === basePresetId && changed.length > 0 ? <span className="pe-preset-base">base of your custom profile</span> : null}
              </span>
              <span className="pe-preset-sub">
                {preset.based_on} · {formatLimit(preset.duration_days, "d")}
              </span>
              {checked ? <Check className="pe-preset-check" size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      {changed.length > 0 ? (
        <div className="pe-custom-line">
          <span>Changed fields are tagged assumed.</span>
          <Button size="sm" icon={<RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />} onClick={() => store.getState().choosePreset(basePresetId)}>
            Reset all
          </Button>
        </div>
      ) : null}

      <Disclosure title="Customise" meta="every field, with its source" defaultOpen={changed.length > 0} className="pe-fields">
        {FIELD_GROUPS.map((group) => (
          <fieldset key={group.title} className="pe-group">
            <legend className="pe-group-title">{group.title}</legend>
            {group.fields.map((def) => (
              <FieldRow key={def.field} def={def} profile={profile} base={base} changed={changed.includes(def.field)} />
            ))}
          </fieldset>
        ))}
      </Disclosure>
    </div>
  );
});

type FieldRowProps = {
  def: FieldDef;
  profile: MissionProfile;
  base: MissionProfile | null;
  changed: boolean;
};


function baseText(def: FieldDef, base: MissionProfile | null): string {
  if (!base) return "";
  const value = base[def.field];
  if (def.kind === "boolean") return value ? "yes" : "no";
  if (def.kind === "weights") {
    const w = base.weights;
    return `${formatNumber(w.slope, 2)} · ${formatNumber(w.power, 2)} · ${formatNumber(w.comms, 2)}`;
  }
  if (value === null) return "no limit";
  return formatLimit(value as number, def.unit);
}

function FieldRow({ def, profile, base, changed }: FieldRowProps) {
  const store = useScenarioStore();
  const provenance = provenanceOf(profile, def.field);
  const labelId = useId();

  return (
    <div className={cx("pe-row", changed && "pe-row-changed")}>
      <div className="pe-row-main">
        <span className="pe-label">
          <span id={labelId}>
            <Explain term={def.field}>{def.label}</Explain>
          </span>
          {provenance ? <ProvenanceTag provenance={provenance} /> : null}
        </span>
        {def.kind === "boolean" ? (
          <SegmentedControl
            label={def.label}
            value={profile.relay_available ? "yes" : "no"}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
            onChange={(value) => store.getState().editProfileField("relay_available", value === "yes")}
          />
        ) : def.kind === "weights" ? null : (
          <NumberField def={def} value={profile[def.field] as number | null} labelledBy={labelId} />
        )}
      </div>
      {def.kind === "weights" ? <WeightsField def={def} profile={profile} labelledBy={labelId} /> : null}
      {changed ? (
        <div className="pe-row-meta">
          <span className="pe-changed">Changed by you</span>
          <button type="button" className="pe-reset" onClick={() => store.getState().resetProfileField(def.field)}>
            <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
            Reset to {baseText(def, base)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A number box. The first edit while it has focus adds a history entry; the rest replace
 * it, so Back undoes one whole edit, not one keystroke.
 */
function useOffer(field: ProfileField) {
  const store = useScenarioStore();
  const pushed = useRef(false);
  return {
    onFocus: () => {
      pushed.current = false;
    },
    /** Offers a value. Returns null when the store took it, else the store's notice, if any. */
    offer: (value: unknown): { accepted: boolean; notice: string | null } => {
      const before = store.getState().notices.length;
      store.getState().editProfileField(field, value, pushed.current ? "replace" : "push");
      const after = store.getState();
      const accepted = storeAccepted(after.profile, field, value);
      if (accepted) pushed.current = true;
      const notice = after.notices.length > before ? (after.notices[after.notices.length - 1] ?? null) : null;
      return { accepted, notice };
    },
  };
}

type BoxProps = {
  id?: string;
  value: number | null;
  optional: boolean;
  unit: string;
  step: number;
  accepts: string;
  ariaLabel?: string;
  labelledBy?: string;
  offer: (value: number | null) => { accepted: boolean; notice: string | null };
  onFocus: () => void;
  onError: (message: string | null) => void;
  errorId: string;
  invalid: boolean;
};

function NumberBox({ id, value, optional, unit, step, accepts, ariaLabel, labelledBy, offer, onFocus, onError, errorId, invalid }: BoxProps) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? inputText(value);

  const take = (next: string) => {
    setText(next);
    const parsed = parseNumberInput(next, optional);
    if (!parsed.ok) {
      onError(optional ? `Type a number, or leave it empty for no limit.` : `Type a number: ${accepts}.`);
      return;
    }
    if (parsed.value === value) {
      onError(null);
      return;
    }
    const result = offer(parsed.value);
    onError(result.accepted ? null : (result.notice ?? `Not accepted. It must be ${accepts}.`));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const current = parseNumberInput(shown, optional);
    const from = current.ok && current.value !== null ? current.value : (value ?? 0);
    const delta = (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1);
    take(inputText(Math.round((from + delta) / step) * step));
  };

  return (
    <span className={cx("pe-box", invalid && "pe-box-invalid")}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        className="pe-input tabular"
        value={shown}
        placeholder={optional ? "none" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelledBy}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onFocus={onFocus}
        onChange={(event) => take(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setText(null);
          onError(null);
        }}
      />
      {unit ? <span className="pe-unit">{unit}</span> : null}
    </span>
  );
}

function NumberField({ def, value, labelledBy }: { def: FieldDef; value: number | null; labelledBy: string }) {
  const { offer, onFocus } = useOffer(def.field);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  return (
    <span className="pe-field">
      <NumberBox
        value={value}
        optional={def.kind === "optional"}
        unit={def.unit}
        step={def.step}
        accepts={def.accepts}
        labelledBy={labelledBy}
        offer={offer}
        onFocus={onFocus}
        onError={setError}
        errorId={errorId}
        invalid={error !== null}
      />
      {error ? (
        <span id={errorId} className="pe-error" role="status">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function WeightsField({ def, profile, labelledBy }: { def: FieldDef; profile: MissionProfile; labelledBy: string }) {
  const { offer, onFocus } = useOffer("weights");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const weights = profile.weights;
  const sum = weights.slope + weights.power + weights.comms;

  return (
    <div className="pe-weights" role="group" aria-labelledby={labelledBy}>
      {WEIGHT_KEYS.map((key: WeightKey) => (
        <label key={key} className="pe-weight">
          <span className="pe-weight-name">{WEIGHT_LABELS[key]}</span>
          <NumberBox
            value={weights[key]}
            optional={false}
            unit=""
            step={def.step}
            accepts={def.accepts}
            ariaLabel={`${WEIGHT_LABELS[key]} weight`}
            offer={(value) => offer(withWeight(profile.weights, key, value ?? 0))}
            onFocus={onFocus}
            onError={setError}
            errorId={errorId}
            invalid={error !== null}
          />
          <span className="pe-weight-share tabular">{sum > 0 ? formatValue((weights[key] / sum) * 100, "%") : "—"}</span>
        </label>
      ))}
      <p className="pe-weights-note">The score uses each weight's share, so they need not add up to 1.</p>
      {error ? (
        <p id={errorId} className="pe-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
