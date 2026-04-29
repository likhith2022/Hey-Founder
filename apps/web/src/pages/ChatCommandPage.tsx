import { useEffect, useRef, useState } from "react";
import { Bot, ChevronRight, MessageSquare, Play, Send, Sparkles, Terminal, Users, Zap } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/layout/PageHeader";
import { api, list } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: string;
  data?: any;
  loading?: boolean;
  error?: boolean;
};

const SUGGESTIONS = [
  "What's the current company status?",
  "Ask CEO to build the company",
  "Plan the active goal",
  "List all active agents",
  "Show pending approvals",
  "Run all todo tasks",
  "Show latest work products"
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export function ChatCommandPage({ companyId }: { companyId: string }) {
  const { data: agentsData } = useApi(async () => {
    const agents = await list<any>("agents");
    return agents.filter(a => a.company_id === companyId && a.status === "active");
  }, [companyId]);
  const agents = agentsData ?? [];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Hello, Founder! I'm your AI Company Command Center. Tell me what you need — I'll route your request to the right agent or take action directly.\n\nTry asking me to **build the company**, **plan a goal**, **run tasks**, or **check status**.",
    }
  ]);
  const [input, setInput] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");

    const userMsg: Message = { id: uid(), role: "user", content: msg };
    const assistantMsg: Message = { id: uid(), role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const response = await fetch("/api/chat/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId, message: msg, agentId: selectedAgentId })
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";
      let finalAction: string | undefined;
      let finalData: any;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "thinking") {
              setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: `_${event.message}_`, loading: true } : m));
            } else if (event.type === "result") {
              finalContent = event.message;
              finalAction = event.action;
              finalData = event.data;
            } else if (event.type === "error") {
              finalContent = event.message;
              setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: finalContent, error: true, loading: false } : m));
            } else if (event.type === "done") {
              setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: finalContent || "Done.", loading: false, action: finalAction, data: finalData } : m));
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Command failed";
      setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: `❌ ${errMsg}`, error: true, loading: false } : m));
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  };

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col">
      <PageHeader
        title="Command Center"
        description="Run your company through a single chat interface — ask, approve, review, execute."
        action={<Badge tone="green"><Zap className="h-3 w-3" />Live</Badge>}
      />
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="h-full overflow-auto">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Sparkles className="h-4 w-4 text-accent" />
              Quick Commands
            </div>
            <div className="space-y-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendMessage(s)}
                  disabled={streaming}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
                >
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-6 border-t border-line pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <Terminal className="h-3 w-3" />
                How it works
              </div>
              <ol className="space-y-2 text-xs text-slate-500">
                <li>1. Type a plain-English command</li>
                <li>2. Intent router selects the right action</li>
                <li>3. CEO Agent or tool executes it</li>
                <li>4. Result streams back in real-time</li>
              </ol>
            </div>
          </Card>
        </aside>

        {/* Chat area */}
        <div className="flex flex-1 flex-col min-w-0">
          <Card className="flex flex-1 flex-col overflow-hidden p-0 min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} onSend={sendMessage} />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Agent Selector */}
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-line bg-slate-900/50 px-4 py-3 backdrop-blur-sm">
              <div className="flex shrink-0 items-center gap-1.5 pr-2 border-r border-line/50 mr-1">
                <Users className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recipient</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedAgentId("")}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    !selectedAgentId 
                      ? "border-accent bg-accent/10 text-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.2)]" 
                      : "border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  System (CEO)
                </button>
                {agents.map((agent: any) => (
                  <button 
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      selectedAgentId === agent.id 
                        ? "border-sky-400 bg-sky-400/10 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]" 
                        : "border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Input bar */}
            <div className="border-t border-line p-4 bg-slate-900/30">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/20">
                  <MessageSquare className="h-4 w-4 text-accent" />
                </div>
                <input
                  ref={inputRef}
                  id="chat-input"
                  className="flex-1 rounded-md border border-line bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-accent focus:outline-none"
                  placeholder={selectedAgentId ? `Message ${agents.find((a: any) => a.id === selectedAgentId)?.name}...` : "Ask your company anything — plan, run, build, status..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={streaming}
                />
                <Button onClick={() => void sendMessage()} disabled={!input.trim() || streaming} id="chat-send-btn">
                  <Send className="h-4 w-4" />
                  {streaming ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg, onSend }: { msg: Message; onSend: (text: string) => void }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${isUser ? "bg-sky-500 text-white" : "bg-slate-700 text-slate-200"}`}>
        {isUser ? "F" : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${isUser ? "bg-sky-600 text-white" : msg.error ? "border border-red-500/40 bg-red-950/40 text-red-100" : "border border-line bg-panel text-slate-200"}`}>
        {msg.loading && msg.content.startsWith("_") ? (
          <span className="italic text-slate-400">{msg.content.slice(1, -1)}</span>
        ) : (
          <FormattedMessage content={msg.content} />
        )}
        {msg.loading && !msg.content && (
          <span className="flex items-center gap-1 text-slate-500">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </span>
        )}
        {msg.action && !msg.loading && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1 mb-3">
              <Badge tone="green">{msg.action}</Badge>
              {msg.data && Object.entries(msg.data).filter(([k]) => typeof msg.data[k] === "number").map(([k, v]) => (
                <Badge key={k}>{k}: {String(v)}</Badge>
              ))}
            </div>
            {msg.action === "plan_goal" && (
              <Button onClick={() => onSend("run all tasks")} variant="secondary" className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200">
                <Play className="h-4 w-4 mr-1 text-emerald-400" /> Yes, run all tasks
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FormattedMessage({ content }: { content: string }) {
  // Simple markdown-ish rendering: bold, bullet lists
  const lines = content.split("\n");
  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("• ")) {
          return <div key={i} className="flex gap-2"><span className="text-accent">•</span><span>{renderInline(line.slice(2))}</span></div>;
        }
        if (line.startsWith("## ")) return <div key={i} className="mt-2 font-semibold text-slate-100">{line.slice(3)}</div>;
        if (line.startsWith("# ")) return <div key={i} className="mt-2 text-base font-bold text-slate-100">{line.slice(2)}</div>;
        if (line === "---") return <hr key={i} className="my-2 border-line" />;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Handle **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-white">{part.slice(2, -2)}</strong>
      : part
  );
}
