"use client";

import { useState, useTransition } from "react";
import { AppPageHeading } from "@/components/app/app-page-header";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Mail,
  MessageSquare,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace, Contact, Deal, Task } from "@/lib/workspace";
import { useViewContext } from "@/lib/tailorkit-client";
import {
  addNote,
  deleteContact,
  deleteDeal,
  deleteTask,
  toggleTask,
  updateDeal,
} from "@/lib/actions";
import { SectionCards } from "@/components/section-cards";
import { DashboardTable } from "@/components/dashboard-table";
import { RecordDialog } from "@/components/record-dialog";
import { PipelineBoard } from "@/components/pipeline-board";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardFrame,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DataTablePagination,
  PageSelection,
  SortableTableHead,
  TableStatus,
  useTableSelection,
} from "@/components/data-table-controls";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "@/components/contact-avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CrmChart = dynamic(() => import("@/components/crm-chart").then((module) => module.CrmChart), {
  loading: () => <Skeleton className="h-[370px] w-full" />,
});

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const stages = ["qualified", "proposal", "negotiation", "won", "lost"] as const;
type Result = { success: true; id?: string } | { success: false; error: string };

function useMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function run(action: () => Promise<Result>, after?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.success) setError(result.error);
        else {
          after?.();
          router.refresh();
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }
  return { pending, error, run };
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <Alert variant="error">
      <AlertTitle>Could not save your change</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}
