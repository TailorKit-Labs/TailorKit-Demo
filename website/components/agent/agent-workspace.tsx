"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { HistoryIcon, MousePointer2Icon, PlusIcon } from "lucide-react";
import type { CrmAgentMessage } from "@/lib/agents/crm-agent";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const AgentChat = dynamic(() => import("./agent-chat").then((module) => module.AgentChat), {
  loading: () => (
    <div className="flex h-full items-center justify-center" role="status">
      <Spinner />
      <span className="sr-only">Loading agent</span>
    </div>
  ),
});

type SavedChat = { id: string; title: string; messages: CrmAgentMessage[] };
const transport = new DefaultChatTransport<CrmAgentMessage>({ api: "/api/agent" });

export function AgentWorkspace({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const canDock = useMediaQuery("xl");
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, setMessages, sendMessage, status, stop, error, clearError } =
    useChat<CrmAgentMessage>({
      transport,
      // Refresh even after cancellation: a tool may already have committed a change.
      onFinish: () => router.refresh(),
      onError: () => router.refresh(),
    });
  const busy = status === "submitted" || status === "streaming";
  const showPanel = open && docked && canDock;

  function archiveCurrentChat() {
    if (!messages.length) return;
    const title =
      messages
        .find((message) => message.role === "user")
        ?.parts.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ") ?? "Chat";
    const id = messages[0].id;
    setHistory((previous) =>
      [{ id, title, messages }, ...previous.filter((chat) => chat.id !== id)].slice(0, 8),
    );
  }

  function newChat() {
    if (busy) return;
    archiveCurrentChat();
    setMessages([]);
    setInput("");
    clearError();
    setHistoryOpen(false);
    setOpen(true);
  }

  function restoreChat(chat: SavedChat) {
    if (busy) return;
    archiveCurrentChat();
    setMessages(chat.messages);
    setInput("");
    clearError();
    setHistoryOpen(false);
    setOpen(true);
  }

  async function submit(text: string) {
    if (!text.trim() || busy) return;
    clearError();
    setInput("");
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const page = pathname.startsWith("/contacts/") ? "/contacts" : pathname;
    await sendMessage(
      { text: text.trim() },
      {
        body: { page, date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    );
  }

  const chat = (
    <AgentChat
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSubmit={submit}
      status={status}
      error={error}
      onStop={() => {
        void stop();
        router.refresh();
      }}
      onNewChat={newChat}
      onClose={() => setOpen(false)}
      canDock={canDock}
      docked={showPanel}
      onDockChange={() => setDocked((value) => !value)}
    />
  );

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 gap-2">
        <section
          aria-label="Workspace content"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:rounded-2xl md:border md:shadow-xs"
        >
          {children}
        </section>
        {showPanel ? (
          <aside
            aria-label="Agent"
            className="flex w-[390px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-popover shadow-xs"
          >
            {chat}
          </aside>
        ) : null}
      </div>
      <footer
        aria-label="Workspace tools"
        className="flex h-12 shrink-0 items-center justify-end gap-1 px-3 md:px-4"
      >
        <Popover open={open && !showPanel} onOpenChange={setOpen}>
          {showPanel ? (
            <Button
              variant="secondary"
              size="sm"
              aria-expanded
              aria-label="Agent"
              onClick={() => setOpen(false)}
            >
              <MousePointer2Icon data-icon="inline-start" />
              Agent
            </Button>
          ) : (
            <PopoverTrigger
              render={<Button variant={open ? "secondary" : "ghost"} size="sm" />}
              aria-label="Agent"
            >
              <MousePointer2Icon data-icon="inline-start" />
              Agent
            </PopoverTrigger>
          )}
          <PopoverPopup
            side="top"
            align="end"
            sideOffset={10}
            aria-label="Agent chat"
            initialFocus={false}
            className="agent-popover h-[min(620px,calc(100dvh-150px))] w-[min(440px,calc(100vw-24px))] rounded-2xl shadow-xl"
          >
            {chat}
          </PopoverPopup>
        </Popover>
        <Popover
          open={historyOpen}
          onOpenChange={(next) => {
            setHistoryOpen(next);
            if (next && !showPanel) setOpen(false);
          }}
        >
          <PopoverTrigger
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label="Chat history"
            title="Chat history"
          >
            <HistoryIcon />
          </PopoverTrigger>
          <PopoverPopup side="top" align="end" sideOffset={10} className="w-72">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <PopoverTitle>Recent chats</PopoverTitle>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={newChat}
                  disabled={busy}
                  aria-label="Start a new chat"
                >
                  <PlusIcon />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Chats from this session.</p>
              {messages.length ? (
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setHistoryOpen(false);
                    setOpen(true);
                  }}
                >
                  Current chat
                </Button>
              ) : null}
              {history.map((saved) => (
                <Button
                  key={saved.id}
                  variant="ghost"
                  className="justify-start"
                  disabled={busy}
                  onClick={() => restoreChat(saved)}
                >
                  <span className="truncate">{saved.title}</span>
                </Button>
              ))}
              {!history.length && !messages.length ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Your conversations will appear here.
                </p>
              ) : null}
            </div>
          </PopoverPopup>
        </Popover>
        <span className={cn("sr-only", !busy && "hidden")} role="status">
          Agent is working
        </span>
      </footer>
    </>
  );
}
