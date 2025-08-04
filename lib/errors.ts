export class UsernameNotFoundError extends Error {
  constructor(username: string) {
    super(`Sleeper username not found: ${username}`);
    this.name = "UsernameNotFoundError";
    Object.setPrototypeOf(this, UsernameNotFoundError.prototype);
  }
}
