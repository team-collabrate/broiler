/** True unless the browser says the tablet has no network at all. A quick check before work that needs the server. */
export function isOnlineNow(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** The error for work that cannot be done without the internet (a credit bill, a credit payment). `describeError` words it in Tamil. */
export function needsConnectionError(): Error {
  return Object.assign(new Error("this needs a connection"), { code: "app/needs-connection" });
}
