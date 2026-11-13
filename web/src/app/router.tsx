import { BrowserRouter, Route, Routes, useParams } from "react-router";
import AcademyRoutes from "../features/academy";
import ValidationPage from "../features/validation";
import { MissionScreen } from "./mission-screen";
import { NotFound } from "./not-found";
import { StartScreen } from "./start-screen";

function AcademyLesson() {
  const { lessonId } = useParams();
  return <AcademyRoutes lessonId={lessonId} />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/mission" element={<MissionScreen />} />
        <Route path="/academy" element={<AcademyRoutes />} />
        <Route path="/academy/:lessonId" element={<AcademyLesson />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
