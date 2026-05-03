import { Outlet } from "react-router-dom";
import MysticBackground from "./MysticBackground";
import TopNav from "./TopNav";
import MysticSidebar from "./MysticSidebar";
import OracleGuide from "../oracle/OracleGuide";
import { usePreferencesStore } from "../../stores/preferencesStore";
import { useOracleReactions } from "../../hooks/useOracleReactions";

export default function AppShell() {
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  useOracleReactions();

  return (
    <div className={`oracle-app ${reduceMotion ? "reduce-motion" : ""}`}>
      <MysticBackground />
      <TopNav />
      <div className="shell-grid">
        <MysticSidebar />
        <main className="main-workspace">
          <Outlet />
        </main>
        <aside className="oracle-column" aria-label="Nữ tiên tri">
          <OracleGuide />
        </aside>
      </div>
    </div>
  );
}
