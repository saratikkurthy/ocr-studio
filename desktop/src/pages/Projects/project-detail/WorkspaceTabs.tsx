import type { WorkspaceTab } from "./types";

type WorkspaceTabsProps = {
    activeTab: WorkspaceTab;
    onChange: (tab: WorkspaceTab) => void;
    counts: {
        documents: number;
        analysis: number;
        queue: number;
        review: number;
        outputs: number;
        history: number;
    };
};

const tabs: Array<{
    id: WorkspaceTab;
    label: string;
    countKey?: keyof WorkspaceTabsProps["counts"];
}> = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents", countKey: "documents" },
    { id: "analysis", label: "Analysis", countKey: "analysis" },
    { id: "queue", label: "Queue", countKey: "queue" },
    { id: "review", label: "Review", countKey: "review" },
    { id: "outputs", label: "Outputs", countKey: "outputs" },
    { id: "history", label: "History", countKey: "history" },
];

export default function WorkspaceTabs({
    activeTab,
    onChange,
    counts,
}: WorkspaceTabsProps) {
    return (
        <nav className="workspace-tabs" aria-label="Project workspace sections">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`workspace-tab ${
                        activeTab === tab.id ? "active" : ""
                    }`}
                    onClick={() => onChange(tab.id)}
                >
                    <span>{tab.label}</span>
                    {tab.countKey && (
                        <span className="workspace-tab-count">
                            {counts[tab.countKey]}
                        </span>
                    )}
                </button>
            ))}
        </nav>
    );
}
