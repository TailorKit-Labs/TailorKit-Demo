import { defineView, experimental_useCanvasSurface as useCanvasSurface } from "patchsmith/client";
import { useState } from "preact/hooks";
import { z } from "zod";
import { Alert, Box, Button, DoomCanvas, Flex, Text } from "#patchsmith";
import { createDoom, type DoomEngine } from "../../doom";

const view = defineView({
  view: "/",
  instances: {
    dataSchema: z.object({}),
    resolve: () => [{ key: "doom", metadata: { label: "Doom" }, data: {} }],
  },
  component: Doom,
});

function Game({ paused }: { paused: boolean }) {
  const surface = useCanvasSurface<DoomEngine>(
    {
      create: (canvas, { signal }) => createDoom(canvas, signal),
      update: (engine) => engine.pause(paused),
      draw: (engine) => engine.draw(),
      dispose: (engine) => engine.dispose(),
    },
    [paused],
    { continuous: true, framesPerSecond: 35 },
  );

  return (
    <Flex direction="column" gap="sm" grow="1" minHeight="0">
      <Box shrink="0">
        {surface.error ? (
          <Alert
            title="Doom could not start"
            description={`${surface.error.message} Use Restart to try again.`}
            variant="error"
          />
        ) : surface.status === "pending" ? (
          <Text text="Loading Doom and game data…" tone="muted" />
        ) : null}
      </Box>
      <Flex grow="1" minHeight="0" justify="center" align="center" overflow="hidden">
        <DoomCanvas
          surface={surface.binding}
          width={640}
          height={480}
          ariaLabel="Doom game. Click to focus. Arrow keys or WASD to move, Space or F to fire, E to use, P for menu, Enter to select."
        />
      </Flex>
    </Flex>
  );
}

function Doom() {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <Flex direction="column" gap="md" height="100%" minHeight="0">
      <Flex gap="sm" align="center" wrap="wrap" shrink="0">
        <Text text="DOOM · Shareware" />
        <Text text="Sound off" size="xs" tone="muted" />
        <Box grow="1" />
        {started ? (
          <>
            <Button
              label={paused ? "Resume" : "Pause"}
              variant="outline"
              size="sm"
              onClick={() => setPaused((value) => !value)}
            />
            <Button
              label="Restart"
              variant="outline"
              size="sm"
              onClick={() => {
                setPaused(false);
                setRevision((value) => value + 1);
              }}
            />
          </>
        ) : (
          <Button label="Start Doom" onClick={() => setStarted(true)} />
        )}
      </Flex>
      {started ? (
        <Game key={revision} paused={paused} />
      ) : (
        <Flex grow="1" direction="column" gap="sm" align="center" justify="center">
          <Text text="Knee-Deep in the Dead" size="lg" />
          <Text text="The original Doom shareware episode, powered by doomgeneric." tone="muted" />
          <Text text="Press Start Doom, then click the game to play." tone="muted" />
        </Flex>
      )}
      <Text
        text={
          paused
            ? "Paused. Press Resume, then click the game to continue."
            : "Click game to focus · Arrows / WASD move · Space / F fire · E use · Shift run · 1–7 weapons · P menu · Enter select. Use Tab to leave the game."
        }
        size="xs"
        tone="muted"
      />
    </Flex>
  );
}

export default view;
