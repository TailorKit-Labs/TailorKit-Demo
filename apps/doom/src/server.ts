import { defineServer, query } from "patchsmith/server";
import { z } from "zod";

export default defineServer({
  page: query({
    args: z.object({}),
    handler: ({ identity }) => ({
      href: `/app-pages/${encodeURIComponent(identity.installationId)}?instance=doom`,
    }),
  }),
});
