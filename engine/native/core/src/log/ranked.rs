//! The traversal behind `git log --topo-order`, `--date-order` and `--author-date-order`.
//!
//! git does this in two steps, and so does this module:
//!
//! 1. **Discover.** Commits are visited newest *committer* date first, ties going to the commit
//!    that was found first (git's `limit_list`). The visit order is the list the ordering starts
//!    from, so it decides how ties between equal dates are broken.
//! 2. **Rank.** The visited commits are re-ordered by a Kahn-style topological sort (git's
//!    `sort_in_topological_order`): a commit is shown only after every child of it that was
//!    visited, and among the commits that are ready the ordering picks one. `--date-order` and
//!    `--author-date-order` take the newest date, ties going to the commit made ready first;
//!    `--topo-order` takes the commit made ready last, which keeps one line of history together,
//!    and starts from the newest tip.
//!
//! Only headers are read here: a commit's parents and its two dates. A page's full records are
//! read afterwards, for the commits that are on it.

use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

use gix::ObjectId;

use crate::repository::Shallow;
use crate::types::CommitOrdering;

/// The commits one traversal visited, with the edges between them.
pub(super) struct Graph {
    ids: Vec<ObjectId>,
    committer: Vec<i64>,
    author: Vec<i64>,
    /// `edges[start..end]` for `spans[i] = (start, end)` are the parents of commit `i` (indexes
    /// into `ids`), for a visited commit; a commit that was seen but never visited has none.
    spans: Vec<(u32, u32)>,
    edges: Vec<u32>,
    /// Indexes of the visited commits, in visit order.
    visited: Vec<u32>,
}

/// The traversal's working state: which commits have been seen, and the date queue.
struct Discovery<'a> {
    git: &'a gix::Repository,
    shallow: &'a Shallow,
    first_parent_only: bool,
    index_of: HashMap<ObjectId, u32>,
    graph: Graph,
    /// Parents of the commits waiting in the queue, by index. A commit's parents are followed
    /// only when it is visited.
    waiting: HashMap<u32, Vec<ObjectId>>,
    queue: BinaryHeap<(i64, Reverse<u32>, u32)>,
}

impl Discovery<'_> {
    /// Read `id`'s header the first time it is seen and queue it. Returns its index, or `None`
    /// for a commit that cannot be read (a corrupt pack): there is nothing to follow past it.
    fn see(&mut self, id: ObjectId) -> Option<u32> {
        if let Some(&index) = self.index_of.get(&id) {
            return Some(index);
        }
        let commit = self.git.find_commit(id).ok()?;
        let mut parents = self.shallow.parents(&commit);
        if self.first_parent_only {
            parents.truncate(1);
        }
        let committer = commit
            .committer()
            .ok()
            .and_then(|signature| signature.time().ok())
            .map_or(0, |time| time.seconds);
        let author = commit
            .author()
            .ok()
            .and_then(|signature| signature.time().ok())
            .map_or(0, |time| time.seconds);

        let index = self.graph.ids.len() as u32;
        self.graph.ids.push(id);
        self.graph.committer.push(committer);
        self.graph.author.push(author);
        self.graph.spans.push((0, 0));
        self.index_of.insert(id, index);
        self.waiting.insert(index, parents);
        // The newest date first; equal dates go to the smaller (earlier seen) index.
        self.queue.push((committer, Reverse(index), index));
        Some(index)
    }

    /// Visit the next commit: follow its parents, which queues the ones not yet seen.
    fn visit_next(&mut self) -> bool {
        let Some((_, _, index)) = self.queue.pop() else {
            return false;
        };
        let parents = self.waiting.remove(&index).unwrap_or_default();
        let start = self.graph.edges.len() as u32;
        for parent in parents {
            if let Some(parent_index) = self.see(parent) {
                self.graph.edges.push(parent_index);
            }
        }
        self.graph.spans[index as usize] = (start, self.graph.edges.len() as u32);
        self.graph.visited.push(index);
        true
    }
}

