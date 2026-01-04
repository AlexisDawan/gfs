import { Zap, Wrench, CheckCircle, TrendingUp, DollarSign } from "lucide-react";

export interface Update {
  id: number;
  category: "New" | "Improved" | "Fixed";
  categoryColor: string;
  title: string;
  description: string;
  longDescription: string;
  date: string;
  month: string;
  impact: "High" | "Medium" | "Low";
  icon: any;
}

export const updates: Update[] = [
  // January 2026
  {
    id: 1,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Google AdSense integration",
    description: "Monetization system with contextual ads for platform sustainability.",
    longDescription:
      "Deployed Google AdSense with responsive ad blocks integrated seamlessly into the scrim grid. Ads appear strategically (every 30 cards) to generate passive revenue while maintaining excellent user experience. This ensures long-term platform sustainability and continuous improvements.",
    date: "Jan 17, 2026",
    month: "January 2026",
    impact: "Low",
    icon: DollarSign,
  },
  {
    id: 2,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Optimized ad distribution system",
    description: "Smart ad placement algorithm for balanced monetization.",
    longDescription:
      "Implemented an intelligent ad distribution system that places ads between cards 10-15 initially, then repeats every 30 cards (positions 42, 72, 102, etc.). This balanced approach maximizes revenue potential (estimated 300-500% increase) without overwhelming users, maintaining a clean browsing experience.",
    date: "Jan 16, 2026",
    month: "January 2026",
    impact: "Low",
    icon: TrendingUp,
  },
  {
    id: 3,
    category: "New",
    categoryColor: "#00d4ff",
    title: "Multi-server Discord integration",
    description: "Now parsing from 17 Discord channels simultaneously.",
    longDescription:
      "GoForScrim now automatically parses messages from 17 different Discord servers in real-time. This means you get access to scrims, players, and teams from the entire competitive Overwatch community without having to manually check each server.",
    date: "Jan 15, 2026",
    month: "January 2026",
    impact: "High",
    icon: Zap,
  },
  {
    id: 4,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Faster Discord message parsing",
    description: "Scrim messages are now indexed in near real-time.",
    longDescription:
      "We've optimized our parsing infrastructure to reduce latency from several minutes to 30-90 seconds. Messages posted on Discord now appear on GoForScrim almost instantly, ensuring you never miss a scrim opportunity.",
    date: "Jan 12, 2026",
    month: "January 2026",
    impact: "High",
    icon: TrendingUp,
  },
  {
    id: 5,
    category: "New",
    categoryColor: "#00d4ff",
    title: "Advanced scrim filtering",
    description: "Filter scrims by rank, role, region and availability.",
    longDescription:
      "Our new filtering system allows you to search exactly what you need. Filter by rank (Bronze to Champion), role (Tank/DPS/Support), region (EU/NA/ASIA), platform (PC/Console), and availability. No more scrolling through irrelevant scrims.",
    date: "Jan 10, 2026",
    month: "January 2026",
    impact: "High",
    icon: Wrench,
  },
  {
    id: 6,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Automatic message lifecycle management",
    description: "Messages are automatically deleted after 7 days to keep content fresh.",
    longDescription:
      "To ensure the platform only shows relevant scrims, we now automatically remove messages older than 7 days. This keeps the database clean and ensures you're only seeing active opportunities.",
    date: "Jan 8, 2026",
    month: "January 2026",
    impact: "Medium",
    icon: CheckCircle,
  },
  {
    id: 7,
    category: "New",
    categoryColor: "#00d4ff",
    title: "Platform updates section",
    description: "New patch notes section on homepage to track platform evolution.",
    longDescription:
      "We've added a dedicated 'What's new on the platform' section to the homepage, showing the 4 most recent updates. This helps players, managers, and investors track our progress and stay informed about new features.",
    date: "Jan 5, 2026",
    month: "January 2026",
    impact: "Low",
    icon: Zap,
  },
  {
    id: 8,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Complete homepage redesign",
    description: "7 new sections with interactive animations and dynamic stats.",
    longDescription:
      "The homepage has been completely rebuilt with 7 sections: Hero with interactive hexagons, search categories, how it works, trusted communities carousel, competitive features, patch notes, and final CTA. All sections use Motion animations for a polished experience.",
    date: "Jan 3, 2026",
    month: "January 2026",
    impact: "High",
    icon: TrendingUp,
  },
  {
    id: 9,
    category: "New",
    categoryColor: "#00d4ff",
    title: "Infinite Discord logo carousel",
    description: "Automatic scrolling showcase of partnered Discord servers.",
    longDescription:
      "Added a seamless infinite carousel displaying logos of our partnered Discord servers. The carousel automatically scrolls with smooth animations, showcasing the 17+ communities we integrate with.",
    date: "Jan 2, 2026",
    month: "January 2026",
    impact: "Low",
    icon: Wrench,
  },

  // December 2025
  {
    id: 10,
    category: "Fixed",
    categoryColor: "#ffd700",
    title: "Region detection issues",
    description: "EU and NA servers are now correctly identified.",
    longDescription:
      "Fixed critical bugs in our region parsing logic. Previously, some EU scrims were incorrectly tagged as NA and vice versa. Our parser now accurately detects regions based on keywords, time zones, and server names.",
    date: "Dec 28, 2025",
    month: "December 2025",
    impact: "High",
    icon: CheckCircle,
  },
  {
    id: 11,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Cyber Minimal design system",
    description: "Ultra-clean design with violet/cyan palette (#6c63ff / #00d4ff).",
    longDescription:
      "Established our visual identity with the 'Cyber Minimal' design system. All components now follow a consistent color palette (violet #6c63ff and cyan #00d4ff), creating a cohesive and professional look across the entire platform.",
    date: "Dec 20, 2025",
    month: "December 2025",
    impact: "Medium",
    icon: TrendingUp,
  },
  {
    id: 12,
    category: "New",
    categoryColor: "#00d4ff",
    title: "Multi-search capability",
    description: "Search for scrims, players, teams, and ringers from one hub.",
    longDescription:
      "Launched 4 dedicated search interfaces: Scrims, Players, Teams, and Ringers. Each search type has its own optimized filters and display logic, but all share the same clean interface and fast performance.",
    date: "Dec 15, 2025",
    month: "December 2025",
    impact: "High",
    icon: Zap,
  },
  {
    id: 13,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Supabase backend architecture",
    description: "Edge Functions with Hono web server for blazing-fast queries.",
    longDescription:
      "Migrated backend to Supabase Edge Functions running a Hono web server. This architecture gives us sub-100ms response times for most queries, automatic scaling, and built-in auth/storage capabilities for future features.",
    date: "Dec 10, 2025",
    month: "December 2025",
    impact: "Medium",
    icon: Wrench,
  },
  {
    id: 14,
    category: "New",
    categoryColor: "#00d4ff",
    title: "Dynamic stats display",
    description: "Real-time statistics from Supabase (messages, servers, users).",
    longDescription:
      "Added live stats to the homepage showing total messages parsed, number of Discord servers integrated, and active users. These numbers update in real-time from our Supabase database.",
    date: "Dec 5, 2025",
    month: "December 2025",
    impact: "Low",
    icon: TrendingUp,
  },
  {
    id: 15,
    category: "Improved",
    categoryColor: "#6c63ff",
    title: "Interactive mouse-reactive hexagons",
    description: "Canvas with performance-optimized hexagon animations.",
    longDescription:
      "The hero section now features interactive hexagons that react to mouse movement. We've optimized rendering to 60fps with requestAnimationFrame throttling and scroll detection to prevent performance issues.",
    date: "Dec 3, 2025",
    month: "December 2025",
    impact: "Low",
    icon: Zap,
  },
  {
    id: 16,
    category: "New",
    categoryColor: "#00d4ff",
    title: "React Router DOM navigation",
    description: "Seamless client-side routing with clean URLs.",
    longDescription:
      "Implemented React Router DOM for smooth navigation between pages without full page reloads. All URLs are clean and SEO-friendly (e.g., /search/scrim, /updates, /roadmap).",
    date: "Dec 1, 2025",
    month: "December 2025",
    impact: "Medium",
    icon: Wrench,
  },
];

// Fonction pour récupérer les 4 dernières updates
export const getLatestUpdates = (count: number = 4): Update[] => {
  return updates.slice(0, count);
};