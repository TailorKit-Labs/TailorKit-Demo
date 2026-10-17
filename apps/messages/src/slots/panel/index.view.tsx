import { useState } from "preact/hooks";
import { defineView } from "tailorkit/client";
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Flex,
  Grid,
  Heading,
  Input,
  Pressable,
  Select,
  Separator,
  Spinner,
  Text,
  tools,
} from "#tailorkit";
import { channels, examples } from "../../messages";
import { useMessages } from "../../use-messages";

const view = defineView({ view: "/", component: Inbox });

function Inbox() {
  const context = view.useContext();
  const { contacts, messages, loading, error, setError, reload } = useMessages(
    context.workspace.id,
  );
  const [filter, setFilter] = useState("All channels");
  const [query, setQuery] = useState("");
  const threads = contacts
    .flatMap((contact, index) => {
      const sent = messages.filter((message) => message.contactId === contact.id);
      const latest = sent.at(-1) ?? examples[index];
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

  function navigate(href: string) {
    setError("");
    void tools.ui
      .navigate({ href })
      .catch(() => setError("Couldn't open the contact page. Please try again."));
  }

  return (
    <Flex direction="column" gap="md" height="100%" overflow="auto">
      <Flex justify="between" align="center" gap="sm" shrink="0">
        <Heading text="Messages" level="h2" />
        <Button label="New message" size="sm" onClick={() => navigate("/contacts")} />
      </Flex>
      {loading ? <Spinner label="Loading your inbox" /> : null}
      {error ? (
        <Flex direction="column" gap="sm">
          <Alert title="Something went wrong" description={error} variant="error" />
          <Button label="Reload inbox" variant="outline" onClick={reload} />
        </Flex>
      ) : null}
      {!loading ? (
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
                    <Pressable
                      ariaLabel={`Message ${contact.name}`}
                      layout="flex"
                      align="center"
                      gap="sm"
                      padding="md"
                      background={{
                        default: "transparent",
                        ":hover": "muted",
                        ":active": "accent",
                      }}
                      width="100%"
                      onPress={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <Avatar name={contact.name} />
                      <Flex direction="column" gap="xs" grow="1" minWidth="0">
                        <Flex justify="between" align="center" gap="sm">
                          <Text text={contact.name} size="sm" />
                          <Text text={latest.channel} size="xs" tone="muted" />
                        </Flex>
                        <Text
                          text={preview.length > 48 ? `${preview.slice(0, 48)}…` : preview}
                          size="sm"
                          tone="muted"
                        />
                      </Flex>
                    </Pressable>
                    <Separator />
                  </Flex>
                );
              })}
            </Flex>
          )}
        </>
      ) : null}
    </Flex>
  );
}

export default view;
