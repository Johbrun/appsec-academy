import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, useParams } from 'react-router-dom';
import './styles.css';
import './appsec.css';
import { ProgressProvider } from './store/progress';
import { SessionProvider, useSession } from './store/session';
import { AfterAuth, RedirectToLogin } from './components/AuthShell';
import { Screen } from './components/ui';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Parcours from './pages/Parcours';
import ModulePage from './pages/ModulePage';
import LessonPage from './pages/LessonPage';
import Games from './pages/Games';
import Labs from './pages/Labs';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Exams, { ExamRoute } from './pages/Exams';
import Certificate from './pages/Certificate';
import NotFound from './pages/NotFound';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ResetPassword from './pages/auth/ResetPassword';
import Cohorts from './pages/teacher/Cohorts';
import Cohort from './pages/teacher/Cohort';
import Student from './pages/teacher/Student';

// Chaque jeu est chargé à la demande.
const gameComponents: Record<string, React.LazyExoticComponent<() => JSX.Element | null>> = {
  flashcards: lazy(() => import('./games/Flashcards')),
  referentiel: lazy(() => import('./games/Referentiel')),
  'spot-the-sink': lazy(() => import('./games/SpotTheSink')),
  'patch-or-pwn': lazy(() => import('./games/PatchOrPwn')),
  'stepping-stones': lazy(() => import('./games/SteppingStones')),
  'race-window': lazy(() => import('./games/RaceWindow')),
  'triage-room': lazy(() => import('./games/TriageRoom')),
  'csp-builder': lazy(() => import('./games/CspBuilder')),
  pushback: lazy(() => import('./games/Pushback')),
  'data-map': lazy(() => import('./games/DataMap')),
  'pattern-match': lazy(() => import('./games/PatternMatch')),
  'design-review': lazy(() => import('./games/DesignReview')),
  'parser-wars': lazy(() => import('./games/ParserWars')),
  'oauth-debugger': lazy(() => import('./games/OAuthDebugger')),
  'abuse-desk': lazy(() => import('./games/AbuseDesk')),
  'stride-cards': lazy(() => import('./games/StrideCards')),
  'diff-review': lazy(() => import('./games/DiffReview')),
  'right-tool': lazy(() => import('./games/RightTool')),
  'true-false-positive': lazy(() => import('./games/TrueFalsePositive')),
  'workflow-audit': lazy(() => import('./games/WorkflowAudit')),
  'supply-chain': lazy(() => import('./games/SupplyChain')),
  'allow-deny': lazy(() => import('./games/AllowDeny')),
  'iam-pathfinder': lazy(() => import('./games/IamPathfinder')),
  'iac-hunt': lazy(() => import('./games/IacHunt')),
  'log-detective': lazy(() => import('./games/LogDetective')),
  'detection-builder': lazy(() => import('./games/DetectionBuilder')),
  'agent-blast-radius': lazy(() => import('./games/AgentBlastRadius')),
  'crise-j0': lazy(() => import('./games/CriseJ0')),
  'red-blue': lazy(() => import('./games/RedBlue')),
};

function GameRoute() {
  const { gameId = '' } = useParams();
  const Game = gameComponents[gameId];
  if (!Game) return <NotFound />;
  return (
    <Suspense fallback={<section className="block"><p className="muted">Chargement du jeu…</p></section>}>
      <Game />
    </Suspense>
  );
}

// Les routes enseignant ne se montrent qu'aux enseignants ; c'est le serveur qui fait autorité, ceci évite seulement une page vide.
function TeacherOnly({ children }: { children: JSX.Element }) {
  const { user } = useSession();
  return user?.role === 'teacher' ? children : <NotFound />;
}

function AppRoutes() {
  const { status, refresh } = useSession();

  if (status === 'loading') return <Screen><p className="muted" role="status">Chargement…</p></Screen>;
  if (status === 'unreachable') {
    return (
      <Screen>
        <p role="alert">Le serveur ne répond pas.</p>
        <button className="btn primary sm" onClick={() => void refresh().catch(() => undefined)}>Réessayer</button>
      </Screen>
    );
  }

  // Sans session : uniquement l'authentification. Le reste du site n'est même pas monté.
  if (status === 'out') {
    return (
      <Routes>
        <Route path="connexion" element={<Login />} />
        <Route path="inscription" element={<Signup />} />
        <Route path="reinitialiser" element={<ResetPassword />} />
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    );
  }

  return (
    <ProgressProvider>
      <Routes>
        <Route path="connexion" element={<AfterAuth />} />
        <Route path="inscription" element={<AfterAuth />} />
        <Route path="reinitialiser" element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="parcours" element={<Parcours />} />
          <Route path="modules/:moduleId" element={<ModulePage />} />
          <Route path="modules/:moduleId/:lessonId" element={<LessonPage />} />
          <Route path="jeux" element={<Games />} />
          <Route path="jeux/:gameId" element={<GameRoute />} />
          <Route path="labs" element={<Labs />} />
          <Route path="examens" element={<Exams />} />
          <Route path="examens/:examId" element={<ExamRoute />} />
          <Route path="certificat" element={<Certificate />} />
          <Route path="bibliotheque" element={<Library />} />
          <Route path="profil" element={<Profile />} />
          <Route path="enseignant" element={<TeacherOnly><Cohorts /></TeacherOnly>} />
          <Route path="enseignant/:cohortId" element={<TeacherOnly><Cohort /></TeacherOnly>} />
          <Route path="enseignant/:cohortId/:uid" element={<TeacherOnly><Student /></TeacherOnly>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ProgressProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </HashRouter>
  </React.StrictMode>,
);
