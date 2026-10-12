"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import type { ChatStatus } from "ai";
import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CheckIcon,
  ChevronRightIcon,
  ListTodoIcon,
  Maximize2Icon,
  Minimize2Icon,
  MousePointer2Icon,
  PlusIcon,
  SquareIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import type { CrmAgentMessage } from "@/lib/agents/crm-agent";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ToolPart = Extract<CrmAgentMessage["parts"][number], { type: `tool-${string}` }>;
const toolTitles = {
  "tool-listDeals": "View deals",
  "tool-listContacts": "Find contacts",
  "tool-createDeal": "Add a deal",
  "tool-moveDeal": "Move a deal",
  "tool-listTasks": "View follow-ups",
  "tool-createTask": "Add a follow-up",
  "tool-setTaskCompleted": "Update a follow-up",
};
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

function AgentLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return href?.startsWith("/") ? (
    <Link href={href} {...props}>
      {children}
    </Link>
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
const markdownComponents = { a: AgentLink };

function ToolResult({ part }: { part: ToolPart }) {
  return (
    <Tool className="mb-0" defaultOpen={part.state === "output-error"}>
      <ToolHeader type={part.type} state={part.state} title={toolTitles[part.type]} />
      <ToolContent>
        {part.state === "output-error" ? (
          <p className="text-sm text-destructive">{part.errorText}</p>
        ) : null}
        {part.state === "output-available" ? <CompletedTool part={part} /> : null}
        {part.state === "input-streaming" || part.state === "input-available" ? (
          <p className="text-sm text-muted-foreground">Working in your workspace…</p>
        ) : null}
      </ToolContent>
    </Tool>
  );
}

function CompletedTool({ part }: { part: ToolPart }) {
  if (part.state !== "output-available") return null;
  switch (part.type) {
    case "tool-listDeals":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {part.output.count} deals · {money(part.output.totalValue)} total
          </p>
          {part.output.deals.length ? (
            part.output.deals.map((deal) => (
              <div key={deal.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{deal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {deal.company ?? "No linked contact"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span>{money(deal.value)}</span>
                  <Badge variant="outline">{deal.stage}</Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No matching deals.</p>
          )}
          <RecordLink href="/pipeline">View pipeline</RecordLink>
        </div>
      );
    case "tool-listContacts":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{part.output.count} matching contacts</p>
          {part.output.contacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className="flex flex-col gap-0.5 text-sm hover:underline"
            >
              <span>{contact.name}</span>
              <span className="text-xs text-muted-foreground">{contact.company}</span>
            </Link>
          ))}
          <RecordLink href="/contacts">View contacts</RecordLink>
        </div>
      );
    case "tool-listTasks":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{part.output.count} matching follow-ups</p>
          {part.output.tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{task.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {task.completed ? "Completed" : task.dueDate}
              </span>
            </div>
          ))}
          <RecordLink href="/tasks">View follow-ups</RecordLink>
        </div>
      );
    case "tool-createDeal":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {part.output.deal.title} · {money(part.output.deal.value)}
          </p>
          <RecordLink href="/pipeline">View deal in pipeline</RecordLink>
        </div>
      );
    case "tool-moveDeal":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Moved to {part.output.stage}.</p>
          <RecordLink href="/pipeline">View pipeline</RecordLink>
        </div>
      );
    case "tool-createTask":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {part.output.task.title} · Due {part.output.task.dueDate}
          </p>
          <RecordLink href="/tasks">View follow-up</RecordLink>
        </div>
      );
    case "tool-setTaskCompleted":
      return (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm">
            {part.output.task.completed ? <CheckIcon className="size-4" /> : null}
            {part.output.task.title} · {part.output.task.completed ? "Completed" : "Reopened"}
          </p>
          <RecordLink href="/tasks">View follow-up</RecordLink>
        </div>
      );
  }
}

function RecordLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button render={<Link href={href} />} variant="outline" size="sm" className="w-fit">
      {children}
      <ChevronRightIcon data-icon="inline-end" />
    </Button>
  );
}

