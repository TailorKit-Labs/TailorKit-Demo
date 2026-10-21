import { defineServer, query } from "patchsmith/server";
import { z } from "zod";

export default defineServer({
  page: query({
    args: z.object({}),
    handler: () => ({
      href: "/apps/doom/doom",
    }),
  }),
});
