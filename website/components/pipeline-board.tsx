"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { Deal, Workspace } from "@/lib/workspace";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { RecordDialog } from "@/components/record-dialog";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { ContactAvatar } from "@/components/contact-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, MenuGroup, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const stages = ["qualified", "proposal", "negotiation", "won", "lost"] as const;
const dealType = "pipeline-deal";
const touchOptions = { enableMouseEvents: true, delayTouchStart: 200, touchSlop: 8 };
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
type DraggedDeal = { id: string; stage: Deal["stage"] };
type DealMove = DraggedDeal & { targetId?: string; placement?: "before" | "after" };
type MoveHandler = (move: DealMove) => void;

function reorderDeals(current: Deal[], move: DealMove) {
  const source = current.find((deal) => deal.id === move.id);
  if (!source || move.targetId === move.id) return current;
  const next = current.filter((deal) => deal.id !== move.id);
  const targetIndex = move.targetId ? next.findIndex((deal) => deal.id === move.targetId) : -1;
  const destination = next.filter((deal) => deal.stage === move.stage);
  const last = destination.at(-1);
  const insertIndex =
    targetIndex >= 0
      ? targetIndex + (move.placement === "after" ? 1 : 0)
      : last
        ? next.findIndex((deal) => deal.id === last.id) + 1
        : next.length;
  next.splice(insertIndex, 0, { ...source, stage: move.stage });
  return next;
}

export function PipelineBoard({ workspace, deals }: { workspace: Workspace; deals: Deal[] }) {
  const mutation = useMutation(orpc.deals.move.mutationOptions());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [touch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );
  const [visibleDeals, moveOptimistically] = useOptimistic(deals, reorderDeals);

  function moveDeal(move: DealMove) {
    if (pending || move.id === move.targetId) return;
    const reordered = reorderDeals(visibleDeals, move);
    if (
      reordered.every(
        (deal, index) =>
          deal.id === visibleDeals[index].id && deal.stage === visibleDeals[index].stage,
      )
    )
      return;
    setError("");
    startTransition(async () => {
      moveOptimistically(move);
      try {
        await mutation.mutateAsync(move);
      } catch {
        setError("Could not move this deal. Please try again.");
      }
    });
  }

  return (
    <DndProvider
      backend={touch ? TouchBackend : HTML5Backend}
      options={touch ? touchOptions : undefined}
    >
      {error ? (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <ScrollArea
        className="h-auto min-w-0 max-w-full rounded-lg border"
        role="region"
        aria-label="Deal pipeline"
        aria-busy={pending}
      >
        <div className="flex w-max min-w-full items-stretch gap-4 p-4">
          {stages.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              deals={visibleDeals.filter((deal) => deal.stage === stage)}
              workspace={workspace}
              pending={pending}
              onMove={moveDeal}
            />
          ))}
        </div>
      </ScrollArea>
    </DndProvider>
  );
}

function PipelineColumn({
  stage,
  deals,
  workspace,
  pending,
  onMove,
}: {
  stage: Deal["stage"];
  deals: Deal[];
  workspace: Workspace;
  pending: boolean;
  onMove: MoveHandler;
}) {
  const [{ active }, drop] = useDrop<DraggedDeal, void, { active: boolean }>(
    () => ({
      accept: dealType,
      canDrop: () => !pending,
      drop: (item, monitor) => {
        if (!monitor.didDrop()) onMove({ id: item.id, stage });
      },
      // Include nested card targets so the destination stays highlighted while sorting.
      collect: (monitor) => ({ active: monitor.isOver() && monitor.canDrop() }),
    }),
    [pending, stage, onMove],
  );

  return (
    <Frame
      ref={(node) => {
        drop(node);
      }}
      role="region"
      aria-label={label(stage)}
      className={cn(
        "min-h-80 w-80 min-w-80 flex-1 transition-colors",
        active && "bg-accent ring-2 ring-primary/40 ring-inset",
      )}
    >
      <FrameHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <FrameTitle>
            <h2>{label(stage)}</h2>
          </FrameTitle>
          <Badge variant="secondary">{deals.length}</Badge>
        </div>
        <FrameDescription className="tabular-nums">
          {money(deals.reduce((sum, deal) => sum + deal.value, 0))}
        </FrameDescription>
      </FrameHeader>
      {deals.map((deal) => (
        <PipelineCard
          key={deal.id}
          deal={deal}
          workspace={workspace}
          pending={pending}
          onMove={onMove}
        />
      ))}
      {!deals.length ? (
        <FramePanel>
          <FrameDescription>Drop a deal here</FrameDescription>
        </FramePanel>
      ) : null}
    </Frame>
  );
}

