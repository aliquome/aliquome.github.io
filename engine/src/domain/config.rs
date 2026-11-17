//! The input files in data/: what the engine reads.

use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize)]
pub(crate) struct SourcesFile {
    pub(crate) source: Vec<SourceDef>,
}

#[derive(Deserialize)]
pub(crate) struct SourceDef {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) field: String,
    pub(crate) homepage: String,
    pub(crate) license: String,
    pub(crate) summary: String,
    #[serde(default)]
    pub(crate) aliases: Vec<String>,
    pub(crate) check: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct FieldsFile {
    /// Dataset names too generic to tag papers by (Cell, HIV, PPI, ...).
    #[serde(default)]
    pub(crate) mention_stoplist: Vec<String>,
    pub(crate) field: Vec<FieldDef>,
    #[serde(default)]
    pub(crate) category: Vec<CategoryDef>,
}

#[derive(Deserialize, Serialize, Clone)]
pub(crate) struct TaskDef {
    pub(crate) id: String,
    pub(crate) label: String,
    #[serde(skip_serializing)]
    pub(crate) pattern: String,
}

#[derive(Deserialize, Serialize, Clone)]
pub(crate) struct FieldDef {
    pub(crate) id: String,
    pub(crate) label: String,
    #[serde(rename = "match", default, skip_serializing)]
    pub(crate) match_pattern: String,
    pub(crate) base: String,
    pub(crate) shape: String,
    pub(crate) query: String,
    #[serde(default)]
    pub(crate) tasks: Vec<TaskDef>,
}

#[derive(Deserialize)]
pub(crate) struct CategoryDef {
    pub(crate) prefix: String,
    pub(crate) field: String,
}

#[derive(Deserialize)]
pub(crate) struct BoardsFile {
    #[serde(default)]
    pub(crate) board: Vec<BoardDef>,
}

#[derive(Deserialize)]
pub(crate) struct BoardDef {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) field: String,
    pub(crate) task: String,
    pub(crate) dataset: String,
    pub(crate) url: String,
    pub(crate) source: String,
    pub(crate) model: String,
    pub(crate) kind: Option<String>,
    pub(crate) reference: Option<String>,
    pub(crate) metric: String,
    pub(crate) metric_label: String,
    pub(crate) higher: bool,
    #[serde(default)]
    pub(crate) columns: Vec<String>,
}

/// data/loaders.toml: a library call or official client command that
/// fetches a dataset or database, attached to every id in `targets`
/// ("ds:<dataset id>" or "db:<source id>").
#[derive(Deserialize, Default)]
pub(crate) struct LoadersFile {
    #[serde(default)]
    pub(crate) loader: Vec<LoaderDef>,
}

#[derive(Deserialize)]
pub(crate) struct LoaderDef {
    pub(crate) targets: Vec<String>,
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) docs: String,
    pub(crate) code: String,
}

#[derive(Deserialize)]
pub(crate) struct LatestConfig {
    pub(crate) days: i64,
    pub(crate) max_papers: usize,
    pub(crate) core_journals: Vec<String>,
    pub(crate) general_journals: Vec<String>,
    pub(crate) general_filter: String,
}
