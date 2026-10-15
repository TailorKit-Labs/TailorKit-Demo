// Expected domain failures can cross the API boundary; database errors cannot.
export class CrmError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "CrmError";
  }
}
