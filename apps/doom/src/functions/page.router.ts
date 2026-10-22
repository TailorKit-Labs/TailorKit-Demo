import { defineRouter, fn } from "patchsmith/server";
import { z } from "zod";

export default defineRouter({
  get: fn.query.input(z.object({})).handler(() => ({
    href: "/apps/doom/doom",
  })),
});
