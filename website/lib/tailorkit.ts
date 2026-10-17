import { defineContract, tool } from "tailorkit";
import { primitives } from "tailorkit/zod";
import { z } from "zod";
import { schemas } from "../routers/schemas";
import { tailorKitTheme } from "./tailorkit-theme";

export const siteHref = z
  .string()
  .regex(
    /^\/(?:contacts(?:\/[A-Za-z0-9-]+)?|pipeline|tasks|settings|app-pages\/(?!(?:\.|%2[eE]){1,2}\?)(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-Fa-f]{2})+\?instance=(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-Fa-f]{2})+)?$/,
    "Choose a CRM page, contact detail URL, or app page URL.",
  );
// Component metadata uses TailorKit's restricted JSON Schema dialect. Refinements
// preserve runtime limits without emitting unsupported string-length keywords.
const text = z.string().refine((value) => value.length <= 4000, "Maximum 4000 characters.");
const label = z
  .string()
  .refine((value) => value.length >= 1 && value.length <= 120, "Use 1–120 characters.");
const disabled = z.boolean().optional();
const onChange = { input: z.object({ value: z.string() }) };
const onCheckedChange = { input: z.object({ checked: z.boolean() }) };
const tone = z.enum(["default", "info", "success", "warning", "error"]);
const serverTool = <I extends z.ZodType, O extends z.ZodType>(schema: { input: I; output: O }) =>
  tool.server().input(schema.input).output(schema.output);

export const contract = defineContract({
  scopes: { workspace: z.object({ workspaceId: z.string().min(1) }) },
  components: {
    ...primitives(tailorKitTheme),
    Text: {
      fields: z.object({
        text,
        tone: z.enum(["default", "muted", "success", "warning", "destructive"]).optional(),
        size: z.enum(["xs", "sm", "base", "lg"]).optional(),
      }),
    },
    Heading: { fields: z.object({ text: label, level: z.enum(["h2", "h3", "h4"]).optional() }) },
    Button: {
      fields: z.object({
        label,
        variant: z
          .enum([
            "default",
            "outline",
            "secondary",
            "ghost",
            "destructive",
            "destructive-outline",
            "link",
          ])
          .optional(),
        size: z.enum(["xs", "sm", "default", "lg"]).optional(),
        disabled,
      }),
      callbacks: { onClick: {} },
    },
    Badge: {
      fields: z.object({
        text: label,
        variant: z
          .enum([
            "default",
            "secondary",
            "outline",
            "info",
            "success",
            "warning",
            "error",
            "destructive",
          ])
          .optional(),
      }),
    },
    Card: { fields: z.object({ title: label, description: text.optional() }), children: true },
    Alert: {
      fields: z.object({ title: label, description: text.optional(), variant: tone.optional() }),
    },
    Empty: { fields: z.object({ title: label, description: text.optional() }), children: true },
    Form: {
      fields: z.object({ submitLabel: label.optional(), disabled }),
      children: true,
      callbacks: { onSubmit: {} },
    },
    Input: {
      fields: z.object({
        label,
        value: text,
        placeholder: label.optional(),
        type: z.enum(["text", "email", "number", "date", "search", "url", "tel"]).optional(),
        disabled,
        required: z.boolean().optional(),
      }),
      callbacks: { onChange },
    },
    Textarea: {
      fields: z.object({
        label,
        value: text,
        placeholder: label.optional(),
        disabled,
        required: z.boolean().optional(),
      }),
      callbacks: { onChange },
    },
    Select: {
      fields: z.object({
        label,
        value: z.string().nullable(),
        options: z
          .array(
            z.object({ label, value: z.string().refine((v) => v.length >= 1 && v.length <= 200) }),
          )
          .max(100),
        disabled,
      }),
      callbacks: { onChange },
    },
    Combobox: {
      fields: z.object({
        label,
        value: z.string().nullable(),
        options: z
          .array(
            z.object({
              label,
              value: z.string().refine((v) => v.length >= 1 && v.length <= 200),
              description: text.optional(),
            }),
          )
          .max(100),
        placeholder: label.optional(),
        emptyMessage: label.optional(),
        disabled,
      }),
      callbacks: { onChange },
    },
    Checkbox: {
      fields: z.object({ label, checked: z.boolean(), disabled }),
      callbacks: { onCheckedChange },
    },
    Switch: {
      fields: z.object({ label, checked: z.boolean(), disabled }),
      callbacks: { onCheckedChange },
    },
    Progress: { fields: z.object({ label, value: z.number().min(0).max(100) }) },
    Separator: { fields: z.object({ orientation: z.enum(["horizontal", "vertical"]).optional() }) },
    Avatar: { fields: z.object({ name: label }) },
    Spinner: { fields: z.object({ label }) },
    Skeleton: {},
    Table: { fields: z.object({ label }), children: true },
    TableHeader: { children: true },
    TableBody: { children: true },
    TableRow: { children: true },
    TableHead: { fields: z.object({ text: label }) },
    TableCell: { children: true },
    Dialog: {
      fields: z.object({ title: label, description: text.optional(), open: z.boolean() }),
      children: true,
      callbacks: { onOpenChange: { input: z.object({ open: z.boolean() }) } },
    },
  },
  tools: {
    workspace: { get: serverTool(schemas.workspace.get) },
    contacts: {
      list: serverTool(schemas.contacts.list),
      get: serverTool(schemas.contacts.get),
      create: serverTool(schemas.contacts.create),
      update: serverTool(schemas.contacts.update),
      delete: serverTool(schemas.contacts.delete),
    },
    deals: {
      list: serverTool(schemas.deals.list),
      create: serverTool(schemas.deals.create),
      update: serverTool(schemas.deals.update),
      delete: serverTool(schemas.deals.delete),
      move: serverTool(schemas.deals.move),
    },
    tasks: {
      list: serverTool(schemas.tasks.list),
      create: serverTool(schemas.tasks.create),
      update: serverTool(schemas.tasks.update),
      delete: serverTool(schemas.tasks.delete),
      setCompleted: serverTool(schemas.tasks.setCompleted),
    },
    activities: {
      list: serverTool(schemas.activities.list),
      addNote: serverTool(schemas.activities.addNote),
    },
    ui: {
      navigate: tool.client().input(z.object({ href: siteHref })),
      openPanel: tool.client(),
      refresh: tool.client(),
      setTheme: tool.client().input(z.object({ theme: z.enum(["light", "dark", "system"]) })),
      notify: tool.client().input(
        z.object({
          title: label,
          description: text.optional(),
          type: z.enum(["success", "error", "info", "warning"]).optional(),
        }),
      ),
    },
  },
  views: {
    "/": z.object({ workspace: z.object({ id: z.string(), name: z.string() }), page: z.string() }),
    "/contacts/detail": z.object({
      contact: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        company: z.string(),
      }),
    }),
  },
  slots: {
    navbar: { views: ["/"] },
    panel: { views: ["/", "/contacts/detail"] },
    page: { views: ["/"], multiple: true },
  },
});
