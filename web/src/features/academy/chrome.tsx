import { Link } from "react-router";

export function AcademyChrome({ close }: { close: boolean }) {
  return (
    <p>
      {close ? (
        <>
          <Link to="/academy">Close</Link>
          {" · "}
        </>
      ) : null}
      <Link to="/mission">Skip to Mission Control</Link>
    </p>
  );
}
