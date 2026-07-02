import * as crypto from "node:crypto";

export function getNonce() {
  return crypto.randomBytes(24).toString("base64url");
}
