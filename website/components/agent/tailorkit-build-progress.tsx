"use client";

import type { TailorKitProgress } from "@/lib/agents/tailorkit-progress";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

const toolLabels: Record<string, string> = {
  read: "Read file",
  write: "Write file",
  edit: "Edit file",
  bash: "Run command",
  grep: "Search code",
  glob: "Find files",
  ls: "List files",
  deploy: "Deploy app",
};

const activityLabels = { running: "Running", completed: "Done", error: "Failed" };

export const TailorKitBuildProgress = ({
  progress,
  streaming,
}: {
  progress: TailorKitProgress;
  streaming: boolean;
}) => (
  <div className="flex min-w-0 flex-col gap-3">
    {streaming ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner />
        Building your app…
      </p>
    ) : null}
    {progress.text ? (
      <div className="max-h-72 overflow-y-auto text-sm">
        <MessageResponse isAnimating={streaming}>{progress.text}</MessageResponse>
      </div>
    ) : null}
    {progress.tools.length ? (
      <ul className="flex flex-col gap-2" aria-label="App agent activity">
        {progress.tools.map((tool) => (
          <li key={tool.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{toolLabels[tool.name] ?? tool.name}</span>
            <Badge variant="outline">
              {tool.state === "running" && !streaming ? "Stopped" : activityLabels[tool.state]}
            </Badge>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);
