//! The `--author` match, with its patterns prepared once per walk.

use crate::error::{Result, ResultExt};
use crate::text::CommitText;

/// The patterns of an author filter, lowered once.
///
/// A filtered walk matches every commit it reads, up to its safety limit, so building `"name <"`
/// for every author on every commit is two fresh allocations per author inside that loop. The
/// patterns depend only on the filter, so a walk builds them once and the per-commit match only
/// builds the commit's own text.
///
/// `git log --author=<name>` runs as `--author=<name> <`, so the CLI backend matches a literal
/// "Name <" prefix of "Name <email>" rather than "Name" as a free-floating substring: without the
/// trailing "<", a name that is a textual prefix of another author's name (e.g. "Bob" inside
/// "Bobby <bobby@x.com>") would match commits it should not. This mirrors that exactly,
/// case-insensitively (case sensitivity is the one place this still deviates from a bare
/// `git log`).
pub(crate) struct AuthorPatterns(Vec<String>);

impl AuthorPatterns {
    pub(crate) fn new(authors: &[String]) -> Self {
        Self(
            authors
                .iter()
                .map(|author| format!("{} <", author.to_lowercase()))
                .collect(),
        )
    }

    pub(crate) fn matches(&self, commit: &gix::Commit<'_>) -> Result<bool> {
        let author = commit
            .author()
            .git_ctx("Could not decode the commit author")?;
        let text = CommitText::of(commit)?;
        let haystack = format!(
            "{} <{}>",
            text.decode(author.name)?,
            text.decode(author.email)?
        )
        .to_lowercase();
        Ok(self.0.iter().any(|pattern| haystack.contains(pattern)))
    }
}
