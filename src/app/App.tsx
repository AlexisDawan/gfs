import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { lazy, Suspense, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

// Lazy loading des pages pour améliorer les performances
const HomePage = lazy(() => import("./components/HomePage").then(module => ({ default: module.HomePage })));
const ScrimSearchPage = lazy(() => import("./components/ScrimSearchPage").then(module => ({ default: module.ScrimSearchPage })));
const RingerSearchPage = lazy(() => import("./components/RingerSearchPage").then(module => ({ default: module.RingerSearchPage })));
const PlayerSearchPage = lazy(() => import("./components/PlayerSearchPage").then(module => ({ default: module.PlayerSearchPage })));
const TeamSearchPage = lazy(() => import("./components/TeamSearchPage").then(module => ({ default: module.TeamSearchPage })));
const SupportPage = lazy(() => import("./components/SupportPage").then(module => ({ default: module.SupportPage })));
const RoadmapPage = lazy(() => import("./components/RoadmapPage").then(module => ({ default: module.RoadmapPage })));
const UpdatesPage = lazy(() => import("./components/UpdatesPage").then(module => ({ default: module.UpdatesPage })));

// Composant de chargement amélioré
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-[#00d4ff] text-xl font-medium"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#00d4ff] rounded-full animate-ping"></div>
          Chargement...
        </div>
      </motion.div>
    </div>
  );
}

// Wrapper pour les routes avec animations
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <HomePage />
            </motion.div>
          }
        />
        <Route
          path="/search/scrim"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ScrimSearchPage />
            </motion.div>
          }
        />
        <Route
          path="/search/ringer"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <RingerSearchPage />
            </motion.div>
          }
        />
        <Route
          path="/search/player"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <PlayerSearchPage />
            </motion.div>
          }
        />
        <Route
          path="/search/team"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <TeamSearchPage />
            </motion.div>
          }
        />
        <Route
          path="/support"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SupportPage />
            </motion.div>
          }
        />
        <Route
          path="/roadmap"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <RoadmapPage />
            </motion.div>
          }
        />
        <Route
          path="/updates"
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <UpdatesPage />
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  // Google Analytics - Injection au chargement de l'app
  useEffect(() => {
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://www.googletagmanager.com/gtag/js?id=G-PQVH5RK7TM';
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-PQVH5RK7TM');
    `;
    document.head.appendChild(script2);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0e27]">
        <Navigation />
        <Suspense fallback={<LoadingFallback />}>
          <AnimatedRoutes />
        </Suspense>
      </div>
    </BrowserRouter>
  );
}