/// Visit the commits reachable from `tips`, newest committer date first.
///
/// `window` bounds how many commits are visited (the whole history when `None`): a page needs
/// only the newest few, and the visit is the expensive part on a large repository.
pub(super) fn discover(
    git: &gix::Repository,
    shallow: &Shallow,
    tips: &[ObjectId],
    first_parent_only: bool,
    window: Option<usize>,
) -> Graph {
    let mut state = Discovery {
        git,
        shallow,
        first_parent_only,
        index_of: HashMap::new(),
        graph: Graph {
            ids: Vec::new(),
            committer: Vec::new(),
            author: Vec::new(),
            spans: Vec::new(),
            edges: Vec::new(),
            visited: Vec::new(),
        },
        waiting: HashMap::new(),
        queue: BinaryHeap::new(),
    };
    // The tips enter the queue in the order given, so equal dates keep that order.
    for tip in tips {
        state.see(*tip);
    }

    let limit = window.unwrap_or(usize::MAX);
    while state.graph.visited.len() < limit && state.visit_next() {}
    state.graph
}

impl Graph {
    pub(super) fn id(&self, index: u32) -> ObjectId {
        self.ids[index as usize]
    }

    fn parents(&self, index: u32) -> &[u32] {
        let (start, end) = self.spans[index as usize];
        &self.edges[start as usize..end as usize]
    }

    /// The visited commits in `ordering`, produced one at a time.
    pub(super) fn ranked(&self, ordering: CommitOrdering) -> Ranked<'_> {
        let mut is_visited = vec![false; self.ids.len()];
        for &index in &self.visited {
            is_visited[index as usize] = true;
        }
        // How many visited children each commit is still waiting for.
        let mut pending = vec![0u32; self.ids.len()];
        for &index in &self.visited {
            for &parent in self.parents(index) {
                if is_visited[parent as usize] {
                    pending[parent as usize] += 1;
                }
            }
        }

        let mut initial: Vec<u32> = self
            .visited
            .iter()
            .copied()
            .filter(|&index| pending[index as usize] == 0)
            .collect();
        // Topological order takes the most recently readied commit first, so seeding in visit
        // order would start from the *oldest* tip. git reverses its initial queue
        // (`prio_queue_reverse` in `sort_in_topological_order`) so that the newest tip comes out
        // first; seeding in reverse does the same. The date orderings rank by date and use the
        // sequence only to break ties, lowest first.
        if ordering == CommitOrdering::Topo {
            initial.reverse();
        }

        let mut ranked = Ranked {
            graph: self,
            ordering,
            is_visited,
            pending,
            ready: BinaryHeap::new(),
            sequence: 0,
        };
        for index in initial {
            ranked.make_ready(index);
        }
        ranked
    }
}

/// Ranking key for the ready set.
#[derive(PartialEq, Eq)]
struct Ready {
    /// The date the ordering ranks by; zero for topological order.
    date: i64,
    /// When the commit was made ready; breaks ties and drives topological order.
    sequence: usize,
    index: u32,
    topo: bool,
}

impl Ord for Ready {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        if self.topo {
            self.sequence.cmp(&other.sequence)
        } else {
            self.date
                .cmp(&other.date)
                .then_with(|| other.sequence.cmp(&self.sequence))
        }
    }
}

impl PartialOrd for Ready {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// The topological sort over a [`Graph`], as an iterator of commit indexes.
pub(super) struct Ranked<'a> {
    graph: &'a Graph,
    ordering: CommitOrdering,
    is_visited: Vec<bool>,
    pending: Vec<u32>,
    ready: BinaryHeap<Ready>,
    sequence: usize,
}

impl Ranked<'_> {
    fn make_ready(&mut self, index: u32) {
        let date = match self.ordering {
            CommitOrdering::Date => self.graph.committer[index as usize],
            CommitOrdering::AuthorDate => self.graph.author[index as usize],
            CommitOrdering::Topo => 0,
        };
        self.ready.push(Ready {
            date,
            sequence: self.sequence,
            index,
            topo: self.ordering == CommitOrdering::Topo,
        });
        self.sequence += 1;
    }
}

impl Iterator for Ranked<'_> {
    type Item = u32;

    fn next(&mut self) -> Option<u32> {
        let next = self.ready.pop()?.index;
        for &parent in self.graph.parents(next) {
            if !self.is_visited[parent as usize] {
                continue;
            }
            self.pending[parent as usize] -= 1;
            if self.pending[parent as usize] == 0 {
                self.make_ready(parent);
            }
        }
        Some(next)
    }
}
