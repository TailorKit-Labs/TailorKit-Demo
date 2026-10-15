"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, PencilIcon } from "lucide-react";
import { toastManager } from "@/components/ui/toast";
import type { Contact, Deal, Workspace } from "@/lib/workspace";
import { rpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogPanel,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RecordDialog({
  kind,
  workspace,
  contact,
  deal,
  defaultContactId,
  defaultDueDate,
  trigger,
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: {
  kind: "contact" | "deal" | "task";
  workspace: Pick<Workspace, "contacts" | "deals" | "tasks">;
  contact?: Contact;
  deal?: Deal;
  defaultContactId?: string;
  defaultDueDate?: string;
  trigger?: React.ReactElement | null;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const prefix = useId();
  const recordLabel = kind === "task" ? "follow-up" : kind;
  const editing = (kind === "contact" && !!contact) || !!deal;
  const count =
    kind === "contact"
      ? workspace.contacts.length
      : kind === "deal"
        ? workspace.deals.length
        : workspace.tasks.length;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => {
      const entry = data.get(name);
      return typeof entry === "string" ? entry.trim() : "";
    };
    setError("");
    startTransition(async () => {
      try {
        if (kind === "contact") {
          const input = {
            name: value("name"),
            email: value("email"),
            company: value("company"),
            role: value("role"),
            status: value("status") as Contact["status"],
          };
          if (contact) await rpc.contacts.update({ ...input, id: contact.id });
          else await rpc.contacts.create(input);
        } else if (kind === "deal") {
          const input = {
            title: value("title"),
            contactId: value("contactId") || null,
            value: Number(value("value")),
            stage: value("stage") as Deal["stage"],
            closeDate: value("closeDate"),
          };
          if (deal) await rpc.deals.update({ ...input, id: deal.id });
          else await rpc.deals.create(input);
        } else {
          await rpc.tasks.create({
            title: value("title"),
            dueDate: value("dueDate"),
            contactId: value("contactId") || null,
          });
        }
        setOpen(false);
        toastManager.add({ type: "success", title: editing ? "Changes saved" : "Record created" });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save. Please try again.");
      }
    });
  }
  const id = (name: string) => prefix + name;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
        }
      }}
    >
      {trigger !== null ? (
        <DialogTrigger
          disabled={!editing && count >= 50}
          render={trigger ?? <Button variant={editing ? "outline" : "default"} />}
        >
          {editing ? (
            <PencilIcon data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          {triggerLabel ?? (editing ? "Edit " : "New ") + recordLabel}
        </DialogTrigger>
      ) : null}
      <DialogPopup closeProps={{ disabled: pending }}>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit " : "New "}
            {recordLabel}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details in your workspace."
              : "Keep your next opportunity moving forward."}
          </DialogDescription>
        </DialogHeader>
        <form
          key={JSON.stringify(contact ?? deal ?? kind)}
          onSubmit={submit}
          className="flex min-h-0 flex-col"
        >
          <DialogPanel>
            <div className="flex flex-col gap-6">
              {kind === "contact" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor={id("name")}>Full name</FieldLabel>
                    <Input
                      id={id("name")}
                      name="name"
                      required
                      maxLength={80}
                      defaultValue={contact?.name}
                      autoComplete="name"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={id("email")}>Email address</FieldLabel>
                    <Input
                      id={id("email")}
                      name="email"
                      type="email"
                      required
                      maxLength={120}
                      defaultValue={contact?.email}
                      autoComplete="email"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={id("company")}>Company</FieldLabel>
                      <Input
                        id={id("company")}
                        name="company"
                        required
                        maxLength={80}
                        defaultValue={contact?.company}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={id("role")}>Job title</FieldLabel>
                      <Input
                        id={id("role")}
                        name="role"
                        required
                        maxLength={80}
                        defaultValue={contact?.role}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={id("status")}>Relationship</FieldLabel>
                    <Select
                      name="status"
                      items={[
                        { value: "lead", label: "Lead" },
                        { value: "active", label: "Active" },
                        { value: "customer", label: "Customer" },
                      ]}
                      defaultValue={contact?.status ?? "lead"}
                    >
                      <SelectTrigger id={id("status")} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        <SelectGroup>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                        </SelectGroup>
                      </SelectPopup>
                    </Select>
                  </Field>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor={id("title")}>
                      {kind === "deal" ? "Deal name" : "What needs to happen?"}
                    </FieldLabel>
                    <Input
                      id={id("title")}
                      name="title"
                      required
                      maxLength={120}
                      defaultValue={deal?.title}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={id("contactId")}>Contact</FieldLabel>
                    <Select
                      name="contactId"
                      items={[
                        { value: "", label: "No contact" },
                        ...workspace.contacts.map((c) => ({
                          value: c.id,
                          label: c.name + " · " + c.company,
                        })),
                      ]}
                      defaultValue={deal?.contactId ?? defaultContactId ?? ""}
                    >
                      <SelectTrigger id={id("contactId")} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        <SelectGroup>
                          <SelectItem value="">No contact</SelectItem>
                          {workspace.contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} · {c.company}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectPopup>
                    </Select>
                  </Field>
                  {kind === "deal" ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={id("value")}>Value (USD)</FieldLabel>
                          <Input
                            id={id("value")}
                            name="value"
                            type="number"
                            min={0}
                            max={1000000}
                            step={1}
                            required
                            defaultValue={deal?.value}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={id("closeDate")}>Expected close</FieldLabel>
                          <Input
                            id={id("closeDate")}
                            name="closeDate"
                            type="date"
                            required
                            defaultValue={deal?.closeDate.slice(0, 10)}
                          />
                        </Field>
                      </div>
                      <Field>
                        <FieldLabel htmlFor={id("stage")}>Stage</FieldLabel>
                        <Select
                          name="stage"
                          items={["qualified", "proposal", "negotiation", "won", "lost"].map(
                            (s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }),
                          )}
                          defaultValue={deal?.stage ?? "qualified"}
                        >
                          <SelectTrigger id={id("stage")} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopup>
                            <SelectGroup>
                              {["qualified", "proposal", "negotiation", "won", "lost"].map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectPopup>
                        </Select>
                      </Field>
                    </>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor={id("dueDate")}>Due date</FieldLabel>
                      <Input
                        id={id("dueDate")}
                        name="dueDate"
                        type="date"
                        defaultValue={defaultDueDate}
                        required
                      />
                    </Field>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {count} of 50{" "}
                {kind === "contact" ? "contacts" : kind === "deal" ? "deals" : "tasks"} used in this
                demo workspace.
              </p>
              {error ? (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Saving…" : editing ? "Save changes" : "Create " + recordLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
