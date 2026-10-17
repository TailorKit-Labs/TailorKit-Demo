import { provisionForUser as provision } from "../lib/provision";

// CRM integration tests don't create real remote TailorKit installations.
// The installer has its own platform protocol and provisioning tests.
export const provisionForUser = (userId: string) => provision(userId, { install: async () => {} });
