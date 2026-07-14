import { useEffect } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { AppShell } from "@/app/AppShell";
import { OnboardingScreen } from "@/app/onboarding/OnboardingScreen";
import { TodayScreen } from "@/app/today/TodayScreen";
import { PlanScreen } from "@/app/plan/PlanScreen";
import { GoalsScreen } from "@/app/goals/GoalsScreen";
import { SpaceScreen } from "@/app/space/SpaceScreen";
import { ChatScreen } from "@/app/chat/ChatScreen";
import { ScanScreen } from "@/app/scan/ScanScreen";
import { MemoryScreen } from "@/app/memory/MemoryScreen";
import { SettingsScreen } from "@/app/settings/SettingsScreen";

function RequireOnboarding({ children }: { children: React.ReactElement }) {
  const user = useAppStore((s) => s.user);
  const hydrated = useAppStore((s) => s.hydrated);
  if (!hydrated) return null;
  if (!user) return <Navigate to="/onboarding" replace />;
  return children;
}

const router = createBrowserRouter([
  { path: "/onboarding", element: <OnboardingScreen /> },
  {
    path: "/",
    element: (
      <RequireOnboarding>
        <AppShell />
      </RequireOnboarding>
    ),
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: "today", element: <TodayScreen /> },
      { path: "plan", element: <PlanScreen /> },
      { path: "goals", element: <GoalsScreen /> },
      { path: "space", element: <SpaceScreen /> },
      { path: "chat", element: <ChatScreen /> },
      { path: "scan", element: <ScanScreen /> },
      { path: "memory", element: <MemoryScreen /> },
      { path: "settings", element: <SettingsScreen /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }} aria-busy="true">
        <div className="kv-skeleton" style={{ width: 120, height: 20 }} aria-label="Loading Kova" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
