// Crate root for the Phase 17 port of VS Code's `advanced` diff algorithm.
// Sources: microsoft/vscode src/vs/editor/common/{core,diff} at commit
// 28a562309973a386b2bdefae78127788a4742fe8 (each module names its file).
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (see LICENSE.mit).
// Changes (the Rust translation) are part of Git Graph Libre, AGPL-3.0-or-later.
#![forbid(unsafe_code)]

pub mod arrays_find;
pub mod clock;
pub mod diff_algorithm;
pub mod dynamic_programming_diffing;
pub mod fixture;
pub mod heuristic_sequence_optimizations;
pub mod line_range;
pub mod line_sequence;
pub mod lines_diff;
pub mod lines_slice_char_sequence;
pub mod myers_diff_algorithm;
pub mod offset_range;
pub mod position;
pub mod range;
pub mod range_mapping;
pub mod text;
pub mod utils;

pub use clock::{Clock, SystemClock, Timeout};
pub use diff_algorithm::{
    DiffAlgorithmResult, IDiffAlgorithm, ISequence, ITimeout, InfiniteTimeout, OffsetPair,
    SequenceDiff,
};
pub use dynamic_programming_diffing::{DynamicProgrammingDiffing, EqualityScore};
pub use line_range::{LineRange, LineRangeSet};
pub use line_sequence::LineSequence;
pub use lines_diff::{LinesDiff, LinesDiffOptions, MovedText};
pub use lines_slice_char_sequence::LinesSliceCharSequence;
pub use myers_diff_algorithm::MyersDiffAlgorithm;
pub use offset_range::OffsetRange;
pub use position::Position;
pub use range::Range;
pub use range_mapping::{DetailedLineRangeMapping, LineRangeMapping, RangeMapping};
pub use text::TextModel;
