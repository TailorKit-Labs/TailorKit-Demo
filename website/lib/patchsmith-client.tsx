"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "./orpc";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient, experimental_canvasRenderer, primitives } from "patchsmith/react";
import { contract, patchsmithTheme } from "./patchsmith";
import { toastManager } from "@/components/ui/toast";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "@/components/ui/dialog";

const textTones = {
  default: "text-inherit",
  muted: "text-muted-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  destructive: "text-destructive-foreground",
};
const textSizes = { xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg" };
function LabeledControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Field>
  );
}

type HostAction =
  | { type: "navigate"; href: string }
  | { type: "open-panel"; appId: string }
  | { type: "refresh" }
  | { type: "theme"; theme: "light" | "dark" | "system" };
const hostActionEvent = "patchsmith:host-action";
function dispatch(action: HostAction) {
  const detail = { action, handled: false };
  window.dispatchEvent(new CustomEvent(hostActionEvent, { detail }));
  if (!detail.handled) throw new Error("The workspace is not ready. Please try again.");
}

export const patchsmithClient = createClient({
  contract,
  theme: patchsmithTheme,
  baseUrl: new URL(
    "/api/patchsmith",
    typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
  ),
  components: {
    ...primitives,
    DoomCanvas: experimental_canvasRenderer,
    Text: ({ props }) => (
      <p className={cn(textTones[props.tone ?? "default"], textSizes[props.size ?? "sm"])}>
        {props.text}
      </p>
    ),
    Heading: ({ props }) => {
      const Tag = props.level ?? "h2";
      return <Tag className="text-lg font-semibold tracking-tight">{props.text}</Tag>;
    },
    Button: ({ props }) => (
      <Button
        variant={props.variant}
        size={props.size}
        disabled={props.disabled}
        onClick={() => props.onClick?.()}
      >
        {props.label}
      </Button>
    ),
    Badge: ({ props }) => <Badge variant={props.variant}>{props.text}</Badge>,
    Card: ({ props, children }) => (
      <Card>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          {props.description ? <CardDescription>{props.description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    ),
    Alert: ({ props }) => (
      <Alert variant={props.variant}>
        <AlertTitle>{props.title}</AlertTitle>
        {props.description ? <AlertDescription>{props.description}</AlertDescription> : null}
      </Alert>
    ),
    Empty: ({ props, children }) => (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{props.title}</EmptyTitle>
          {props.description ? <EmptyDescription>{props.description}</EmptyDescription> : null}
        </EmptyHeader>
        {children ? <EmptyContent>{children}</EmptyContent> : null}
      </Empty>
    ),
    Form: ({ props, children }) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!props.disabled) props.onSubmit?.();
        }}
      >
        <div className="flex flex-col gap-4">
          {children}
          <Button type="submit" disabled={props.disabled}>
            {props.submitLabel ?? "Save"}
          </Button>
        </div>
      </form>
    ),
    Input: ({ props }) => (
      <LabeledControl label={props.label}>
        <Input
          aria-label={props.label}
          value={props.value}
          placeholder={props.placeholder}
          type={props.type}
          disabled={props.disabled}
          required={props.required}
          onChange={(event) => props.onChange?.({ value: event.currentTarget.value })}
        />
      </LabeledControl>
    ),
    Textarea: ({ props }) => (
      <LabeledControl label={props.label}>
        <Textarea
          aria-label={props.label}
          value={props.value}
          placeholder={props.placeholder}
          disabled={props.disabled}
          required={props.required}
          onChange={(event) => props.onChange?.({ value: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (
              !props.submitOnEnter ||
              event.key !== "Enter" ||
              event.shiftKey ||
              event.ctrlKey ||
              event.altKey ||
              event.metaKey ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229
            )
              return;
            event.preventDefault();
            if (!event.repeat) event.currentTarget.form?.requestSubmit();
          }}
        />
      </LabeledControl>
    ),
    Select: ({ props }) => (
      <LabeledControl label={props.label}>
        <Select
          items={props.options}
          value={props.value}
          disabled={props.disabled}
          onValueChange={(value) => {
            if (value !== null) props.onChange?.({ value });
          }}
        >
          <SelectTrigger aria-label={props.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectGroup>
              {props.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectPopup>
        </Select>
      </LabeledControl>
    ),
    Combobox: ({ props }) => (
      <LabeledControl label={props.label}>
        <Combobox
          items={props.options}
          value={props.options.find((option) => option.value === props.value) ?? null}
          disabled={props.disabled}
          autoHighlight
          isItemEqualToValue={(option, value) => option.value === value.value}
          filter={(option, query) =>
            `${option.label} ${option.description ?? ""}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())
          }
          onValueChange={(option) => {
            if (option !== null) props.onChange?.({ value: option.value });
          }}
        >
          <ComboboxInput
            aria-label={props.label}
            placeholder={props.placeholder ?? "Search options…"}
            triggerProps={{ "aria-label": `Show ${props.label.toLocaleLowerCase()} options` }}
          />
          <ComboboxPopup>
            <ComboboxEmpty>{props.emptyMessage ?? "No results found."}</ComboboxEmpty>
            <ComboboxList>
              {(option) => (
                <ComboboxItem key={option.value} value={option}>
                  <span className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description ? (
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      </LabeledControl>
    ),
    Checkbox: ({ props }) => (
      <Field className="flex-row items-center">
        <Checkbox
          aria-label={props.label}
          checked={props.checked}
          disabled={props.disabled}
          onCheckedChange={(checked) => props.onCheckedChange?.({ checked })}
        />
        <FieldLabel>{props.label}</FieldLabel>
      </Field>
    ),
    Switch: ({ props }) => (
      <Field className="flex-row items-center">
        <Switch
          aria-label={props.label}
          checked={props.checked}
          disabled={props.disabled}
          onCheckedChange={(checked) => props.onCheckedChange?.({ checked })}
        />
        <FieldLabel>{props.label}</FieldLabel>
      </Field>
    ),
    Progress: ({ props }) => <Progress aria-label={props.label} value={props.value} />,
    Separator: ({ props }) => <Separator orientation={props.orientation} />,
    Avatar: ({ props }) => (
      <Avatar aria-label={props.name}>
        <AvatarFallback>
          {props.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>
    ),
    Spinner: ({ props }) => (
      <span role="status" className="inline-flex items-center gap-2">
        <Spinner />
        <span className="sr-only">{props.label}</span>
      </span>
    ),
    Skeleton: () => <Skeleton className="h-5 w-full" />,
    Table: ({ props, children }) => <Table aria-label={props.label}>{children}</Table>,
    TableHeader: ({ children }) => <TableHeader>{children}</TableHeader>,
    TableBody: ({ children }) => <TableBody>{children}</TableBody>,
    TableRow: ({ children }) => <TableRow>{children}</TableRow>,
    TableHead: ({ props }) => <TableHead>{props.text}</TableHead>,
    TableCell: ({ children }) => <TableCell>{children}</TableCell>,
    Dialog: ({ props, children }) => (
      <Dialog open={props.open} onOpenChange={(open) => props.onOpenChange?.({ open })}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            {props.description ? <DialogDescription>{props.description}</DialogDescription> : null}
          </DialogHeader>
          <DialogPanel>{children}</DialogPanel>
        </DialogPopup>
      </Dialog>
    ),
  },
  tools: {
    ui: {
      navigate: ({ input }) => dispatch({ type: "navigate", href: input.href }),
      openPanel: ({ context }) =>
        dispatch({ type: "open-panel", appId: context.identity.installationId }),
      refresh: () => dispatch({ type: "refresh" }),
      setTheme: ({ input }) => dispatch({ type: "theme", theme: input.theme }),
      notify: ({ input }) => {
        toastManager.add(input);
      },
    },
  },
});

export function PatchsmithProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  useEffect(() => {
    function handle(event: Event) {
      const { detail } = event as CustomEvent<{ action: HostAction; handled: boolean }>;
      if (detail.action.type === "open-panel") return;
      detail.handled = true;
      switch (detail.action.type) {
        case "navigate":
          router.push(detail.action.href);
          break;
        case "refresh":
          void queryClient.invalidateQueries({ queryKey: orpc.key() });
          break;
        case "theme":
          setTheme(detail.action.theme);
          break;
      }
    }
    window.addEventListener(hostActionEvent, handle);
    return () => window.removeEventListener(hostActionEvent, handle);
  }, [router, setTheme, queryClient]);
  return <patchsmithClient.Provider>{children}</patchsmithClient.Provider>;
}

export function usePanelAction(openApp: (appId: string) => void) {
  useEffect(() => {
    function handle(event: Event) {
      const { detail } = event as CustomEvent<{ action: HostAction; handled: boolean }>;
      if (detail.action.type !== "open-panel") return;
      openApp(detail.action.appId);
      detail.handled = true;
    }
    window.addEventListener(hostActionEvent, handle);
    return () => window.removeEventListener(hostActionEvent, handle);
  }, [openApp]);
}

export const { RenderSlot, useViews, useViewContext } = patchsmithClient;
