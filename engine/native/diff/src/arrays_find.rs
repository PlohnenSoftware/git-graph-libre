// Ported from microsoft/vscode src/vs/base/common/arraysFind.ts
// at commit 28a562309973a386b2bdefae78127788a4742fe8. Only the binary
// searches and `MonotonousArray` that `lineRange.ts` and `computeMovedLines.ts`
// use are here.
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.

/// `findLastIdxMonotonous`: the index of the last element (from `start_idx`)
/// for which a monotonous predicate holds, or `start_idx - 1` (-1 by default).
pub fn find_last_idx_monotonous<T>(
    array: &[T],
    predicate: impl Fn(&T) -> bool,
    start_idx: usize,
) -> i64 {
    let (mut i, mut j) = (start_idx, array.len());
    while i < j {
        let k = (i + j) / 2;
        if predicate(&array[k]) {
            i = k + 1;
        } else {
            j = k;
        }
    }
    i as i64 - 1
}

/// `findLastMonotonous`.
pub fn find_last_monotonous<T>(array: &[T], predicate: impl Fn(&T) -> bool) -> Option<&T> {
    usize::try_from(find_last_idx_monotonous(array, predicate, 0))
        .ok()
        .map(|idx| &array[idx])
}

/// `findFirstIdxMonotonousOrArrLen`: the first index whose element satisfies a
/// monotonous predicate, or the array length.
pub fn find_first_idx_monotonous_or_arr_len<T>(
    array: &[T],
    predicate: impl Fn(&T) -> bool,
) -> usize {
    let (mut i, mut j) = (0, array.len());
    while i < j {
        let k = (i + j) / 2;
        if predicate(&array[k]) {
            j = k;
        } else {
            i = k + 1;
        }
    }
    i
}

/// `MonotonousArray`: repeated `findLastMonotonous` calls whose predicates are
/// each weaker than the one before, so every search resumes where the last
/// stopped. Returns the index, where VS Code returns the element (callers
/// compare identity).
pub struct MonotonousArray<'a, T> {
    array: &'a [T],
    last_idx: usize,
}

impl<'a, T> MonotonousArray<'a, T> {
    pub fn new(array: &'a [T]) -> Self {
        Self { array, last_idx: 0 }
    }
    pub fn find_last_monotonous(&mut self, predicate: impl Fn(&T) -> bool) -> Option<usize> {
        let idx = find_last_idx_monotonous(self.array, predicate, self.last_idx);
        self.last_idx = (idx + 1) as usize;
        usize::try_from(idx).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_searches() {
        let a = [1, 3, 3, 5, 8];
        assert_eq!(find_last_idx_monotonous(&a, |&x| x <= 3, 0), 2);
        assert_eq!(find_last_idx_monotonous(&a, |&x| x <= 0, 0), -1);
        assert_eq!(find_last_monotonous(&a, |&x| x < 9), Some(&8));
        assert_eq!(find_last_monotonous(&a, |&x| x < 1), None);
        assert_eq!(find_first_idx_monotonous_or_arr_len(&a, |&x| x >= 4), 3);
        assert_eq!(find_first_idx_monotonous_or_arr_len(&a, |&x| x >= 9), 5);
    }

    #[test]
    fn monotonous_array_resumes_from_the_last_hit() {
        let a = [1, 3, 3, 5, 8];
        let mut m = MonotonousArray::new(&a);
        assert_eq!(m.find_last_monotonous(|&x| x <= 3), Some(2));
        assert_eq!(m.find_last_monotonous(|&x| x <= 5), Some(3));
        // A predicate that is not weaker never looks left of the last hit.
        assert_eq!(m.find_last_monotonous(|&x| x <= 1), Some(3));
    }
}
