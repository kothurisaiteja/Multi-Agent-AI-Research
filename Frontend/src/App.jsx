import { useState, useRef, useEffect } from "react";
import "./App.css";

const initialAgents = {
    search: {
        name: "Search Agent",
        status: "waiting",
        message: "Awaiting topic input...",
    },
    reader: {
        name: "Reader Agent",
        status: "waiting",
        message: "Awaiting search results...",
    },
    writer: {
        name: "Writer Agent",
        status: "waiting",
        message: "Awaiting source analysis...",
    },
    critic: {
        name: "Critic Agent",
        status: "waiting",
        message: "Awaiting generated report...",
    },
};

export default function App() {
    const [topic, setTopic] = useState("");
    const [activeTopic, setActiveTopic] = useState("");
    const [agents, setAgents] = useState(initialAgents);

    const [readerContent, setReaderContent] = useState("");
    const [report, setReport] = useState("");
    const [feedback, setFeedback] = useState("");

    const [running, setRunning] = useState(false);
    const [currentAgent, setCurrentAgent] = useState(null);
    const [error, setError] = useState("");

    const [writerAutoFollow, setWriterAutoFollow] = useState(true);
    const [criticAutoFollow, setCriticAutoFollow] = useState(true);

    // Output Container Refs
    const reportContainerRef = useRef(null);
    const criticContainerRef = useRef(null);

    // Scroll Animation Refs
    const writerAnimationRef = useRef(null);
    const writerTargetScrollRef = useRef(null);
    const writerAutoFollowRef = useRef(true);

    const criticAnimationRef = useRef(null);
    const criticTargetScrollRef = useRef(null);
    const criticAutoFollowRef = useRef(true);

    // Stop Scroll Animations
    const stopWriterScrollAnimation = () => {
        if (writerAnimationRef.current) {
            cancelAnimationFrame(writerAnimationRef.current);
            writerAnimationRef.current = null;
        }
        writerTargetScrollRef.current = null;
    };

    const stopCriticScrollAnimation = () => {
        if (criticAnimationRef.current) {
            cancelAnimationFrame(criticAnimationRef.current);
            criticAnimationRef.current = null;
        }
        criticTargetScrollRef.current = null;
    };

    // Follow Controls
    const enableWriterAutoFollow = () => {
        writerAutoFollowRef.current = true;
        setWriterAutoFollow(true);
        followWriter();
    };

    const disableWriterAutoFollow = () => {
        writerAutoFollowRef.current = false;
        setWriterAutoFollow(false);
        stopWriterScrollAnimation();
    };

    const enableCriticAutoFollow = () => {
        criticAutoFollowRef.current = true;
        setCriticAutoFollow(true);
        followCritic();
    };

    const disableCriticAutoFollow = () => {
        criticAutoFollowRef.current = false;
        setCriticAutoFollow(false);
        stopCriticScrollAnimation();
    };

    // Cinematic Inner Scroll Engine
    const smoothFollowWriter = (container) => {
        if (!container || !writerAutoFollowRef.current) return;

        const target = container.scrollHeight - container.clientHeight;
        writerTargetScrollRef.current = Math.max(0, target);

        if (writerAnimationRef.current) return;

        const animate = () => {
            if (!writerAutoFollowRef.current) {
                writerAnimationRef.current = null;
                return;
            }

            const current = container.scrollTop;
            const targetPos = writerTargetScrollRef.current;

            if (targetPos === null) {
                writerAnimationRef.current = null;
                return;
            }

            const distance = targetPos - current;

            if (Math.abs(distance) < 1) {
                container.scrollTop = targetPos;
                writerAnimationRef.current = null;
                return;
            }

            container.scrollTop = current + distance * 0.045;
            writerAnimationRef.current = requestAnimationFrame(animate);
        };

        writerAnimationRef.current = requestAnimationFrame(animate);
    };

    const smoothFollowCritic = (container) => {
        if (!container || !criticAutoFollowRef.current) return;

        const target = container.scrollHeight - container.clientHeight;
        criticTargetScrollRef.current = Math.max(0, target);

        if (criticAnimationRef.current) return;

        const animate = () => {
            if (!criticAutoFollowRef.current) {
                criticAnimationRef.current = null;
                return;
            }

            const current = container.scrollTop;
            const targetPos = criticTargetScrollRef.current;

            if (targetPos === null) {
                criticAnimationRef.current = null;
                return;
            }

            const distance = targetPos - current;

            if (Math.abs(distance) < 1) {
                container.scrollTop = targetPos;
                criticAnimationRef.current = null;
                return;
            }

            container.scrollTop = current + distance * 0.045;
            criticAnimationRef.current = requestAnimationFrame(animate);
        };

        criticAnimationRef.current = requestAnimationFrame(animate);
    };

    const followWriter = () => {
        if (writerAutoFollowRef.current && reportContainerRef.current) {
            smoothFollowWriter(reportContainerRef.current);
        }
    };

    const followCritic = () => {
        if (criticAutoFollowRef.current && criticContainerRef.current) {
            smoothFollowCritic(criticContainerRef.current);
        }
    };

    useEffect(() => {
        return () => {
            stopWriterScrollAnimation();
            stopCriticScrollAnimation();
        };
    }, []);

    const startResearch = async (e) => {
        if (e) e.preventDefault();
        if (!topic.trim() || running) return;

        stopWriterScrollAnimation();
        stopCriticScrollAnimation();

        writerAutoFollowRef.current = true;
        setWriterAutoFollow(true);
        criticAutoFollowRef.current = true;
        setCriticAutoFollow(true);

        setRunning(true);
        setError("");
        setActiveTopic(topic.trim());
        setReaderContent("");
        setReport("");
        setFeedback("");
        setCurrentAgent(null);

        setAgents({
            search: { ...initialAgents.search },
            reader: { ...initialAgents.reader },
            writer: { ...initialAgents.writer },
            critic: { ...initialAgents.critic },
        });

        try {
            const response = await fetch("https://multi-agent-ai-research-cr4w.onrender.com/research/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: topic.trim() }),
            });

            if (!response.ok) {
                throw new Error(`Execution error: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error("Stream reader initialization failed.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() || "";

                for (const rawEvent of events) {
                    if (!rawEvent.startsWith("data:")) continue;
                    const jsonString = rawEvent.replace(/^data:\s*/, "").trim();
                    if (!jsonString) continue;

                    try {
                        const data = JSON.parse(jsonString);

                        if (data.type === "agent") {
                            setCurrentAgent(data.agent);
                            setAgents((prev) => ({
                                ...prev,
                                [data.agent]: {
                                    ...prev[data.agent],
                                    status: data.status,
                                    message: data.message,
                                },
                            }));
                        } else if (data.type === "token") {
                            setCurrentAgent(data.agent);
                            if (data.agent === "writer") {
                                setReport((prev) => prev + data.content);
                                requestAnimationFrame(followWriter);
                            } else if (data.agent === "critic") {
                                setFeedback((prev) => prev + data.content);
                                requestAnimationFrame(followCritic);
                            }
                        } else if (data.type === "complete") {
                            if (data.report) setReport(data.report);
                            if (data.feedback) setFeedback(data.feedback);
                            if (data.scraped_content || data.search_result) {
                                setReaderContent(data.scraped_content || data.search_result);
                            }
                            setCurrentAgent(null);
                            setRunning(false);
                            setAgents((prev) => ({
                                search: { ...prev.search, status: "completed", message: "Search complete" },
                                reader: { ...prev.reader, status: "completed", message: "Analysis complete" },
                                writer: { ...prev.writer, status: "completed", message: "Report generated" },
                                critic: { ...prev.critic, status: "completed", message: "Evaluation complete" },
                            }));
                        }
                    } catch (err) {
                        console.error("Failed to parse event packet", err);
                    }
                }
            }
        } catch (err) {
            setError(err.message || "Network execution pipeline error.");
            setRunning(false);
            setCurrentAgent(null);
        }
    };

    // Safe Inline Bold Text Formatter (No ** output)
    const renderCleanText = (text) => {
        if (!text) return null;

        // Remove incomplete trailing asterisk delimiters during live stream
        let sanitized = text.replace(/\*+$|\*+\s*$/, (match) => {
            return match.length % 2 !== 0 ? "" : match;
        });

        const parts = sanitized.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                return <strong key={i} className="clean-bold">{part.slice(2, -2)}</strong>;
            }
            return part.replace(/\*\*/g, "");
        });
    };

    // Stateful Stream Report Parser & UI Renderer
    const renderStructuredReport = (rawText) => {
        if (!rawText) return null;

        const majorHeadings = ["introduction", "key findings", "conclusion", "sources"];
        const rawLines = rawText.split("\n");

        const blocks = [];
        let currentFinding = null;

        rawLines.forEach((line) => {
            const trimmed = line.trim();

            // Clean string for header pattern matching
            const plainText = trimmed.replace(/\*\*/g, "").trim();
            const lowerPlain = plainText.toLowerCase();

            // 1. Detect Major Section Headings
            if (majorHeadings.includes(lowerPlain) || trimmed.startsWith("# ")) {
                if (currentFinding) {
                    blocks.push({ type: "finding", ...currentFinding });
                    currentFinding = null;
                }
                blocks.push({
                    type: "section_header",
                    title: plainText.replace(/^#\s*/, ""),
                });
                return;
            }

            // 2. Detect "Finding N:" Card Titles
            if (/^(finding\s+\d+|key\0*takeaway|insight\s+\d+)/i.test(lowerPlain) || /^finding\s+\d+/i.test(plainText)) {
                if (currentFinding) {
                    blocks.push({ type: "finding", ...currentFinding });
                }
                currentFinding = {
                    title: plainText,
                    paragraphs: [],
                };
                return;
            }

            // 3. Collect lines into active Finding Card or Standard Paragraphs
            if (trimmed !== "") {
                if (currentFinding) {
                    currentFinding.paragraphs.push(line);
                } else {
                    blocks.push({ type: "paragraph", content: line });
                }
            } else if (currentFinding && currentFinding.paragraphs.length > 0) {
                currentFinding.paragraphs.push("");
            }
        });

        if (currentFinding) {
            blocks.push({ type: "finding", ...currentFinding });
        }

        // Render Clean Structural Blocks
        return (
            <div className="report-stream-view">
                {blocks.map((block, idx) => {
                    if (block.type === "section_header") {
                        return (
                            <div key={idx} className="report-major-section">
                                <h2 className="section-title-heading">{block.title}</h2>
                                <div className="section-title-line"></div>
                            </div>
                        );
                    }

                    if (block.type === "finding") {
                        return (
                            <div key={idx} className="research-finding-card">
                                <div className="finding-card-header">
                                    <span className="finding-card-icon">◈</span>
                                    <h4 className="finding-card-title">{block.title}</h4>
                                </div>
                                <div className="finding-card-body">
                                    {block.paragraphs.map((p, pIdx) => {
                                        if (p.trim() === "") return <div key={pIdx} className="card-spacer" />;
                                        if (p.trim().startsWith("- ") || p.trim().startsWith("* ")) {
                                            return <li key={pIdx} className="card-li">{renderCleanText(p.trim().substring(2))}</li>;
                                        }
                                        return <p key={pIdx} className="card-p">{renderCleanText(p)}</p>;
                                    })}
                                </div>
                            </div>
                        );
                    }

                    if (block.type === "paragraph") {
                        if (block.content.trim().startsWith("- ") || block.content.trim().startsWith("* ")) {
                            return <li key={idx} className="standard-li">{renderCleanText(block.content.trim().substring(2))}</li>;
                        }
                        return <p key={idx} className="standard-p">{renderCleanText(block.content)}</p>;
                    }

                    return null;
                })}
            </div>
        );
    };

    const getAgentStatusClass = (status) => {
        if (status === "running") return "node-running";
        if (status === "completed") return "node-completed";
        return "node-waiting";
    };

    return (
        <div className="lab-root">
            {/* TOP NAVIGATION */}
            <nav className="lab-nav">
                <div className="nav-brand">
                    <div className="nav-logo-symbol">
                        <span className="symbol-inner"></span>
                    </div>
                    <div className="nav-title-group">
                        <span className="nav-title">RESEARCH LAB</span>
                        <span className="nav-subtitle">MULTI-AGENT INTELLIGENCE</span>
                    </div>
                </div>
                <div className="nav-status-group">
                    <span className={`status-indicator-dot ${running ? "active" : "ready"}`}></span>
                    <span className="status-indicator-text">
                        {running ? "SYSTEM ACTIVE" : "SYSTEM READY"}
                    </span>
                </div>
            </nav>

            <main className="lab-container">
                {/* HERO SECTION */}
                <section className="hero-section">
                    <div className="hero-eyebrow">
                        <span className="eyebrow-line"></span>
                        <span className="eyebrow-text">AUTONOMOUS RESEARCH SYSTEM</span>
                    </div>
                    <h1 className="hero-heading">
                        What should we <span className="hero-heading-muted">investigate?</span>
                    </h1>
                    <p className="hero-subtitle">
                        Search. Read. Write. Critique. Watch autonomous research unfold in real time.
                    </p>

                    <form onSubmit={startResearch} className="research-input-wrapper">
                        <input
                            type="text"
                            className="research-input"
                            placeholder="Enter a research topic..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={running}
                        />
                        <button
                            type="submit"
                            className={`research-button ${running ? "button-running" : ""}`}
                            disabled={running || !topic.trim()}
                        >
                            {running ? (
                                <>
                                    <span className="button-pulse-dot"></span>
                                    RESEARCHING
                                </>
                            ) : (
                                <>
                                    START RESEARCH <span className="button-arrow">↗</span>
                                </>
                            )}
                        </button>
                    </form>
                </section>

                {/* ERROR STATE */}
                {error && (
                    <div className="error-panel">
                        <div className="error-header">RESEARCH FAILED</div>
                        <div className="error-body">{error}</div>
                    </div>
                )}

                {/* LIVE RESEARCH SESSION */}
                {(running || activeTopic) && (
                    <div className="session-bar">
                        <div className="session-info">
                            <span className="session-label">LIVE RESEARCH TRACE</span>
                            <span className="session-topic">{activeTopic}</span>
                        </div>
                        <div className="session-badge-wrapper">
                            {running ? (
                                <span className="session-badge badge-live">
                                    <span className="pulse-ring"></span> LIVE
                                </span>
                            ) : (
                                <span className="session-badge badge-complete">COMPLETE</span>
                            )}
                        </div>
                    </div>
                )}

                {/* AGENT PIPELINE / AGENT MAP */}
                <section className="pipeline-section">
                    <div className="pipeline-grid">
                        {Object.entries(agents).map(([key, agent], index) => {
                            const statusClass = getAgentStatusClass(agent.status);
                            return (
                                <div key={key} className="pipeline-step-wrapper">
                                    <div className={`agent-node ${statusClass}`}>
                                        <div className="node-header">
                                            <span className="node-name">{agent.name}</span>
                                            <span className="node-icon">
                                                {agent.status === "running" && <span className="spinner-dot"></span>}
                                                {agent.status === "completed" && "✓"}
                                                {agent.status === "waiting" && "◦"}
                                            </span>
                                        </div>
                                        <div className="node-message">{agent.message}</div>
                                    </div>
                                    {index < 3 && <div className={`pipeline-connector ${statusClass}`}></div>}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* READER AGENT PANEL */}
                {(agents.reader.status !== "waiting" || readerContent) && (
                    <section className="agent-panel reader-panel">
                        <div className="panel-header">
                            <div className="panel-title-group">
                                <span className="panel-agent-tag">READER AGENT</span>
                                <h3 className="panel-heading">Source Analysis</h3>
                            </div>
                            {agents.reader.status === "running" && (
                                <span className="panel-activity-tag">
                                    <span className="activity-dot"></span> PARSING SOURCES
                                </span>
                            )}
                        </div>
                        <div className="panel-scroll-container reader-scroll-box">
                            <div className="reader-text-content">
                                {readerContent ? (
                                    <p>{readerContent}</p>
                                ) : (
                                    <span className="placeholder-text">Extracting structure, references, and relevant source telemetry...</span>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* WRITER AGENT PANEL */}
                {(agents.writer.status !== "waiting" || report) && (
                    <section className="agent-panel writer-panel">
                        <div className="panel-header">
                            <div className="panel-title-group">
                                <span className="panel-agent-tag">WRITER AGENT</span>
                                <h3 className="panel-heading">Research Report</h3>
                            </div>
                            <div className="panel-actions">
                                {!writerAutoFollow && running && currentAgent === "writer" && (
                                    <button onClick={enableWriterAutoFollow} className="follow-live-btn">
                                        ↓ FOLLOW LIVE
                                    </button>
                                )}
                                {agents.writer.status === "running" && (
                                    <span className="panel-activity-tag">
                                        <span className="activity-dot"></span> GENERATING
                                    </span>
                                )}
                            </div>
                        </div>
                        {agents.writer.status === "running" && <div className="panel-progress-line"></div>}

                        <div
                            ref={reportContainerRef}
                            className="panel-scroll-container writer-scroll-box"
                            onWheel={() => currentAgent === "writer" && disableWriterAutoFollow()}
                            onTouchMove={() => currentAgent === "writer" && disableWriterAutoFollow()}
                        >
                            <div className="report-markdown-body">
                                {renderStructuredReport(report)}
                                {agents.writer.status === "running" && (
                                    <span className="streaming-cursor">▌</span>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* CRITIC AGENT PANEL */}
                {(agents.critic.status !== "waiting" || feedback) && (
                    <section className="agent-panel critic-panel">
                        <div className="panel-header">
                            <div className="panel-title-group">
                                <span className="panel-agent-tag">CRITIC AGENT</span>
                                <h3 className="panel-heading">Quality Evaluation</h3>
                            </div>
                            <div className="panel-actions">
                                {!criticAutoFollow && running && currentAgent === "critic" && (
                                    <button onClick={enableCriticAutoFollow} className="follow-live-btn">
                                        ↓ FOLLOW LIVE
                                    </button>
                                )}
                                {agents.critic.status === "running" && (
                                    <span className="panel-activity-tag">
                                        <span className="activity-dot"></span> ANALYZING
                                    </span>
                                )}
                            </div>
                        </div>
                        {agents.critic.status === "running" && <div className="panel-progress-line"></div>}

                        <div
                            ref={criticContainerRef}
                            className="panel-scroll-container critic-scroll-box"
                            onWheel={() => currentAgent === "critic" && disableCriticAutoFollow()}
                            onTouchMove={() => currentAgent === "critic" && disableCriticAutoFollow()}
                        >
                            <div className="critic-markdown-body">
                                {renderStructuredReport(feedback)}
                                {agents.critic.status === "running" && (
                                    <span className="streaming-cursor">▌</span>
                                )}
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}