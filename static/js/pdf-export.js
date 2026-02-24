/**
 * PDF Export — client-side investor-ready report generation using jsPDF + html2canvas.
 */

window.PdfExport = (() => {
    const app = () => window.IdeaApp;

    async function exportIdea(ideaId) {
        app().toast('Generating PDF report…', 'info');

        let idea, tasks = [], journals = [], experiments = [], stickies = [];
        try {
            const res = await fetch(`/api/ideas/${ideaId}`);
            idea = await res.json();

            // Also fetch all execution data to append to the report
            const [tRes, jRes, eRes, sRes] = await Promise.all([
                fetch(`/api/ideas/${ideaId}/tasks`).catch(() => ({ json: () => [] })),
                fetch(`/api/ideas/${ideaId}/journal`).catch(() => ({ json: () => [] })),
                fetch(`/api/ideas/${ideaId}/experiments`).catch(() => ({ json: () => [] })),
                fetch(`/api/ideas/${ideaId}/stickies`).catch(() => ({ json: () => [] }))
            ]);
            tasks = await tRes.json();
            journals = await jRes.json();
            experiments = await eRes.json();
            stickies = await sRes.json();
        } catch (err) {
            app().toast('Failed to load idea data for export', 'error');
            return;
        }

        const v = idea.validations && idea.validations[0];
        if (!v) {
            app().toast('No validation data to export', 'error');
            return;
        }

        const analytics = idea.scoring_analytics || {};
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const w = doc.internal.pageSize.getWidth();
        const margin = 16;
        const contentW = w - margin * 2;
        let y = 0;

        function checkPage(needed) {
            if (y + needed > 270) { doc.addPage(); y = 20; }
        }

        function addHeader() {
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, w, 42, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('AI Startup Validation Report', margin, 20);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 28);
            doc.text(`ID: #${idea.id}`, margin, 33);

            // Decision badge
            const dc = v.decision === 'GO' ? [16, 185, 129] : v.decision === 'IMPROVE' ? [245, 158, 11] : [239, 68, 68];
            const badgeX = w - margin - 30;
            doc.setFillColor(...dc);
            doc.roundedRect(badgeX, 14, 28, 10, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(v.decision || '—', badgeX + 14, 21, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            y = 52;
        }

        function addFooter(pageNum) {
            doc.setFillColor(248, 250, 252);
            doc.rect(0, 282, w, 15, 'F');
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.text('AI Idea Validation Platform — Confidential', margin, 289);
            doc.text(`Page ${pageNum}`, w - margin, 289, { align: 'right' });
        }

        function heading(text) {
            checkPage(12);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(text, margin, y);
            y += 3;
            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(0.5);
            doc.line(margin, y, margin + contentW, y);
            y += 6;
        }

        function subheading(text) {
            checkPage(8);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51, 65, 85);
            doc.text(text, margin, y);
            y += 5;
        }

        function body(text, maxWidth) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            const lines = doc.splitTextToSize(text || '', maxWidth || contentW);
            lines.forEach(line => {
                checkPage(5);
                doc.text(line, margin, y);
                y += 4.2;
            });
            y += 2;
        }

        function scoreRow(label, value, maxVal) {
            checkPage(7);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            doc.text(label, margin, y);
            // Bar
            const barX = margin + 55;
            const barW = 70;
            const pct = Math.min((value / maxVal) * barW, barW);
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(barX, y - 3.5, barW, 4, 1, 1, 'F');
            const col = value / maxVal > 0.7 ? [16, 185, 129] : value / maxVal > 0.5 ? [245, 158, 11] : [239, 68, 68];
            doc.setFillColor(...col);
            doc.roundedRect(barX, y - 3.5, pct, 4, 1, 1, 'F');
            // Value
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${value}`, barX + barW + 4, y);
            y += 6;
        }

        // ── Build PDF ────────────────────────────────────────────
        addHeader();

        // Idea Overview
        heading('Idea Overview');
        subheading(idea.title);
        body(idea.description);

        // Executive Summary
        const exec = v.executive_summary || {};
        heading('Executive Summary');
        body(exec.executive_summary || 'Not available');

        if (exec.strengths && exec.strengths.length) {
            subheading('Key Strengths');
            exec.strengths.forEach(s => body(`• ${typeof s === 'string' ? s : JSON.stringify(s)}`, contentW - 4));
        }
        if (exec.weaknesses && exec.weaknesses.length) {
            subheading('Critical Weaknesses');
            exec.weaknesses.forEach(s => body(`• ${typeof s === 'string' ? s : JSON.stringify(s)}`, contentW - 4));
        }
        if (exec.recommendations && exec.recommendations.length) {
            subheading('Strategic Recommendations');
            exec.recommendations.forEach(s => body(`• ${typeof s === 'string' ? s : JSON.stringify(s)}`, contentW - 4));
        }

        // Score Card
        heading('Validation Score');
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        const finalCol = v.decision === 'GO' ? [16, 185, 129] : v.decision === 'IMPROVE' ? [245, 158, 11] : [239, 68, 68];
        doc.setTextColor(...finalCol);
        doc.text(`${(v.final_score || 0).toFixed(1)} / 10`, margin, y + 2);
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Decision: ${v.decision}  |  Confidence: ${(v.confidence_index || 0).toFixed(0)}%`, margin + 50, y + 1);
        y += 12;

        // Weighted Breakdown
        if (analytics.weighted_breakdown) {
            heading('Weighted Score Breakdown');
            analytics.weighted_breakdown.forEach(b => {
                scoreRow(`${b.label} (${b.weight_pct}%)`, b.adjusted_score.toFixed(1), 10);
            });
        }

        // Scenario Simulation
        if (analytics.scenario_scores) {
            heading('Scenario Simulation');
            const sc = analytics.scenario_scores;
            body(`Best Case:  ${sc.best_case.score.toFixed(1)}/10 → ${sc.best_case.decision}`);
            body(`Realistic:  ${sc.realistic.score.toFixed(1)}/10 → ${sc.realistic.decision}`);
            body(`Worst Case: ${sc.worst_case.score.toFixed(1)}/10 → ${sc.worst_case.decision}`);
        }

        // Business Model Canvas
        const canvas = (v.structured_idea || {}).business_model_canvas || {};
        if (Object.keys(canvas).length) {
            heading('Business Validation Canvas');
            Object.entries(canvas).forEach(([key, items]) => {
                subheading(key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                const list = Array.isArray(items) ? items : [items];
                list.forEach(item => body(`• ${typeof item === 'string' ? item : JSON.stringify(item)}`, contentW - 8));
            });
        }

        // Agent Outputs Summary
        if (v.agent_outputs) {
            heading('Agent Analysis Summary');
            Object.entries(v.agent_outputs).forEach(([key, data]) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                subheading(label);
                if (data.error) {
                    body(`Error: ${data.error}`);
                } else {
                    Object.entries(data).forEach(([k, val]) => {
                        if (typeof val === 'number') { scoreRow(k.replace(/_/g, ' '), val, 10); }
                        else if (typeof val === 'string' && val.length < 300) { body(`${k.replace(/_/g, ' ')}: ${val}`); }
                    });
                }
            });
        }

        // Refinement History
        if (v.refinement_history && v.refinement_history.length) {
            heading('Refinement History');
            v.refinement_history.forEach(h => {
                body(`Iteration ${h.iteration}: ${h.prev_score.toFixed(2)} → ${h.new_score.toFixed(2)} (Δ${h.delta >= 0 ? '+' : ''}${h.delta.toFixed(2)}) — focused on ${(h.weakest_dimension || '').replace(/_/g, ' ')}`);
            });
        }

        // --- Execution Records & Operational Appendices ---
        if (tasks.length || journals.length || experiments.length || stickies.length) {
            doc.addPage();
            y = 20;
            heading('Execution & Operations Log');

            if (tasks.length) {
                subheading('Roadmap & Tasks');
                tasks.forEach(t => {
                    const status = t.status === 'done' ? '[✓]' : t.status === 'in_progress' ? '[▶]' : '[ ]';
                    body(`${status} ${t.priority ? `(${t.priority.toUpperCase()})` : ''} ${t.title}`);
                });
            }

            if (experiments.length) {
                subheading('Real-World Tests');
                experiments.forEach(e => {
                    const status = e.status === 'success' ? '✅' : e.status === 'failed' ? '❌' : '⏳';
                    body(`${status} Hypothesis: ${e.hypothesis} (Metric: ${e.metric_name} | Target: ${e.target_value})`);
                });
            }

            if (journals.length) {
                subheading('Execution Journal');
                journals.forEach(j => {
                    const date = new Date(j.created_at).toLocaleDateString();
                    const tone = j.sentiment === 'positive' ? '🟢' : j.sentiment === 'negative' ? '🔴' : '⚪';
                    body(`${tone} [${date}] ${j.entry_type.toUpperCase()}: ${j.content}`);
                });
            }

            if (stickies.length) {
                subheading('Contextual Annotations (Sticky Notes)');
                stickies.forEach(s => {
                    body(`[${s.canvas_block || 'General'}] ${s.content}`);
                });
            }
        }

        // Add footers
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addFooter(i);
        }

        // Sources & Attribution
        heading('Sources & Attribution');
        body('Generated using:');
        body('• groq/compound — Deep strategic analysis with web search', contentW - 8);
        body('• groq/compound-mini — Quick market validation with web search', contentW - 8);
        body('• Internal Knowledge Base — Business Validation Canvas, Agent Analysis', contentW - 8);
        body(`• Timestamp: ${new Date().toISOString()}`, contentW - 8);
        y += 2;
        body('Web sources were retrieved in real-time during clarification and validation queries. All data points are timestamped at the time of retrieval.');

        doc.save(`${idea.title.replace(/[^a-zA-Z0-9]/g, '_')}_Validation_Report.pdf`);
        app().toast('PDF downloaded!', 'success');
    }

    return { exportIdea };
})();