function PipelineCard({
  deal,
  workspace,
  pending,
  onMove,
}: {
  deal: Deal;
  workspace: Workspace;
  pending: boolean;
  onMove: MoveHandler;
}) {
  const removeDeal = useMutation(orpc.deals.delete.mutationOptions());
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const deletePending = removeDeal.isPending;
  const [error, setError] = useState("");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<"before" | "after">("before");
  const [{ over }, drop] = useDrop<DraggedDeal, void, { over: boolean }>(
    () => ({
      accept: dealType,
      canDrop: () => !pending,
      hover: (item, monitor) => {
        if (item.id === deal.id || pending) return;
        const rect = cardRef.current?.getBoundingClientRect();
        const pointer = monitor.getClientOffset();
        if (rect && pointer)
          setPlacement(pointer.y < rect.top + rect.height / 2 ? "before" : "after");
      },
      drop: (item, monitor) => {
        if (item.id === deal.id) return;
        const rect = cardRef.current?.getBoundingClientRect();
        const pointer = monitor.getClientOffset();
        const side =
          rect && pointer && pointer.y >= rect.top + rect.height / 2 ? "after" : "before";
        onMove({ id: item.id, stage: deal.stage, targetId: deal.id, placement: side });
      },
      collect: (monitor) => ({
        over:
          monitor.isOver({ shallow: true }) &&
          monitor.canDrop() &&
          monitor.getItem()?.id !== deal.id,
      }),
    }),
    [pending, deal.id, deal.stage, onMove],
  );
  const contact = workspace.contacts.find((item) => item.id === deal.contactId);
  const [{ dragging }, drag] = useDrag<DraggedDeal, void, { dragging: boolean }>(
    () => ({
      type: dealType,
      item: { id: deal.id, stage: deal.stage },
      canDrag: !pending && !editing && !deleting && !menuOpen,
      collect: (monitor) => ({ dragging: monitor.isDragging() }),
    }),
    [deal.id, deal.stage, pending, editing, deleting, menuOpen],
  );

  async function remove() {
    setError("");
    try {
      await removeDeal.mutateAsync({ id: deal.id });
      setDeleting(false);
    } catch {
      setError("Could not delete this deal. Please try again.");
    }
  }

  return (
    <>
      <FramePanel
        ref={(node) => {
          cardRef.current = node;
          drag(drop(node));
        }}
        className={cn("group cursor-grab active:cursor-grabbing", dragging && "opacity-40")}
      >
        {over ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-primary",
              placement === "before" ? "-top-0.5" : "-bottom-0.5",
            )}
          />
        ) : null}
        <div className="grid auto-rows-min grid-cols-[1fr_auto] items-start gap-x-4 gap-y-3 pb-4">
          <FrameTitle className="min-w-0 break-words">{deal.title}</FrameTitle>
          <FrameDescription>
            <Badge variant="secondary" className="tabular-nums">
              {money(deal.value)}
            </Badge>
          </FrameDescription>
          <div className="col-start-2 row-span-2 row-start-1 inline-flex justify-self-end">
            <Menu open={menuOpen} onOpenChange={setMenuOpen}>
              <MenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={"Actions for " + deal.title} />
                }
                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => event.preventDefault()}
              >
                <Ellipsis />
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuGroup>
                  <MenuItem onClick={() => setEditing(true)}>
                    <Pencil />
                    Edit
                  </MenuItem>
                  <MenuItem
                    variant="destructive"
                    onClick={() => {
                      setError("");
                      setDeleting(true);
                    }}
                  >
                    <Trash2 />
                    Delete
                  </MenuItem>
                </MenuGroup>
              </MenuPopup>
            </Menu>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          {contact ? (
            <Link
              href={"/contacts/" + contact.id}
              draggable={false}
              className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:underline"
            >
              <ContactAvatar contact={contact} className="size-6 shrink-0" />
              <span className="truncate">{contact.name}</span>
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Unassigned</span>
          )}
          <time
            dateTime={deal.closeDate}
            title="Expected close"
            className="shrink-0 text-xs text-muted-foreground"
          >
            {new Date(deal.closeDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </div>
      </FramePanel>
      <RecordDialog
        kind="deal"
        workspace={workspace}
        deal={deal}
        trigger={null}
        open={editing}
        onOpenChange={setEditing}
      />
      <Dialog
        open={deleting}
        onOpenChange={(open) => {
          if (!deletePending) setDeleting(open);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Delete this deal?</DialogTitle>
            <DialogDescription>
              {deal.title} will be removed from your workspace. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={deletePending} onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletePending} onClick={remove}>
              {deletePending ? "Deleting…" : "Delete deal"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
