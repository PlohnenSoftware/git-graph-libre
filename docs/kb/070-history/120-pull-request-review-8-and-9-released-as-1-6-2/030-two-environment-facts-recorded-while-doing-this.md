---
summary: >-
  Environment facts: Rust via `rustup` (`1.98.1`, conflicts with the distro
  `rust`; use `rustup default stable`), and a flaky engine test whose `git
  clone` reads the real `~/.gitconfig`.
---

# Two environment facts recorded while doing this

- **A Rust toolchain is now installed**: `rustup` from `pacman` with a stable
  toolchain (`rustc`/`cargo` `1.98.1`) in `~/.rustup`. `rustup` and the distro
  `rust` package **conflict** on Arch — `rustup` declares
  `Conflicts With: rust cargo rustfmt` and owns `/usr/bin/cargo` as a shim —
  so `rustup default stable` is the only way to make the installed package
  functional, and it is also the one that keeps `rustup target add` for
  cross-compilation.
- **`tests/backend/utils` has a latent flaky test**, unrelated to any slice
  that happens to hit it. `queries.rs`'s
  `a_bare_repository_has_no_upstream_and_no_submodules` (in the engine
  repository, see the next section) fails intermittently under load with
  `git clone --bare` reporting `fatal: unknown error occurred while reading
  the configuration files`. Cause: the `TestRepo` harness sets
  `.env("HOME", …)` on every git call **except** that one `git clone`, which
  therefore reads the real `~/.gitconfig`. The same shape of bug is worth
  checking for in this repository's own fixtures.
