// An error that maps straight to an HTTP status and a client-safe message.
export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) { super(message); this.status = status; }
}
