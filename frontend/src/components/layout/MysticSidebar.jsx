import ArchetypeWidget from "../widgets/ArchetypeWidget";
import CommunityWidget from "../widgets/CommunityWidget";
import DailyStreakWidget from "../widgets/DailyStreakWidget";
import TimeCapsuleWidget from "../widgets/TimeCapsuleWidget";

export default function MysticSidebar() {
  return (
    <aside className="mystic-sidebar" aria-label="Tín hiệu phụ">
      <DailyStreakWidget />
      <TimeCapsuleWidget />
      <ArchetypeWidget />
      <CommunityWidget />
    </aside>
  );
}
