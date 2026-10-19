// The injectable clock (Phase 17, "Exactness rules"), mirroring `ITimeout`,
// `InfiniteTimeout` and `DateTimeout` in microsoft/vscode
// src/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/diffAlgorithm.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
use std::time::Instant;

/// Monotonic milliseconds. Native builds use `Instant`; a wasm build can
/// supply `Date.now()`; tests use a fake clock.
pub trait Clock {
    fn now_ms(&self) -> u64;
}

pub struct SystemClock {
    start: Instant,
}

impl SystemClock {
    pub fn new() -> Self {
        Self {
            start: Instant::now(),
        }
    }
}

impl Default for SystemClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for SystemClock {
    fn now_ms(&self) -> u64 {
        self.start.elapsed().as_millis() as u64
    }
}

/// `ITimeout`: valid while the elapsed time stays under the limit. Like
/// `DateTimeout`, once invalid it stays invalid; a limit of 0 never expires
/// (`InfiniteTimeout`, the package's no-timeout convention).
pub struct Timeout<'c, C: Clock> {
    clock: &'c C,
    start_ms: u64,
    limit_ms: u64,
    valid: bool,
}

impl<'c, C: Clock> Timeout<'c, C> {
    pub fn new(clock: &'c C, limit_ms: u64) -> Self {
        Self {
            clock,
            start_ms: clock.now_ms(),
            limit_ms,
            valid: true,
        }
    }
    pub fn is_valid(&mut self) -> bool {
        if self.valid && self.limit_ms > 0 {
            self.valid = self.clock.now_ms().saturating_sub(self.start_ms) < self.limit_ms;
        }
        self.valid
    }
}

#[cfg(test)]
mod tests {
    use super::{Clock, Timeout};
    use std::cell::Cell;
    struct Fake(Cell<u64>);
    impl Clock for Fake {
        fn now_ms(&self) -> u64 {
            self.0.get()
        }
    }
    #[test]
    fn expires_and_latches() {
        let clock = Fake(Cell::new(100));
        let mut timeout = Timeout::new(&clock, 50);
        clock.0.set(149);
        assert!(timeout.is_valid());
        clock.0.set(150);
        assert!(!timeout.is_valid());
        clock.0.set(0); // even if the clock went backwards, it stays invalid
        assert!(!timeout.is_valid());
        assert!(Timeout::new(&clock, 0).is_valid());
    }
}
