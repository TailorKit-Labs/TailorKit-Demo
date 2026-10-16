import { useEffect, useRef, useState } from "preact/hooks";
import { defineView } from "tailorkit/client";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Combobox,
  Empty,
  Flex,
  Form,
  Grid,
  Heading,
  Input,
  Select,
  Separator,
  Spinner,
  Text,
  Textarea,
  tools,
} from "#tailorkit";
import {
  channels,
  encodeMessage,
  examples,
  MAX_MESSAGE_LENGTH,
  readMessages,
  type Channel,
  type Contact,
  type Message,
} from "../../messages";

const view = defineView({ view: "/", component: Messages });

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

function Messages() {
  const context = view.useContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [channel, setChannel] = useState<Channel>("Email");
  const [filter, setFilter] = useState("All channels");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.all([tools.contacts.list({}), tools.activities.list({})]).then(
      ([contactResult, activityResult]) => {
        if (cancelled) return;
        setContacts(contactResult.contacts);
        setMessages(readMessages(activityResult.activities));
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setError("Couldn't load your inbox. Please try again.");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, context.workspace.id]);

  useEffect(() => {
    const match = /^\/contacts\/([^/]+)$/.exec(context.page);
    if (match) {
      setRecipientId(match[1]);
      setComposing(true);
      setDraft("");
    }
  }, [context.page]);

  const recipient = contacts.find((contact) => contact.id === recipientId);
  const seeded = contacts.slice(0, 3).map((contact, index) => ({ contact, ...examples[index] }));
  const threads = contacts
    .flatMap((contact) => {
      const sent = messages.filter((message) => message.contactId === contact.id);
      const latest = sent.at(-1) ?? seeded.find((item) => item.contact.id === contact.id);
      if (
        !latest ||
        (filter !== "All channels" && latest.channel !== filter) ||
        !`${contact.name} ${contact.company} ${latest.body}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return [];
      return [{ contact, latest, hasSent: sent.length > 0 }];
    })
    .sort((a, b) => Number(b.hasSent) - Number(a.hasSent));

  function openThread(contactId: string, nextChannel: Channel) {
    setRecipientId(contactId);
    setChannel(nextChannel);
    setDraft("");
    setError("");
    setComposing(true);
  }

  async function send() {
    if (sendLock.current || !recipient || !draft.trim()) return;
    sendLock.current = true;
    setSending(true);
    setError("");
    try {
      const body = draft.trim();
      const result = await tools.activities.addNote({
        contactId: recipient.id,
        body: encodeMessage(channel, body),
      });
      setMessages((current) => [
        ...current,
        {
          id: result.id,
          contactId: recipient.id,
          channel,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
      // A failed host refresh must not turn a successful save into a failed send.
      void tools.ui.refresh().catch(() => {});
      void tools.ui
        .notify({
          title: "Message sent",
          type: "success",
        })
        .catch(() => {});
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
    <Flex direction="column" gap="md">
      <Flex justify="between" align="center" gap="sm">
        <Heading text="Messages" level="h2" />
        {!loading && !composing ? (
          <Button
            label="New message"
            size="sm"
            disabled={contacts.length === 0}
            onClick={() => openThread(contacts[0].id, "Email")}
          />
        ) : null}
      </Flex>
      {loading ? <Spinner label="Loading your inbox" /> : null}
      {error ? (
        <Flex direction="column" gap="sm">
          <Alert title="Something went wrong" description={error} variant="error" />
          <Button
            label="Reload inbox"
            variant="outline"
            disabled={sending}
            onClick={() => {
              setComposing(false);
              setAttempt((value) => value + 1);
            }}
          />
        </Flex>
      ) : null}
      {!loading && !composing ? (
        <>
          <Grid columns={2} gap="sm">
            <Input
              label="Search"
              type="search"
              value={query}
              placeholder="Search inbox…"
              onChange={({ value }) => setQuery(value)}
            />
            <Select
              label="Channel"
              value={filter}
              options={["All channels", ...channels].map((value) => ({ label: value, value }))}
              onChange={({ value }) => setFilter(value)}
            />
          </Grid>
          {threads.length === 0 ? (
            <Empty
              title={
                contacts.length === 0 ? "Add a contact to get started" : "No conversations found"
              }
            />
          ) : (
            <Flex direction="column" gap="none">
              <Separator />
              {threads.map(({ contact, latest, hasSent }) => {
                const preview = `${hasSent ? "You: " : ""}${latest.body}`.replace(/\s+/g, " ");
                return (
                  <Flex key={contact.id} direction="column" gap="none">
                    <Flex justify="between" align="center" gap="sm">
                      <Button
                        label={contact.name}
                        variant="link"
                        size="sm"
                        onClick={() => openThread(contact.id, latest.channel)}
                      />
                      <Text text={latest.channel} size="xs" tone="muted" />
                    </Flex>
                    <Box padding="sm">
                      <Text
                        text={preview.length > 48 ? `${preview.slice(0, 48)}…` : preview}
                        size="sm"
                        tone="muted"
                      />
                    </Box>
                    <Separator />
                  </Flex>
                );
              })}
            </Flex>
          )}
        </>
      ) : null}
      {!loading && composing ? (
        <>
          <Flex justify="between" gap="sm">
            <Button
              label="Back to inbox"
              variant="ghost"
              size="sm"
              disabled={sending}
              onClick={() => {
                setComposing(false);
                setError("");
              }}
            />
            {recipient ? (
              <Button
                label="View contact"
                variant="link"
                size="sm"
                disabled={sending}
                onClick={() => {
                  void tools.ui
                    .navigate({ href: `/contacts/${recipient.id}` })
                    .catch(() => setError("Couldn't open the contact. Please try again."));
                }}
              />
            ) : null}
          </Flex>
          <Combobox
            label="To"
            placeholder="Search contacts…"
            emptyMessage="No contacts found."
            value={recipientId}
            options={contacts.map((contact) => ({
              label: `${contact.name} · ${contact.company}`,
              value: contact.id,
              description: contact.email,
            }))}
            disabled={sending}
            onChange={({ value }) => openThread(value, channel)}
          />
          <Select
            label="Send via"
            value={channel}
            options={channels.map((value) => ({ label: value, value }))}
            disabled={sending}
            onChange={({ value }) => {
              if (channels.some((item) => item === value)) {
                setChannel(value as Channel);
              }
            }}
          />
          {recipient ? (
            <Flex align="center" gap="sm">
              <Avatar name={recipient.name} />
              <Flex direction="column" gap="2xs">
                <Text text={recipient.name} size="sm" />
                <Text
                  text={channel === "Email" ? recipient.email : channel}
                  size="xs"
                  tone="muted"
                />
              </Flex>
            </Flex>
          ) : (
            <Empty title="Choose a contact" />
          )}
          <Flex direction="column" gap="md">
            {seeded
              .filter((item) => item.contact.id === recipientId && item.channel === channel)
              .map((item) => (
                <MessageBubble key={item.contact.id} body={item.body} />
              ))}
            {messages
              .filter((message) => message.contactId === recipientId && message.channel === channel)
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
          <Form
            submitLabel={sending ? "Sending…" : "Send"}
            disabled={
              sending || !recipient || !draft.trim() || draft.trim().length > MAX_MESSAGE_LENGTH
            }
            onSubmit={() => {
              void send();
            }}
          >
            <Textarea
              label="Message"
              value={draft}
              placeholder="Write a message…"
              disabled={sending}
              required
              onChange={({ value }) => {
                setDraft(value);
              }}
            />
            <Flex justify="between" gap="sm" align="center">
              <Button
                label="Quick reply"
                variant="ghost"
                size="sm"
                disabled={sending || !recipient}
                onClick={() =>
                  setDraft(
                    `Hi ${recipient?.name.split(" ")[0] ?? "there"}, thanks for reaching out! I'll send over the next steps shortly.`,
                  )
                }
              />
              <Text
                text={`${draft.trim().length}/${MAX_MESSAGE_LENGTH}`}
                size="xs"
                tone={draft.trim().length > MAX_MESSAGE_LENGTH ? "destructive" : "muted"}
              />
            </Flex>
          </Form>
        </>
      ) : null}
    </Flex>
  );
}

export default view;
