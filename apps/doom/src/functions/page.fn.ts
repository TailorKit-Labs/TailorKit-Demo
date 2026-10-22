import { defineRouter, query } from "patchsmith/server";
import { z } from "zod";

export default defineRouter({
  get: query({
    args: z.object({}),
    handler: () => ({
      href: "/apps/doom/doom",
    }),
  }),
});
