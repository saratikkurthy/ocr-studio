type ProjectSummaryProps = {
    imported: number;
    selected: number;
    waiting: number;
    processing: number;
    outputs: number;
    failed: number;
};

export default function ProjectSummary({
    imported,
    selected,
    waiting,
    processing,
    outputs,
    failed,
}: ProjectSummaryProps) {
    const items = [
        { label: "Imported", value: imported, help: "Project documents" },
        { label: "Selected", value: selected, help: "Ready for action" },
        { label: "Waiting", value: waiting, help: "Queued PDFs" },
        { label: "Processing", value: processing, help: "Active queue jobs" },
        { label: "Outputs", value: outputs, help: "Generated files" },
        { label: "Failed", value: failed, help: "Needs attention" },
    ];

    return (
        <section className="workspace-summary" aria-label="Project summary">
            {items.map((item) => (
                <article className="workspace-summary-card" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.help}</small>
                </article>
            ))}
        </section>
    );
}
