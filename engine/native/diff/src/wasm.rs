// The WebAssembly surface of the Phase 17 diff port (22h): one
// `wasm-bindgen` export over the same `compute_diff` entry point the native
// build uses, for the differential Vitest suite. Built with
// `wasm-bindgen --target nodejs` (see the `diff:wasm` package script).
// This file is part of Git Graph Libre, AGPL-3.0-or-later.
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg(target_family = "wasm")]
use crate::clock::Clock;
use crate::default_lines_diff_computer::compute_diff;
use crate::line_range::LineRange;
use crate::lines_diff::{LinesDiff, LinesDiffOptions, MovedText};
use crate::range::Range;
use crate::range_mapping::{DetailedLineRangeMapping, RangeMapping};
use crate::text::TextModel;

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Date, js_name = now)]
    fn date_now() -> f64;
}

/// `Date.now()` as a `Clock`: `wasm32-unknown-unknown` has no
/// `std::time::Instant` (Phase 17, "Exactness rules"). Wall-clock
/// milliseconds are what VS Code's `DateTimeout` uses too.
#[cfg(target_family = "wasm")]
struct WebClock;

#[cfg(target_family = "wasm")]
impl Clock for WebClock {
    fn now_ms(&self) -> u64 {
        date_now() as u64
    }
}

#[cfg(target_family = "wasm")]
fn platform_clock() -> WebClock {
    WebClock
}

/// Native feature builds (the unit tests below) keep the system clock.
#[cfg(not(target_family = "wasm"))]
fn platform_clock() -> crate::clock::SystemClock {
    crate::clock::SystemClock::new()
}

fn json_array(items: Vec<String>) -> String {
    format!("[{}]", items.join(","))
}

fn line_range_json(range: LineRange) -> String {
    format!(
        "{{\"startLineNumber\":{},\"endLineNumberExclusive\":{}}}",
        range.start_line_number, range.end_line_number_exclusive
    )
}

fn range_json(range: Range) -> String {
    format!(
        "{{\"startLineNumber\":{},\"startColumn\":{},\"endLineNumber\":{},\"endColumn\":{}}}",
        range.start_line_number, range.start_column, range.end_line_number, range.end_column
    )
}

fn range_mapping_json(mapping: &RangeMapping) -> String {
    format!(
        "{{\"originalRange\":{},\"modifiedRange\":{}}}",
        range_json(mapping.original_range),
        range_json(mapping.modified_range)
    )
}

fn detailed_json(change: &DetailedLineRangeMapping) -> String {
    let inner = match &change.inner_changes {
        None => "null".to_string(),
        Some(changes) => json_array(changes.iter().map(range_mapping_json).collect()),
    };
    format!(
        "{{\"original\":{},\"modified\":{},\"innerChanges\":{}}}",
        line_range_json(change.original),
        line_range_json(change.modified),
        inner
    )
}

fn move_json(moved: &MovedText) -> String {
    format!(
        "{{\"original\":{},\"modified\":{},\"changes\":{}}}",
        line_range_json(moved.line_range_mapping.original),
        line_range_json(moved.line_range_mapping.modified),
        json_array(moved.changes.iter().map(detailed_json).collect())
    )
}

/// The result as JSON with `@vscode/diff`'s field names:
/// `{"changes":[...],"moves":[...],"hitTimeout":bool}`. Numbers and
/// booleans only, so no string escaping is needed here.
fn lines_diff_json(diff: &LinesDiff) -> String {
    format!(
        "{{\"changes\":{},\"moves\":{},\"hitTimeout\":{}}}",
        json_array(diff.changes.iter().map(detailed_json).collect()),
        json_array(diff.moves.iter().map(move_json).collect()),
        diff.hit_timeout
    )
}

fn escape_json(text: &str) -> String {
    let mut out = String::new();
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

fn error_json(message: &str) -> String {
    format!("{{\"error\":\"{}\"}}", escape_json(message))
}

/// JavaScript passes the limit as a `number`: 0 means no timeout (the
/// `@vscode/diff` convention), and anything not a positive finite number
/// also means no timeout.
fn ms_to_u64(ms: f64) -> u64 {
    if ms.is_finite() && ms > 0.0 {
        ms as u64
    } else {
        0
    }
}

fn compute_diff_json(
    original: &str,
    modified: &str,
    ignore_trim_whitespace: bool,
    compute_moves: bool,
    extend_to_subwords: bool,
    max_computation_time_ms: u64,
) -> String {
    let options = LinesDiffOptions {
        ignore_trim_whitespace,
        max_computation_time_ms,
        compute_moves,
        extend_to_subwords,
    };
    let clock = platform_clock();
    let result = compute_diff(
        &TextModel::from_text(original),
        &TextModel::from_text(modified),
        options,
        &clock,
    );
    match result {
        Ok(diff) => lines_diff_json(&diff),
        Err(error) => error_json(&error.message),
    }
}

/// Diffs two texts exactly as the native `compute_diff` does (the texts are
/// split into lines the way a VS Code text model splits them) and returns
/// the result as a JSON string: `lines_diff_json`'s shape on success, or
/// `{"error":"..."}` where VS Code throws. JavaScript strings with lone
/// surrogates cannot cross as Rust `String`s; `wasm-bindgen` replaces them,
/// the same limit the native crate has.
#[wasm_bindgen(js_name = computeDiff)]
pub fn compute_diff_wasm(
    original: &str,
    modified: &str,
    ignore_trim_whitespace: bool,
    compute_moves: bool,
    extend_to_subwords: bool,
    max_computation_time_ms: f64,
) -> String {
    compute_diff_json(
        original,
        modified,
        ignore_trim_whitespace,
        compute_moves,
        extend_to_subwords,
        ms_to_u64(max_computation_time_ms),
    )
}

#[cfg(test)]
mod tests {
    use super::{compute_diff_json, error_json, ms_to_u64};

    #[test]
    fn identical_texts_diff_to_nothing() {
        assert_eq!(
            compute_diff_json("a\nb\n", "a\nb\n", false, true, false, 0),
            "{\"changes\":[],\"moves\":[],\"hitTimeout\":false}"
        );
    }

    #[test]
    fn a_one_line_change_is_structured_json() {
        assert_eq!(
            compute_diff_json("a\nb\n", "a\nc\n", false, true, false, 0),
            "{\"changes\":[{\"original\":{\"startLineNumber\":2,\"endLineNumberExclusive\":3},\
             \"modified\":{\"startLineNumber\":2,\"endLineNumberExclusive\":3},\
             \"innerChanges\":[{\"originalRange\":{\"startLineNumber\":2,\"startColumn\":1,\
             \"endLineNumber\":2,\"endColumn\":2},\"modifiedRange\":{\"startLineNumber\":2,\
             \"startColumn\":1,\"endLineNumber\":2,\"endColumn\":2}}]}],\
             \"moves\":[],\"hitTimeout\":false}"
        );
    }

    #[test]
    fn errors_are_escaped_json() {
        assert_eq!(error_json("a\"b\\c\nd"), "{\"error\":\"a\\\"b\\\\c\\nd\"}");
    }

    #[test]
    fn the_timeout_conversion_treats_non_positive_as_none() {
        assert_eq!(ms_to_u64(0.0), 0);
        assert_eq!(ms_to_u64(-5.0), 0);
        assert_eq!(ms_to_u64(f64::NAN), 0);
        assert_eq!(ms_to_u64(f64::INFINITY), 0);
        assert_eq!(ms_to_u64(250.9), 250);
        assert_eq!(ms_to_u64(9_007_199_254_740_991.0), 9_007_199_254_740_991);
    }
}
