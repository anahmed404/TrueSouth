import type { Scenario } from "../app/panel";

type PanelPlaceholderProps = {
  name: string;
  scenario: Scenario;
};

export function PanelPlaceholder({ name, scenario }: PanelPlaceholderProps) {
  return (
    <section>
      <h2>{name}</h2>
      <pre>{JSON.stringify(scenario, null, 2)}</pre>
    </section>
  );
}
