import type { TailorKitTools } from "#tailorkit";

export const channels = ["Email", "Slack", "SMS"] as const;
export type Channel = (typeof channels)[number];
export type Contact = Awaited<ReturnType<TailorKitTools["contacts"]["list"]>>["contacts"][number];
export type Activity = Awaited<
  ReturnType<TailorKitTools["activities"]["list"]>
>["activities"][number];
export type Message = {
  id: string;
  contactId: string;
  channel: Channel;
  body: string;
  createdAt: string;
};
const prefix = "Demo message · ";
export const MAX_MESSAGE_LENGTH = 800;

export function encodeMessage(channel: Channel, body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) throw new Error("Use 1–800 characters.");
  return `${prefix}${channel}\n${trimmed}`;
}

export function readMessages(activities: Activity[]): Message[] {
  return activities
    .flatMap((activity) => {
      if (
        activity.type !== "note" ||
        !activity.contactId ||
        !activity.description.startsWith(prefix)
      )
        return [];
      const content = activity.description.slice(prefix.length);
      const newline = content.indexOf("\n");
      const channel = channels.find((item) => item === content.slice(0, newline));
      const body = content.slice(newline + 1);
      if (!channel || !body.trim()) return [];
      return [
        {
          id: activity.id,
          contactId: activity.contactId,
          channel,
          body,
          createdAt: activity.createdAt,
        },
      ];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const examples = [
  { channel: "Email", body: "Thanks for the walkthrough! Could you share the next steps?" },
  { channel: "Slack", body: "Hey! The team loved the proposal. Have a moment to catch up?" },
  { channel: "SMS", body: "Hi! Just checking we're still on for our call tomorrow." },
] satisfies { channel: Channel; body: string }[];
