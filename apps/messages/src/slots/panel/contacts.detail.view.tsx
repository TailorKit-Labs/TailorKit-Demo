import { useRef, useState } from "preact/hooks";
import { defineView } from "tailorkit/client";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Flex,
  Form,
  Heading,
  Select,
  Separator,
  Spinner,
  Text,
  Textarea,
  tools,
  type ViewProps,
} from "#tailorkit";
import {
  channels,
  encodeMessage,
  examples,
  MAX_MESSAGE_LENGTH,
  type Channel,
} from "../../messages";
import { useMessages } from "../../use-messages";

const view = defineView({ view: "/contacts/detail", component: ContactMessages });
type Contact = ViewProps<"/contacts/detail">["context"]["contact"];

function ContactMessages() {
  const { workspace, contact } = view.useContext();
  return (
    <Conversation
      key={`${workspace.id}:${contact.id}`}
      workspaceId={workspace.id}
      contact={contact}
    />
  );
}

function MessageBubble({
  body,
  outgoing = false,
  time,
}: {
  body: string;
  outgoing?: boolean;
  time?: string;
}) {
  const space = <Box width="avatar" shrink="0" />;
  return (
    <Flex justify={outgoing ? "end" : "start"} align="start" gap="sm">
      {outgoing ? space : null}
      <Flex direction="column" align={outgoing ? "end" : "start"} gap="xs" shrink="1">
        <Box
          background={outgoing ? "primary" : "muted"}
          textColor={outgoing ? "onPrimary" : "default"}
          padding="md"
          radius="2xl"
          overflowWrap="anywhere"
        >
          <Text text={body} size="sm" />
        </Box>
        {time ? <Text text={time} size="xs" tone="muted" /> : null}
      </Flex>
      {!outgoing ? space : null}
    </Flex>
  );
}

function Conversation({ workspaceId, contact }: { workspaceId: string; contact: Contact }) {
  const { contacts, messages, setMessages, loading, error, setError, reload } = useMessages(
    workspaceId,
    contact.id,
  );
  const [selectedChannel, setChannel] = useState<Channel>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const sample = examples[contacts.findIndex((item) => item.id === contact.id)];
  const channel = selectedChannel ?? messages.at(-1)?.channel ?? sample?.channel ?? "Email";

  async function send() {
    if (sendLock.current || loading || !draft.length || draft.length > MAX_MESSAGE_LENGTH) return;
    sendLock.current = true;
    setSending(true);
    setError("");
    try {
      const body = draft;
      const result = await tools.activities.addNote({
        contactId: contact.id,
        body: encodeMessage(channel, body),
      });
      setMessages((current) => [
        ...current,
        {
          id: result.id,
          contactId: contact.id,
          channel,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
      // A failed host refresh must not turn a successful save into a failed send.
      void tools.ui.refresh().catch(() => {});
      void tools.ui.notify({ title: "Message sent", type: "success" }).catch(() => {});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your message. Your draft is still here.",
      );
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  return (
    <Flex direction="column" gap="md" height="100%" minHeight="0" overflow="auto">
      <Heading text="Messages" level="h2" />
      <Flex align="center" gap="sm" shrink="0">
        <Avatar name={contact.name} />
        <Flex direction="column" gap="2xs">
          <Text text={contact.name} size="sm" />
          <Text text={channel === "Email" ? contact.email : channel} size="xs" tone="muted" />
        </Flex>
      </Flex>
      {loading ? <Spinner label="Loading conversation" /> : null}
      {error ? (
        <Flex direction="column" gap="sm" shrink="0">
          <Alert title="Something went wrong" description={error} variant="error" />
          <Button
            label="Reload conversation"
            variant="outline"
            disabled={sending}
            onClick={reload}
          />
        </Flex>
      ) : null}
      {!loading ? (
        <>
          <Box shrink="0">
            <Select
              label="Send via"
              value={channel}
              options={channels.map((value) => ({ label: value, value }))}
              disabled={sending}
              onChange={({ value }) => {
                if (channels.some((item) => item === value)) setChannel(value as Channel);
              }}
            />
          </Box>
          <Separator />
          <Flex direction="column" gap="md" grow="1" basis="0" minHeight="0" overflow="auto">
            {sample?.channel === channel ? <MessageBubble body={sample.body} /> : null}
            {messages
              .filter((message) => message.channel === channel)
              .map((message) => (
                <MessageBubble
                  key={message.id}
                  body={message.body}
                  outgoing
                  time={new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
              ))}
          </Flex>
          <Separator />
          <Box shrink="0">
            <Form
              submitLabel={sending ? "Sending…" : "Send"}
              disabled={sending || !draft.length || draft.length > MAX_MESSAGE_LENGTH}
              onSubmit={() => void send()}
            >
              <Textarea
                label="Message"
                value={draft}
                placeholder="Write a message…"
                disabled={sending}
                required
                onChange={({ value }) => setDraft(value)}
              />
              <Flex justify="end">
                <Text
                  text={`${draft.length}/${MAX_MESSAGE_LENGTH}`}
                  size="xs"
                  tone={draft.length > MAX_MESSAGE_LENGTH ? "destructive" : "muted"}
                />
              </Flex>
            </Form>
          </Box>
        </>
      ) : null}
    </Flex>
  );
}

export default view;