export function AgentChat({
  chatTitle,
  messages,
  input,
  onInputChange,
  onSubmit,
  status,
  error,
  onStop,
  onNewChat,
  onClose,
  canDock,
  docked,
  onDockChange,
}: {
  chatTitle: React.ReactNode;
  messages: CrmAgentMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => Promise<void>;
  status: ChatStatus;
  error?: Error;
  onStop: () => void;
  onNewChat: () => void;
  onClose: () => void;
  canDock: boolean;
  docked: boolean;
  onDockChange: () => void;
}) {
  const busy = status === "submitted" || status === "streaming";
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col"
      data-slot="agent-chat"
      onKeyDown={(event) => {
        if (docked && event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <h2 className="min-w-0">{chatTitle}</h2>
        <div className="flex items-center gap-1">
          {messages.length ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New chat"
              title="New chat"
              disabled={busy}
              onClick={onNewChat}
            >
              <SquarePenIcon />
            </Button>
          ) : null}
          {canDock ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={docked ? "Switch to popover" : "Open in side panel"}
              title={docked ? "Switch to popover" : "Open in side panel"}
              onClick={onDockChange}
            >
              {docked ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close agent"
            title="Close"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
      </header>
      <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col rounded-xl bg-linear-to-b from-muted/70 to-transparent">
        <Conversation className="min-h-0" aria-label="Agent conversation">
          <ConversationContent className="gap-5 p-4 has-data-[slot=agent-welcome]:h-full">
            {!messages.length ? (
              <ConversationEmptyState
                data-slot="agent-welcome"
                className={cn(
                  "gap-4 px-1",
                  docked ? "justify-center py-8" : "justify-end pb-8 pt-12",
                )}
              >
                <MousePointer2Icon className="mb-1 size-7 text-muted-foreground" />
                <div className="flex flex-col gap-2 text-center">
                  <h3 className="text-lg font-semibold tracking-tight">Welcome to Forma</h3>
                  <p className="max-w-64 text-sm leading-relaxed text-muted-foreground">
                    Ask a question or tell me what you’d like to do in your workspace.
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Suggestion
                    suggestion="Show me my deals."
                    onClick={(text) => {
                      void onSubmit(text);
                    }}
                    size="default"
                  >
                    <BriefcaseBusinessIcon data-icon="inline-start" />
                    View deals
                  </Suggestion>
                  <Suggestion
                    suggestion="Help me add a new deal."
                    onClick={(text) => {
                      void onSubmit(text);
                    }}
                    size="default"
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add a deal
                  </Suggestion>
                  <Suggestion
                    suggestion="Show my incomplete follow-up tasks."
                    onClick={(text) => {
                      void onSubmit(text);
                    }}
                    size="default"
                  >
                    <ListTodoIcon data-icon="inline-start" />
                    View follow-ups
                  </Suggestion>
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id} className="max-w-full">
                  <MessageContent className="w-full">
                    {message.parts.map((part, index) => {
                      if (part.type === "text")
                        return (
                          <MessageResponse
                            key={index}
                            isAnimating={busy && message === messages.at(-1)}
                            components={markdownComponents}
                          >
                            {part.text}
                          </MessageResponse>
                        );
                      if (part.type.startsWith("tool-"))
                        return <ToolResult key={index} part={part as ToolPart} />;
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Spinner />
                Thinking…
              </div>
            ) : null}
            {error ? (
              <Alert variant="error">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="shrink-0 p-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && input.trim()) void onSubmit(input);
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                aria-label="Message agent"
                placeholder="Type a message…"
                value={input}
                onChange={(event) => onInputChange(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={4000}
                className="text-left"
              />
              <InputGroupAddon align="block-end">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type={busy ? "button" : "submit"}
                        onClick={busy ? onStop : undefined}
                        aria-label={busy ? "Stop response" : "Send message"}
                        disabled={!busy && !input.trim()}
                        className="ml-auto rounded-full"
                        size="icon-sm"
                      />
                    }
                  >
                    {busy ? <SquareIcon /> : <ArrowRightIcon />}
                  </TooltipTrigger>
                  <TooltipPopup>{busy ? "Stop response" : "Send"}</TooltipPopup>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </div>
  );
}
