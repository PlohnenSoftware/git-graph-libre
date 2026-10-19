//! The wire forms of the Phase 17 diff port: the options a caller sends and the `LinesDiff` it
//! gets back, both as JSON.
//!
//! The output is VS Code's own shape (`changes` with their `innerChanges`, `moves` with theirs,
//! `hitTimeout`), field names and all, so a TypeScript reader can be checked against VS Code's
//! computer without translation. Columns are UTF-16 code units, as the crate reports them. The
//! `git-graph-diff` crate has no serde dependency by design, so the shapes are mirrored here.

use git_graph_diff::{
    DetailedLineRangeMapping, LineRange, LineRangeMapping, LinesDiff, LinesDiffOptions, MovedText,
    Range, RangeMapping, SystemClock, TextModel,
};
use serde::{Deserialize, Serialize};

use git_graph_core::types::CommitFile;
use git_graph_core::{blob, Error, ErrorKind, Repo, Result};

/// The options of `diff_texts` and `diff_file_at_revisions`. An omitted field means "off", and a
/// limit of 0 means no limit, as in VS Code.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct OptionsPayload {
    ignore_trim_whitespace: bool,
    max_computation_time_ms: u64,
    compute_moves: bool,
    extend_to_subwords: bool,
}

/// Run the port over two texts and encode its answer. A `DiffError` (VS Code throws there)
/// becomes an `Unsupported` engine error, which the TypeScript side answers with its fallback.
pub fn diff_to_json(original: &str, modified: &str, options_json: &str) -> Result<String> {
    let payload: OptionsPayload = serde_json::from_str(options_json)
        .map_err(|e| Error::invalid_argument(format!("Could not decode the diff options: {e}")))?;
    let options = LinesDiffOptions {
        ignore_trim_whitespace: payload.ignore_trim_whitespace,
        max_computation_time_ms: payload.max_computation_time_ms,
        compute_moves: payload.compute_moves,
        extend_to_subwords: payload.extend_to_subwords,
    };
    let diff = git_graph_diff::compute_diff(
        &TextModel::from_text(original),
        &TextModel::from_text(modified),
        options,
        &SystemClock::new(),
    )
    .map_err(|e| Error::unsupported(e.to_string()))?;
    serde_json::to_string(&WireLinesDiff::from(&diff))
        .map_err(|e| Error::git(format!("Could not encode the diff: {e}")))
}

/// One side of a file diff: its text, `None` when the blob is binary.
///
/// A path that is not in the revision reads as empty text: that is how an added or a deleted
/// file diffs, against nothing.
fn side_text(repo: &Repo, revision: &str, path: &str) -> Result<Option<String>> {
    match blob::commit_file(repo, revision, path) {
        Ok(CommitFile { binary: true, .. }) => Ok(None),
        Ok(file) => Ok(Some(file.contents.unwrap_or_default())),
        Err(error) if error.kind == ErrorKind::NotFound => Ok(Some(String::new())),
        Err(error) => Err(error),
    }
}

/// Diff one file between two revisions, reading both blobs in process. `old_path` names it at
/// `from`, `new_path` at `to` (they differ across a rename). A binary side answers the marker
/// `load_commit_file` gives, `{"contents":null,"binary":true}`, instead of a diff.
pub fn diff_files_to_json(
    repo: &Repo,
    from: &str,
    to: &str,
    old_path: &str,
    new_path: &str,
    options_json: &str,
) -> Result<String> {
    let original = side_text(repo, from, old_path)?;
    let modified = side_text(repo, to, new_path)?;
    match (original, modified) {
        (Some(original), Some(modified)) => diff_to_json(&original, &modified, options_json),
        _ => serde_json::to_string(&CommitFile {
            contents: None,
            binary: true,
        })
        .map_err(|e| Error::git(format!("Could not encode the binary marker: {e}"))),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireLinesDiff {
    changes: Vec<WireChange>,
    moves: Vec<WireMove>,
    hit_timeout: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireLineRange {
    start_line_number: u32,
    end_line_number_exclusive: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireRange {
    start_line_number: u32,
    start_column: u32,
    end_line_number: u32,
    end_column: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireRangeMapping {
    original_range: WireRange,
    modified_range: WireRange,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireChange {
    original: WireLineRange,
    modified: WireLineRange,
    inner_changes: Option<Vec<WireRangeMapping>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireLineMapping {
    original: WireLineRange,
    modified: WireLineRange,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireMove {
    line_range_mapping: WireLineMapping,
    changes: Vec<WireChange>,
}

impl From<&LineRange> for WireLineRange {
    fn from(range: &LineRange) -> Self {
        WireLineRange {
            start_line_number: range.start_line_number,
            end_line_number_exclusive: range.end_line_number_exclusive,
        }
    }
}

impl From<&Range> for WireRange {
    fn from(range: &Range) -> Self {
        WireRange {
            start_line_number: range.start_line_number,
            start_column: range.start_column,
            end_line_number: range.end_line_number,
            end_column: range.end_column,
        }
    }
}

impl From<&RangeMapping> for WireRangeMapping {
    fn from(mapping: &RangeMapping) -> Self {
        WireRangeMapping {
            original_range: (&mapping.original_range).into(),
            modified_range: (&mapping.modified_range).into(),
        }
    }
}

impl From<&DetailedLineRangeMapping> for WireChange {
    fn from(change: &DetailedLineRangeMapping) -> Self {
        WireChange {
            original: (&change.original).into(),
            modified: (&change.modified).into(),
            inner_changes: change
                .inner_changes
                .as_ref()
                .map(|inner| inner.iter().map(WireRangeMapping::from).collect()),
        }
    }
}

impl From<&LineRangeMapping> for WireLineMapping {
    fn from(mapping: &LineRangeMapping) -> Self {
        WireLineMapping {
            original: (&mapping.original).into(),
            modified: (&mapping.modified).into(),
        }
    }
}

impl From<&MovedText> for WireMove {
    fn from(moved: &MovedText) -> Self {
        WireMove {
            line_range_mapping: (&moved.line_range_mapping).into(),
            changes: moved.changes.iter().map(WireChange::from).collect(),
        }
    }
}

impl From<&LinesDiff> for WireLinesDiff {
    fn from(diff: &LinesDiff) -> Self {
        WireLinesDiff {
            changes: diff.changes.iter().map(WireChange::from).collect(),
            moves: diff.moves.iter().map(WireMove::from).collect(),
            hit_timeout: diff.hit_timeout,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::diff_to_json;

    #[test]
    fn encodes_vs_codes_shape() {
        let json = diff_to_json("a\nb\n", "a\nc\n", "{}").unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["hitTimeout"], false);
        assert_eq!(value["moves"].as_array().unwrap().len(), 0);
        let change = &value["changes"][0];
        assert_eq!(change["original"]["startLineNumber"], 2);
        assert_eq!(change["modified"]["endLineNumberExclusive"], 3);
        assert_eq!(change["innerChanges"][0]["originalRange"]["startColumn"], 1);
    }

    #[test]
    fn a_bad_options_payload_is_an_invalid_argument() {
        let error = diff_to_json("a", "b", "[").unwrap_err();
        assert_eq!(error.kind, git_graph_core::ErrorKind::InvalidArgument);
    }

    #[test]
    fn identical_texts_have_no_changes() {
        let json = diff_to_json("x\n", "x\n", r#"{"computeMoves":true}"#).unwrap();
        assert_eq!(json, r#"{"changes":[],"moves":[],"hitTimeout":false}"#);
    }
}