function NoResults({
  title = "Nothing here yet",
  description = "Add a record to get started.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
function ContactLink({ contact }: { contact?: Contact }) {
  return contact ? (
    <Link
      href={"/contacts/" + contact.id}
      className="inline-flex max-w-full items-center gap-2 hover:underline"
    >
      <ContactAvatar contact={contact} className="size-6" />
      <span>{contact.name}</span>
    </Link>
  ) : (
    <span className="text-muted-foreground">Unassigned</span>
  );
}
function DeleteButton({
  action,
  name,
  after,
}: {
  action: () => Promise<Result>;
  name: string;
  after?: () => void;
}) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={"Delete " + name} />}
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this {name}?</DialogTitle>
          <DialogDescription>
            {name === "contact"
              ? "Their activity notes will be removed. Linked deals and tasks will remain, without this contact."
              : "This record will be removed from your workspace."}{" "}
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <ErrorMessage error={mutation.error} />
        <DialogFooter>
          <Button variant="outline" disabled={mutation.pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.pending}
            onClick={() =>
              mutation.run(action, () => {
                setOpen(false);
                after?.();
              })
            }
          >
            {mutation.pending ? "Deleting…" : "Delete " + name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function PageHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <AppPageHeading>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </AppPageHeading>
  );
}
export function TaskRow({ task, workspace }: { task: Task; workspace: Workspace }) {
  const mutation = useMutation();
  const overdue =
    !task.completed && task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3 py-3">
        <Checkbox
          className="mt-1"
          checked={task.completed}
          disabled={mutation.pending}
          onCheckedChange={() => mutation.run(() => toggleTask(task.id))}
          aria-label={"Mark " + task.title + (task.completed ? " incomplete" : " complete")}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              "text-sm font-medium",
              task.completed && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {date(task.dueDate)}
            </span>
            {overdue && <Badge variant="outline">Overdue</Badge>}
            {task.contactId && (
              <ContactLink
                contact={workspace.contacts.find((contact) => contact.id === task.contactId)}
              />
            )}
          </div>
        </div>
        <DeleteButton action={() => deleteTask(task.id)} name="task" />
      </div>
      <ErrorMessage error={mutation.error} />
    </div>
  );
}
function DealCard({ deal, workspace }: { deal: Deal; workspace: Workspace }) {
  const mutation = useMutation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{deal.title}</CardTitle>
        <CardDescription>
          <ContactLink
            contact={workspace.contacts.find((contact) => contact.id === deal.contactId)}
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xl font-semibold tabular-nums">{money(deal.value)}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3" />
          Expected close {date(deal.closeDate)}
        </p>
        <ErrorMessage error={mutation.error} />
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <Select
          value={deal.stage}
          disabled={mutation.pending}
          items={stages.map((stage) => ({ value: stage, label: label(stage) }))}
          onValueChange={(value) => {
            if (value !== null)
              mutation.run(() =>
                updateDeal(deal.id, {
                  title: deal.title,
                  contactId: deal.contactId,
                  value: deal.value,
                  closeDate: deal.closeDate,
                  stage: value as Deal["stage"],
                }),
              );
          }}
        >
          <SelectTrigger size="sm" aria-label={"Stage for " + deal.title}>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectGroup>
              {stages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {label(stage)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectPopup>
        </Select>
        <div className="flex items-center gap-1">
          <RecordDialog kind="deal" workspace={workspace} deal={deal} />
          <DeleteButton action={() => deleteDeal(deal.id)} name="deal" />
        </div>
      </CardFooter>
    </Card>
  );
}
function Overview({ workspace }: { workspace: Workspace }) {
  useViewContext("/overview", {
    context: {
      contacts: workspace.contacts,
      deals: workspace.deals,
      tasks: workspace.tasks,
      activities: workspace.activities,
    },
  });
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <PageHeading title="Overview">
        <RecordDialog kind="deal" workspace={workspace} />
      </PageHeading>
      <SectionCards workspace={workspace} />
      <CrmChart deals={workspace.deals} />
      <DashboardTable workspace={workspace} />
    </div>
  );
}
function Contacts({ workspace }: { workspace: Workspace }) {
  useViewContext("/contacts", { context: { contacts: workspace.contacts } });
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"name" | "company" | "email">("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  function changeSort(column: typeof sort) {
    setDirection(column === sort && direction === "asc" ? "desc" : "asc");
    setSort(column);
    setPage(1);
  }
  const filtered = workspace.contacts.filter(
    (contact) =>
      (status === "all" || contact.status === status) &&
      [contact.name, contact.email, contact.company, contact.role]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selection = useTableSelection(filtered.map((contact) => contact.id));
  const sorted = [...filtered].sort((a, b) => {
    const result = a[sort].localeCompare(b[sort]);
    return direction === "asc" ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * 10;
  const visibleContacts = sorted.slice(offset, offset + 10);
  const pageIds = visibleContacts.map((contact) => contact.id);
  return (
    <>
      <PageHeading title="Contacts">
        <RecordDialog kind="contact" workspace={workspace} />
      </PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          aria-label="Search contacts"
          placeholder="Search name, company or email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <ToggleGroup
          multiple={false}
          value={[status]}
          onValueChange={(value) => {
            setStatus(value[0] ?? "all");
            setPage(1);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="lead">Leads</ToggleGroupItem>
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="customer">Customers</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <CardFrame className="w-full">
        <Table variant="card" className="min-w-[880px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: 36 }}>
                <PageSelection
                  ids={pageIds}
                  selected={selection.selected}
                  onChange={(checked) => selection.togglePage(pageIds, checked)}
                />
              </TableHead>
              <SortableTableHead
                style={{ width: "24%" }}
                direction={sort === "name" ? direction : undefined}
                onSort={() => changeSort("name")}
              >
                Name
              </SortableTableHead>
              <SortableTableHead
                style={{ width: "22%" }}
                direction={sort === "company" ? direction : undefined}
                onSort={() => changeSort("company")}
              >
                Company
              </SortableTableHead>
              <SortableTableHead
                style={{ width: "26%" }}
                direction={sort === "email" ? direction : undefined}
                onSort={() => changeSort("email")}
              >
                Email
              </SortableTableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-28 text-right">Pipeline</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">View contact</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleContacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                data-state={selection.selected.has(contact.id) ? "selected" : undefined}
                onClick={(event) => {
                  if (
                    event.defaultPrevented ||
                    (event.target as HTMLElement).closest("a, button, input, [role=checkbox]")
                  ) {
                    return;
                  }
                  router.push("/contacts/" + contact.id);
                }}
              >
                <TableCell>
                  <Checkbox
                    aria-label={"Select " + contact.name}
                    checked={selection.selected.has(contact.id)}
                    onCheckedChange={(checked) => selection.toggle(contact.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <ContactLink contact={contact} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="truncate font-medium" title={contact.company}>
                      {contact.company}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{contact.role}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <a
                    className="block truncate text-muted-foreground hover:underline"
                    href={"mailto:" + contact.email}
                  >
                    {contact.email}
                  </a>
                </TableCell>
                <TableCell>
                  <TableStatus status={contact.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(
                    workspace.deals
                      .filter((deal) => deal.contactId === contact.id && deal.stage !== "lost")
                      .reduce((sum, deal) => sum + deal.value, 0),
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"

                    render={<Link href={"/contacts/" + contact.id} />}
                    aria-label={"View " + contact.name}
                  >
                    <ArrowUpRight />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No contacts found. Try a different search or add a contact.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <DataTablePagination
          total={filtered.length}
          page={currentPage}
          onPageChange={setPage}
          label="Contact"
          selected={selection.count}
        />
      </CardFrame>
    </>
  );
}
function Pipeline({ workspace }: { workspace: Workspace }) {
  useViewContext("/pipeline", {
    context: { deals: workspace.deals, contacts: workspace.contacts },
  });
  const [search, setSearch] = useState("");
  const filtered = workspace.deals.filter((deal) =>
    (
      deal.title +
      " " +
      (workspace.contacts.find((contact) => contact.id === deal.contactId)?.company ?? "")
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading title="Pipeline">
        <RecordDialog kind="deal" workspace={workspace} />
      </PageHeading>
      <Input
        className="max-w-sm"
        placeholder="Search opportunities or companies…"
        aria-label="Search opportunities"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {!filtered.length ? (
        <NoResults
          title="No opportunities found"
          description="Try another search or add your next opportunity."
        />
      ) : (
        <PipelineBoard workspace={workspace} deals={filtered} />
      )}
    </>
  );
}
function ContactDetail({ workspace, contact }: { workspace: Workspace; contact: Contact }) {
  const router = useRouter();
  const mutation = useMutation();
  const [note, setNote] = useState("");
  const deals = workspace.deals.filter((deal) => deal.contactId === contact.id);
  const tasks = workspace.tasks.filter((task) => task.contactId === contact.id);
  const activities = workspace.activities.filter((activity) => activity.contactId === contact.id);
  useViewContext("/contacts", { context: { contacts: workspace.contacts } });
  useViewContext("/contacts/detail", { context: { contact, deals, tasks, activities } });
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/contacts" />}>
          <ArrowLeft data-icon="inline-start" />
          Contacts
        </Button>
      </div>
      <PageHeading title={contact.name}>
        <div className="flex items-center gap-2">
          <RecordDialog kind="contact" workspace={workspace} contact={contact} />
          <DeleteButton
            action={() => deleteContact(contact.id)}
            name="contact"
            after={() => router.push("/contacts")}
          />
        </div>
      </PageHeading>
      <div className="grid items-start gap-5 xl:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <ContactAvatar contact={contact} className="size-10" />
              <CardTitle>{contact.name}</CardTitle>
              <CardDescription>{contact.company}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Badge variant="outline">{label(contact.status)}</Badge>
              <a
                href={"mailto:" + contact.email}
                className="flex items-center gap-2 text-sm break-all hover:underline"
              >
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                {contact.email}
              </a>
              <Separator />
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{contact.role}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>{date(contact.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total deal value</dt>
                  <dd className="font-medium">
                    {money(deals.reduce((sum, deal) => sum + deal.value, 0))}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
              <CardDescription>Keep the conversation moving.</CardDescription>
              <CardAction>
                <RecordDialog kind="task" workspace={workspace} defaultContactId={contact.id} />
              </CardAction>
            </CardHeader>
            <CardContent>
              {tasks.length ? (
                tasks.map((task) => <TaskRow key={task.id} task={task} workspace={workspace} />)
              ) : (
                <NoResults
                  title="No follow-ups"
                  description="Add a follow-up to plan your next step."
                />
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
              <CardDescription>Every deal connected to this relationship.</CardDescription>
              <CardAction>
                <RecordDialog kind="deal" workspace={workspace} defaultContactId={contact.id} />
              </CardAction>
            </CardHeader>
            <CardContent>
              {deals.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {deals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} workspace={workspace} />
                  ))}
                </div>
              ) : (
                <NoResults
                  title="A fresh opportunity"
                  description="Create a deal and choose this contact to link it here."
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Activity & notes</CardTitle>
              <CardDescription>The full story behind the relationship.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.run(
                    () => addNote(contact.id, note),
                    () => setNote(""),
                  );
                }}
              >
                <div className="flex flex-col gap-6">
                  <Field>
                    <FieldLabel htmlFor="contact-note">Add a note</FieldLabel>
                    <Textarea
                      id="contact-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Meeting notes, useful context, or the next step…"
                      maxLength={1000}
                      required
                      rows={3}
                    />
                  </Field>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {note.length}/1,000 characters
                    </span>
                    <Button type="submit" disabled={mutation.pending || !note.trim()}>
                      <MessageSquare data-icon="inline-start" />
                      {mutation.pending ? "Saving…" : "Save note"}
                    </Button>
                  </div>
                  <ErrorMessage error={mutation.error} />
                </div>
              </form>
              <Separator />
              {activities.length ? (
                <div className="flex flex-col gap-5">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <MessageSquare className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={activity.createdAt}
                          >
                            {date(activity.createdAt)}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {activity.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <NoResults
                  title="Start the conversation"
                  description="Save a note to keep important context in one place."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
function Tasks({ workspace }: { workspace: Workspace }) {
  useViewContext("/tasks", { context: { tasks: workspace.tasks, contacts: workspace.contacts } });
  return (
    <>
      <PageHeading title="Follow-ups">
        <RecordDialog kind="task" workspace={workspace} />
      </PageHeading>
      <Card>
        <CardHeader>
          <CardTitle>Workspace follow-ups</CardTitle>
          <CardDescription>Keep track of the next step across every relationship.</CardDescription>
        </CardHeader>
        <CardContent>
          {workspace.tasks.length ? (
            workspace.tasks.map((task) => (
              <TaskRow key={task.id} task={task} workspace={workspace} />
            ))
          ) : (
            <NoResults title="No follow-ups" description="Add a follow-up to get started." />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Settings({ workspace }: { workspace: Workspace }) {
  useViewContext("/settings", {
    context: {
      usage: {
        contacts: workspace.contacts.length,
        deals: workspace.deals.length,
        tasks: workspace.tasks.length,
      },
    },
  });
  const usage = [
    { name: "Contacts", count: workspace.contacts.length },
    { name: "Deals", count: workspace.deals.length },
    { name: "Tasks", count: workspace.tasks.length },
  ];
  return (
    <>
      <PageHeading title="Workspace" />
      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Workspace usage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {usage.map((item) => (
              <div key={item.name} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">{item.count} / 50</span>
                </div>
                <Progress value={item.count * 2} aria-label={item.name + " usage"} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function CrmPages({
  workspace,
  view,
  contactId,
}: {
  workspace: Workspace;
  view: "overview" | "contacts" | "pipeline" | "tasks" | "settings";
  contactId?: string;
}) {
  if (contactId) {
    const contact = workspace.contacts.find((item) => item.id === contactId);
    return contact ? (
      <ContactDetail workspace={workspace} contact={contact} />
    ) : (
      <NoResults
        title="Contact not found"
        description="This contact may have been deleted. Return to Contacts to continue."
      />
    );
  }
  switch (view) {
    case "contacts":
      return <Contacts workspace={workspace} />;
    case "pipeline":
      return <Pipeline workspace={workspace} />;
    case "tasks":
      return <Tasks workspace={workspace} />;
    case "settings":
      return <Settings workspace={workspace} />;
    default:
      return <Overview workspace={workspace} />;
  }
}
