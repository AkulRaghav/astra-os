export const USER = {
  name: "Akul Raghav",
  username: "akulraghav",
  email: "akul@example.com",
  plan: "Pro Plan",
  avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Akul&backgroundColor=7c3aed",
};

export const RECENT_FILES = [
  { name: "Astra_Architecture.pdf", size: "2.4 MB", modified: "2h ago", type: "pdf" },
  { name: "Project_Proposal.docx", size: "1.1 MB", modified: "5h ago", type: "doc" },
  { name: "Financial_Report.xlsx", size: "8.7 MB", modified: "1d ago", type: "sheet" },
  { name: "Design_System.fig", size: "12.3 MB", modified: "2d ago", type: "design" },
  { name: "Meeting_Notes.md", size: "42 KB", modified: "3d ago", type: "md" },
];

export const TASKS = [
  { id: 1, title: "Design system update", priority: "High", status: "In Progress", done: false },
  { id: 2, title: "AI meeting with team", priority: "High", status: "To Do", done: false },
  { id: 3, title: "Fix authentication bug", priority: "High", status: "In Progress", done: false },
  { id: 4, title: "Deploy new release", priority: "Medium", status: "To Do", done: false },
  { id: 5, title: "Design system update", priority: "Medium", status: "In Progress", done: false },
  { id: 6, title: "AI meeting with team", priority: "Medium", status: "To Do", done: false },
  { id: 7, title: "Write documentation", priority: "Low", status: "Done", done: true },
];

export const AGENTS = [
  { name: "Code Helper", desc: "Assists with coding and debugging", icon: "Code2" },
  { name: "Data Analyst", desc: "Analyzes data and generates insights", icon: "BarChart3" },
  { name: "Content Writer", desc: "Creates content and documents", icon: "PenLine" },
  { name: "Researcher", desc: "Search and summarize information", icon: "Search" },
];

export const NOTIFICATIONS = [
  { who: "AI Assistant", what: "New suggestion available", when: "2h ago", type: "ai" },
  { who: "Jane Cooper", what: "Mentioned you in a comment", when: "4h ago", type: "mention" },
  { who: "System", what: "Your backup is complete", when: "1d ago", type: "system" },
  { who: "Alex Morgan", what: "Shared a file with you", when: "1d ago", type: "file" },
  { who: "Dev Team", what: "New update deployed", when: "2d ago", type: "system" },
];

export const PLUGINS = [
  { name: "GitHub", desc: "Sync with GitHub repositories", color: "#fff", category: "Development" },
  { name: "Slack", desc: "Your team's Slack workspace", color: "#4A154B", category: "Productivity" },
  { name: "Notion", desc: "Connect Notion pages and notes", color: "#000", category: "Productivity" },
  { name: "Figma", desc: "Design and prototype integration", color: "#a259ff", category: "Design" },
  { name: "Linear", desc: "Issue tracking integration", color: "#5e6ad2", category: "Development" },
  { name: "OpenAI", desc: "Supercharge with AI models", color: "#10a37f", category: "AI" },
];

export const EMAILS = [
  { from: "Jane Cooper", subject: "Project update and next steps", preview: "Hi Akul, just wanted to follow up on...", time: "10:42 AM", unread: true },
  { from: "Alex Morgan", subject: "Design Feedback", preview: "I had a chance to review the latest...", time: "Yesterday", unread: true },
  { from: "Astra OS", subject: "Welcome to Astra OS!", preview: "Get started in 3 simple steps...", time: "Yesterday", unread: false },
  { from: "Marketing Team", subject: "Campaign analytics", preview: "Your latest campaign hit a 12% CTR...", time: "May 26", unread: false },
];

export const ACTIVITY_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  value: 30 + Math.round(Math.sin(i / 1.6) * 25 + Math.random() * 30),
}));

export const ANALYTICS = {
  visitors: 12340, activeUsers: 3456, sessions: 18765, bounce: 24.5,
  topPages: [
    { page: "/dashboard", views: 9406 },
    { page: "/files", views: 5234 },
    { page: "/ai-assistant", views: 3456 },
    { page: "/pricing", views: 1234 },
  ],
};

export const NAV_ITEMS = [
  { to: "/app", label: "Dashboard", icon: "LayoutDashboard" },
  { to: "/app/ai", label: "AI Assistant", icon: "Sparkles" },
  { to: "/app/files", label: "Files", icon: "Folder" },
  { to: "/app/terminal", label: "Terminal", icon: "TerminalSquare" },
  { to: "/app/browser", label: "Browser", icon: "Globe" },
  { to: "/app/code", label: "Code Editor", icon: "Code2" },
  { to: "/app/calendar", label: "Calendar", icon: "Calendar" },
  { to: "/app/mail", label: "Mail", icon: "Mail" },
  { to: "/app/tasks", label: "Tasks", icon: "CheckSquare" },
  { to: "/app/notes", label: "Notes", icon: "StickyNote" },
  { to: "/app/agents", label: "AI Agents", icon: "Bot" },
  { to: "/app/workspace", label: "Workspace", icon: "LayoutGrid" },
  { to: "/app/analytics", label: "Analytics", icon: "BarChart3" },
  { to: "/app/plugins", label: "Plugins", icon: "Puzzle" },
  { to: "/app/notifications", label: "Notifications", icon: "Bell" },
  { to: "/app/profile", label: "Profile", icon: "User" },
  { to: "/app/settings", label: "Settings", icon: "Settings" },
] as const;
