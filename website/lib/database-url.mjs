/** Preserve pg 8 certificate verification when legacy SSL aliases are supplied.
 * @param {string} connectionString
 * @returns {string}
 */
export function normalizeDatabaseUrl(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    // Leave socket paths and other pg-specific formats to the driver.
    return connectionString;
  }
  if (url.searchParams.getAll("uselibpqcompat").at(-1) === "true") return connectionString;
  const mode = url.searchParams.getAll("sslmode").at(-1);
  if (mode !== "prefer" && mode !== "require" && mode !== "verify-ca") {
    return connectionString;
  }
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
