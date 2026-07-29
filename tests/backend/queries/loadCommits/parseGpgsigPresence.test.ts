import { describe, expect, it } from "vitest";

import { parseGpgsigPresence } from "@/backend/queries/loadCommits";

/**
 * Canned `git cat-file --batch` output. Each object is a header line
 * `<40-hex-sha> commit <size>` followed by the raw commit body (which may
 * include a `gpgsig ` line), then a blank separator before the next object.
 */
function batch(objects: { sha: string; body: string }[]): string {
  return objects.map((o) => `${o.sha} commit ${o.body.length}\n${o.body}\n`).join("");
}

describe("parseGpgsigPresence", () => {
  it("reports commits that carry a gpgsig header (SSH or PGP)", () => {
    const sshSha = "0123456789abcdef0123456789abcdef01234567";
    const pgpSha = "fedcba9876543210fedcba9876543210fedcba98";
    const stdout = batch([
      {
        sha: sshSha,
        body: [
          "tree abcdefabcdefabcdefabcdefabcdefabcdefabcd",
          "parent 1111111111111111111111111111111111111111",
          "author Bora Ciner <c@example.com> 1784920249 +0200",
          "committer Bora Ciner <c@example.com> 1784920249 +0200",
          "gpgsig -----BEGIN SSH SIGNATURE-----",
          " U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAg",
          " -----END SSH SIGNATURE-----",
          "",
          "Signed commit"
        ].join("\n")
      },
      {
        sha: pgpSha,
        body: [
          "tree 2222222222222222222222222222222222222222",
          "author Alice <a@example.com> 1700000000 +0000",
          "committer Alice <a@example.com> 1700000000 +0000",
          "gpgsig -----BEGIN PGP SIGNATURE-----",
          " iQIzBAEBCgAdFiEE",
          " -----END PGP SIGNATURE-----",
          "",
          "GPG signed"
        ].join("\n")
      }
    ]);

    expect(parseGpgsigPresence(stdout)).toEqual(new Set([sshSha, pgpSha]));
  });

  it("does not report a commit without a gpgsig header", () => {
    const unsignedSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const stdout = batch([
      {
        sha: unsignedSha,
        body: [
          "tree bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "author Bob <b@example.com> 1700000000 +0000",
          "committer Bob <b@example.com> 1700000000 +0000",
          "",
          "Plain unsigned commit"
        ].join("\n")
      }
    ]);

    expect(parseGpgsigPresence(stdout)).toEqual(new Set([]));
  });

  it("ignores non-commit objects (blobs and tags)", () => {
    const blobSha = "cccccccccccccccccccccccccccccccccccccccc";
    const tagSha = "dddddddddddddddddddddddddddddddddddddddd";
    const commitSha = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    // A tag object can itself carry a signature in its body, but the header
    // line says `tag`, not `commit`, so it must be skipped.
    const stdout = [
      `${blobSha} blob 12\nhello world\n`,
      `${tagSha} tag 80\nobject ${commitSha}\ntype commit\ntag v1.0.0\ntagger X\n-----BEGIN PGP SIGNATURE-----\n\n${tagSha}\n`,
      `${commitSha} commit 90\ntree ffffffffffffffffffffffffffffffffffffffff\nauthor X\ncommitter X\ngpgsig -----BEGIN PGP SIGNATURE-----\n sig\n-----END PGP SIGNATURE-----\n\nmsg\n`
    ].join("");

    expect(parseGpgsigPresence(stdout)).toEqual(new Set([commitSha]));
  });

  it("counts each commit once even with multi-line signatures", () => {
    const sha = "1111222233334444555566667777888899990000";
    const stdout = batch([
      {
        sha,
        body: [
          "tree 0000000000000000000000000000000000000000",
          "gpgsig -----BEGIN PGP SIGNATURE-----",
          " line1",
          " line2",
          " line3",
          " -----END PGP SIGNATURE-----",
          "",
          "msg"
        ].join("\n")
      }
    ]);

    // The continuation lines are space-prefixed, so only the `gpgsig ` line
    // matches — the set has exactly one entry, not four.
    expect(parseGpgsigPresence(stdout).size).toBe(1);
    expect(parseGpgsigPresence(stdout).has(sha)).toBe(true);
  });

  it("returns an empty set for empty input", () => {
    expect(parseGpgsigPresence("")).toEqual(new Set([]));
  });
});
