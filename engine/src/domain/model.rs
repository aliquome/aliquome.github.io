//! The output files in site/data/: what the site reads.

use crate::domain::config::FieldDef;
use serde::Deserialize;
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
pub(crate) struct VersionOut {
    pub(crate) version: String,
    pub(crate) date: String,
    pub(crate) status: String,
    pub(crate) url: String,
    pub(crate) url_type: String,
    pub(crate) verified: bool,
    pub(crate) note: String,
}

#[derive(Serialize)]
pub(crate) struct SourceOut {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) field: String,
    pub(crate) homepage: String,
    pub(crate) license: String,
    pub(crate) summary: String,
    pub(crate) latest: String,
    pub(crate) latest_date: String,
    pub(crate) latest_url: String,
    pub(crate) latest_url_type: String,
    pub(crate) versions: Vec<VersionOut>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) loaders: Vec<LoaderOut>,
}

#[derive(Serialize, Clone)]
pub(crate) struct LoaderOut {
    pub(crate) label: String,
    pub(crate) docs: String,
    pub(crate) code: String,
}

#[derive(Serialize)]
pub(crate) struct SourcesOut {
    pub(crate) fields: Vec<FieldDef>,
    pub(crate) sources: Vec<SourceOut>,
}

#[derive(Serialize)]
pub(crate) struct LinkOut {
    pub(crate) label: String,
    pub(crate) url: String,
}

#[derive(Serialize)]
pub(crate) struct DatasetOut {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) field: String,
    pub(crate) category: String,
    pub(crate) stars: Option<u64>,
    pub(crate) repo: String,
    pub(crate) links: Vec<LinkOut>,
    pub(crate) access: String,
    pub(crate) license: String,
    pub(crate) versions: String,
    pub(crate) paper_count: Option<u64>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) loaders: Vec<LoaderOut>,
}

#[derive(Serialize)]
pub(crate) struct DatasetsOut {
    pub(crate) datasets: Vec<DatasetOut>,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct Paper {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) method: String,
    pub(crate) authors: String,
    pub(crate) journal: String,
    pub(crate) year: String,
    pub(crate) date: String,
    pub(crate) doi: String,
    pub(crate) cited: u64,
    pub(crate) license: String,
    pub(crate) pdf: String,
    pub(crate) keywords: Vec<String>,
    pub(crate) tasks: Vec<String>,
    pub(crate) datasets: Vec<String>,
    pub(crate) lists: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) fields: Vec<String>,
    /// Open access or Creative Commons: the abstract may be shown.
    #[serde(skip)]
    pub(crate) reusable: bool,
    #[serde(rename = "abstract")]
    pub(crate) abstract_text: String,
    pub(crate) url: String,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct LatestOut {
    pub(crate) generated_at: String,
    pub(crate) since: String,
    pub(crate) until: String,
    pub(crate) days: i64,
    pub(crate) journals: Vec<String>,
    pub(crate) rule: String,
    pub(crate) papers: Vec<Paper>,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct FieldPapers {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) query: String,
    pub(crate) papers: Vec<Paper>,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct PapersOut {
    pub(crate) generated_at: String,
    pub(crate) source: String,
    pub(crate) rule: String,
    pub(crate) fields: Vec<FieldPapers>,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct BoardRow {
    pub(crate) rank: usize,
    pub(crate) model: String,
    pub(crate) kind: String,
    pub(crate) score: f64,
    pub(crate) values: Vec<Option<f64>>,
    pub(crate) paper: String,
    pub(crate) paper_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct BoardOut {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) field: String,
    pub(crate) task: String,
    pub(crate) dataset: String,
    pub(crate) source: String,
    pub(crate) csv: String,
    pub(crate) metric_label: String,
    pub(crate) higher: bool,
    pub(crate) columns: Vec<String>,
    pub(crate) fetched_at: String,
    pub(crate) rows: Vec<BoardRow>,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct BoardsOut {
    pub(crate) boards: Vec<BoardOut>,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct DayState {
    pub(crate) d: String,
    pub(crate) s: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct SourceStatus {
    pub(crate) state: String,
    pub(crate) code: u16,
    pub(crate) ms: u64,
    pub(crate) url: String,
    pub(crate) history: Vec<DayState>,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct LinkStatus {
    pub(crate) url: String,
    pub(crate) state: String,
    pub(crate) code: u16,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct StatusOut {
    pub(crate) checked_at: String,
    pub(crate) sources: BTreeMap<String, SourceStatus>,
    #[serde(default)]
    pub(crate) links: BTreeMap<String, LinkStatus>,
}

#[derive(Serialize)]
pub(crate) struct BuildOut {
    pub(crate) generated_at: String,
    pub(crate) engine: String,
    pub(crate) commit: String,
    pub(crate) mode: String,
    pub(crate) inputs: BTreeMap<String, String>,
    pub(crate) counts: BTreeMap<String, usize>,
}
