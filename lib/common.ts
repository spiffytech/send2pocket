import * as crypto from "crypto";

export function token_to_hash(token: string) {
    return crypto.createHash("sha256").
    update(token).
    digest("hex");
}
