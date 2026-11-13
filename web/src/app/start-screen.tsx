import { Link } from "react-router";

export function StartScreen() {
  return (
    <main className="grid min-h-screen grid-cols-2">
      <Link to="/mission" className="flex h-full items-center justify-center border border-border">
        Mission Control
      </Link>
      <Link to="/academy" className="flex h-full items-center justify-center border border-border">
        Academy
      </Link>
    </main>
  );
}
