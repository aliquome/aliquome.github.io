//! atlas: builds the JSON files that the static site reads.
//!
//! Inputs (all in data/, so a build is repeatable):
//!   sources.toml            one block per database
//!   fields.toml             research fields, tasks, paper queries
//!   database_versions.csv   every release of every database, with its URL
//!   datasets.csv            datasets and benchmarks
//!   leaderboards.toml       published results tables to mirror
//!
//! Outputs (site/data/):
//!   sources.json        databases with all releases          (deterministic)
//!   datasets.json       datasets and benchmarks              (deterministic)
//!   papers.json         open-access papers per field, tagged (network)
//!   leaderboards.json   model comparison tables              (network)
//!   status.json         reachability of sources and links    (network)
//!   build.json          time, commit, input hashes, counts
//!
//! Usage:  atlas build [--root DIR] [--offline]
//! `--offline` makes no network call and leaves the network files untouched,
//! so the same inputs always produce byte-identical deterministic outputs.

use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread::sleep;
use std::time::{Duration, Instant};

use chrono::{SecondsFormat, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

type Res<T> = Result<T, Box<dyn Error>>;

const USER_AGENT: &str = concat!(
    "atlas-engine/",
    env!("CARGO_PKG_VERSION"),
    " (bioinformatics data atlas; daily link and literature check)"
);
const EUROPE_PMC: &str = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const PAPERS_PER_LIST: usize = 30;
const HISTORY_DAYS: usize = 30;

// ---------- input files ----------

#[derive(Deserialize)]
struct SourcesFile {
    source: Vec<SourceDef>,
}

#[derive(Deserialize)]
struct SourceDef {
    id: String,
    name: String,
    field: String,
    homepage: String,
    license: String,
    summary: String,
    #[serde(default)]
    aliases: Vec<String>,
    check: Option<String>,
}

#[derive(Deserialize)]
struct FieldsFile {
    field: Vec<FieldDef>,
    #[serde(default)]
    category: Vec<CategoryDef>,
}

#[derive(Deserialize, Serialize, Clone)]
struct TaskDef {
    id: String,
    label: String,
    #[serde(skip_serializing)]
    pattern: String,
}

#[derive(Deserialize, Serialize, Clone)]
struct FieldDef {
    id: String,
    label: String,
    #[serde(rename = "match", default, skip_serializing)]
    match_pattern: String,
    base: String,
    shape: String,
    query: String,
    #[serde(default)]
    tasks: Vec<TaskDef>,
}

#[derive(Deserialize)]
struct CategoryDef {
    prefix: String,
    field: String,
}

#[derive(Deserialize)]
struct BoardsFile {
    #[serde(default)]
    board: Vec<BoardDef>,
}

#[derive(Deserialize)]
struct BoardDef {
    id: String,
    title: String,
    field: String,
    task: String,
    dataset: String,
    url: String,
    source: String,
    model: String,
    kind: Option<String>,
    reference: Option<String>,
    metric: String,
    metric_label: String,
    higher: bool,
    #[serde(default)]
    columns: Vec<String>,
}

// ---------- output files ----------

#[derive(Serialize)]
struct VersionOut {
    version: String,
    date: String,
    status: String,
    url: String,
    url_type: String,
    verified: bool,
    note: String,
}

#[derive(Serialize)]
struct SourceOut {
    id: String,
    name: String,
    field: String,
    homepage: String,
    license: String,
    summary: String,
    latest: String,
    latest_date: String,
    latest_url: String,
    latest_url_type: String,
    versions: Vec<VersionOut>,
}

#[derive(Serialize)]
struct SourcesOut {
    fields: Vec<FieldDef>,
    sources: Vec<SourceOut>,
}

#[derive(Serialize)]
struct LinkOut {
    label: String,
    url: String,
}

#[derive(Serialize)]
struct DatasetOut {
    id: String,
    name: String,
    description: String,
    field: String,
    category: String,
    stars: Option<u64>,
    repo: String,
    links: Vec<LinkOut>,
    access: String,
    license: String,
    versions: String,
    paper_count: Option<u64>,
}

#[derive(Serialize)]
struct DatasetsOut {
    datasets: Vec<DatasetOut>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Paper {
    id: String,
    title: String,
    method: String,
    authors: String,
    journal: String,
    year: String,
    date: String,
    doi: String,
    cited: u64,
    license: String,
    pdf: String,
    keywords: Vec<String>,
    tasks: Vec<String>,
    datasets: Vec<String>,
    lists: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    fields: Vec<String>,
    /// Open access or Creative Commons: the abstract may be shown.
    #[serde(skip)]
    reusable: bool,
    #[serde(rename = "abstract")]
    abstract_text: String,
    url: String,
}

#[derive(Deserialize)]
struct LatestConfig {
    days: i64,
    max_papers: usize,
    core_journals: Vec<String>,
    general_journals: Vec<String>,
    general_filter: String,
}

#[derive(Serialize, Deserialize)]
struct LatestOut {
    generated_at: String,
    since: String,
    until: String,
    days: i64,
    journals: Vec<String>,
    rule: String,
    papers: Vec<Paper>,
}

#[derive(Serialize, Deserialize, Clone)]
struct FieldPapers {
    id: String,
    label: String,
    query: String,
    papers: Vec<Paper>,
}

#[derive(Serialize, Deserialize)]
struct PapersOut {
    generated_at: String,
    source: String,
    rule: String,
    fields: Vec<FieldPapers>,
}

#[derive(Serialize, Deserialize, Clone)]
struct BoardRow {
    rank: usize,
    model: String,
    kind: String,
    score: f64,
    values: Vec<Option<f64>>,
    paper: String,
    paper_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct BoardOut {
    id: String,
    title: String,
    field: String,
    task: String,
    dataset: String,
    source: String,
    csv: String,
    metric_label: String,
    higher: bool,
    columns: Vec<String>,
    fetched_at: String,
    rows: Vec<BoardRow>,
}

#[derive(Serialize, Deserialize)]
struct BoardsOut {
    boards: Vec<BoardOut>,
}

#[derive(Serialize, Deserialize, Clone)]
struct DayState {
    d: String,
    s: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct SourceStatus {
    state: String,
    code: u16,
    ms: u64,
    url: String,
    history: Vec<DayState>,
}

#[derive(Serialize, Deserialize, Clone)]
struct LinkStatus {
    url: String,
    state: String,
    code: u16,
}

#[derive(Serialize, Deserialize)]
struct StatusOut {
    checked_at: String,
    sources: BTreeMap<String, SourceStatus>,
    #[serde(default)]
    links: BTreeMap<String, LinkStatus>,
}

#[derive(Serialize)]
struct BuildOut {
    generated_at: String,
    engine: String,
    commit: String,
    mode: String,
    inputs: BTreeMap<String, String>,
    counts: BTreeMap<String, usize>,
}

// ---------- helpers ----------

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn today() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

fn sha256_file(path: &Path) -> Res<String> {
    let digest = Sha256::digest(fs::read(path)?);
    Ok(digest.iter().map(|b| format!("{:02x}", b)).collect())
}

/// Reads a CSV file (with or without a UTF-8 BOM) into maps keyed by header.
fn read_csv(path: &Path) -> Res<Vec<BTreeMap<String, String>>> {
    let text = fs::read_to_string(path)?;
    read_csv_text(text.trim_start_matches('\u{feff}'))
}

fn read_csv_text(text: &str) -> Res<Vec<BTreeMap<String, String>>> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());
    let headers: Vec<String> = reader.headers()?.iter().map(|h| h.trim().to_string()).collect();
    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record?;
        let mut row = BTreeMap::new();
        for (i, value) in record.iter().enumerate() {
            if let Some(h) = headers.get(i) {
                // Keep the first column when a header name repeats.
                row.entry(h.clone()).or_insert_with(|| value.trim().to_string());
            }
        }
        rows.push(row);
    }
    Ok(rows)
}

fn get(row: &BTreeMap<String, String>, key: &str) -> String {
    row.get(key).cloned().unwrap_or_default()
}

fn percent_encode(text: &str) -> String {
    let mut out = String::new();
    for b in text.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Res<()> {
    let mut text = serde_json::to_string_pretty(value)?;
    text.push('\n');
    fs::write(path, text)?;
    Ok(())
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

fn http(seconds: u64) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(seconds))
        .user_agent(USER_AGENT)
        .build()
}

// ---------- sources and versions ----------

fn build_sources(root: &Path, defs: &[SourceDef], fields: &[FieldDef]) -> Res<SourcesOut> {
    let rows = read_csv(&root.join("data/database_versions.csv"))?;
    let mut by_id: BTreeMap<String, Vec<VersionOut>> = BTreeMap::new();
    for row in &rows {
        let id = get(row, "source_id");
        if id.is_empty() {
            continue;
        }
        by_id.entry(id).or_default().push(VersionOut {
            version: get(row, "version"),
            date: get(row, "release_date"),
            status: get(row, "status"),
            url: get(row, "url"),
            url_type: get(row, "url_type"),
            verified: get(row, "verified").eq_ignore_ascii_case("yes"),
            note: get(row, "note"),
        });
    }

    let mut sources = Vec::new();
    for def in defs {
        let versions = by_id.remove(&def.id).unwrap_or_default();
        let pick = versions
            .iter()
            .rposition(|v| v.status == "latest")
            .or_else(|| versions.iter().rposition(|v| v.status == "current"))
            .or_else(|| versions.iter().rposition(|v| v.status != "unreleased" && v.status != "scheduled"));
        let (latest, latest_date, latest_url, latest_url_type) = match pick {
            Some(i) => {
                let v = &versions[i];
                (v.version.clone(), v.date.clone(), v.url.clone(), v.url_type.clone())
            }
            None => Default::default(),
        };
        sources.push(SourceOut {
            id: def.id.clone(),
            name: def.name.clone(),
            field: def.field.clone(),
            homepage: def.homepage.clone(),
            license: def.license.clone(),
            summary: def.summary.clone(),
            latest,
            latest_date,
            latest_url,
            latest_url_type,
            versions,
        });
    }
    for id in by_id.keys() {
        eprintln!("warning: source '{}' has releases but no entry in data/sources.toml", id);
    }
    Ok(SourcesOut { fields: fields.to_vec(), sources })
}

// ---------- datasets ----------

fn build_datasets(root: &Path, categories: &[CategoryDef]) -> Res<DatasetsOut> {
    let rows = read_csv(&root.join("data/datasets.csv"))?;
    let mut datasets = Vec::new();
    for row in &rows {
        let name = get(row, "name");
        if name.is_empty() {
            continue;
        }
        let category = get(row, "category");
        let field = categories
            .iter()
            .find(|c| category.starts_with(&c.prefix))
            .map(|c| c.field.clone())
            .unwrap_or_else(|| "benchmarks".to_string());
        let links = get(row, "links")
            .split(" ; ")
            .filter_map(|pair| {
                let (label, url) = pair.split_once('|')?;
                let url = url.trim();
                if url.starts_with("http") {
                    Some(LinkOut { label: label.trim().to_string(), url: url.to_string() })
                } else {
                    None
                }
            })
            .collect();
        datasets.push(DatasetOut {
            id: get(row, "id"),
            name,
            description: get(row, "description"),
            field,
            category,
            stars: get(row, "stars").parse().ok(),
            repo: get(row, "repo"),
            links,
            access: get(row, "access"),
            license: get(row, "license"),
            versions: get(row, "versions"),
            paper_count: get(row, "paper_count").parse().ok(),
        });
    }
    Ok(DatasetsOut { datasets })
}

// ---------- papers (Europe PMC) ----------

/// A name to look for in titles and abstracts, pointing at a source or dataset.
struct Mention {
    id: String,
    re: Regex,
}

fn mention_needles(name: &str) -> Vec<String> {
    let mut out = Vec::new();
    let head = name.split(" (").next().unwrap_or(name).trim();
    out.push(head.to_string());
    if let (Some(a), Some(b)) = (name.find('('), name.rfind(')')) {
        if b > a + 1 {
            out.push(name[a + 1..b].trim().to_string());
        }
    }
    out.retain(|n| n.chars().count() >= 3);
    out
}

fn build_mentions(sources: &[SourceDef], datasets: &DatasetsOut) -> Vec<Mention> {
    let mut items: Vec<(String, String)> = Vec::new();
    for s in sources {
        for n in mention_needles(&s.name) {
            items.push((format!("db:{}", s.id), n));
        }
        for a in &s.aliases {
            items.push((format!("db:{}", s.id), a.clone()));
        }
    }
    for d in &datasets.datasets {
        for n in mention_needles(&d.name) {
            items.push((format!("ds:{}", d.id), n));
        }
    }
    let mut out = Vec::new();
    for (id, needle) in items {
        // All-capital or mixed names with digits (QM9, ZINC, STRING) are
        // matched case-sensitively so ordinary words do not match.
        let strict = needle.chars().any(|c| c.is_ascii_digit())
            || needle.chars().filter(|c| c.is_alphabetic()).all(|c| c.is_uppercase());
        let pattern = format!(
            r"{}(?:^|[^\w]){}(?:[^\w]|$)",
            if strict { "" } else { "(?i)" },
            regex::escape(&needle)
        );
        if let Ok(re) = Regex::new(&pattern) {
            out.push(Mention { id, re });
        }
    }
    out
}

fn text_of(v: &Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// Method name from titles such as "Foldseek: fast structure search" or
/// "Fast and accurate protein structure search with Foldseek."
fn method_from_title(title: &str) -> String {
    if let Some((head, _)) = title.split_once(':') {
        let head = head.trim();
        let words = head.split_whitespace().count();
        if (1..=4).contains(&words) && head.chars().count() <= 40 {
            return head.to_string();
        }
    }
    let tail = Regex::new(r"\b(?:with|using|by|via|in) ([A-Z][A-Za-z0-9-]{2,})\.?$").expect("static regex");
    tail.captures(title.trim()).map(|c| c[1].to_string()).unwrap_or_default()
}

fn fetch_papers(agent: &ureq::Agent, query: &str, tags: &Regex) -> Res<Vec<Paper>> {
    let url = format!(
        "{}?query={}&format=json&resultType=core&pageSize={}&sort={}",
        EUROPE_PMC,
        percent_encode(query),
        PAPERS_PER_LIST + 10,
        percent_encode("CITED desc")
    );
    let json: Value = serde_json::from_str(&agent.get(&url).call()?.into_string()?)?;
    let mut papers = Vec::new();
    for r in results_of(&json) {
        if let Some(p) = parse_record(r, tags, true) {
            papers.push(p);
            if papers.len() == PAPERS_PER_LIST {
                break;
            }
        }
    }
    Ok(papers)
}

fn results_of(json: &Value) -> Vec<Value> {
    json.pointer("/resultList/result")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default()
}

/// Turns one Europe PMC "core" record into a Paper. With `need_abstract`,
/// records without an abstract are skipped; otherwise the abstract is kept
/// only when the record is open access or carries a Creative Commons licence.
/// Europe PMC sometimes sends markup as entities (`&lt;i&gt;`); decode them
/// so the tag filter can remove the markup.
fn unescape(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

fn parse_record(r: &Value, tags: &Regex, need_abstract: bool) -> Option<Paper> {
    let title = tags.replace_all(&unescape(&text_of(r, "title")), "").trim().to_string();
    let abstract_text = tags.replace_all(&unescape(&text_of(r, "abstractText")), " ");
    let mut abstract_text = abstract_text.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() || (need_abstract && abstract_text.is_empty()) {
        return None;
    }
    let license = text_of(r, "license");
    let reusable = text_of(r, "isOpenAccess") == "Y" || license.to_lowercase().starts_with("cc");
    if need_abstract && !reusable {
        abstract_text.clear();
    }
    let source = text_of(r, "source");
    let id = text_of(r, "id");
    let journal = r
        .pointer("/journalInfo/journal/title")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| if source == "PPR" { "Preprint".to_string() } else { String::new() });
    let doi = text_of(r, "doi");
    let mut keywords: Vec<String> = r
        .pointer("/keywordList/keyword")
        .and_then(|k| k.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.trim().to_string())).collect())
        .unwrap_or_default();
    if let Some(mesh) = r.pointer("/meshHeadingList/meshHeading").and_then(|m| m.as_array()) {
        for m in mesh {
            if m.get("majorTopic_YN").and_then(|y| y.as_str()) == Some("Y") {
                if let Some(d) = m.get("descriptorName").and_then(|d| d.as_str()) {
                    keywords.push(d.to_string());
                }
            }
        }
    }
    keywords.dedup();
    let pdf = r
        .pointer("/fullTextUrlList/fullTextUrl")
        .and_then(|l| l.as_array())
        .and_then(|l| {
            l.iter().find(|u| {
                u.get("documentStyle").and_then(|s| s.as_str()) == Some("pdf")
                    && u.get("availabilityCode").and_then(|s| s.as_str()) == Some("OA")
            })
        })
        .and_then(|u| u.get("url").and_then(|s| s.as_str()))
        .unwrap_or("")
        .to_string();
    Some(Paper {
        id: format!("{}:{}", source, id),
        method: method_from_title(&title),
        title,
        authors: text_of(r, "authorString"),
        journal,
        year: text_of(r, "pubYear"),
        date: text_of(r, "firstPublicationDate"),
        url: if doi.is_empty() {
            format!("https://europepmc.org/article/{}/{}", source, id)
        } else {
            format!("https://doi.org/{}", doi)
        },
        doi,
        cited: r.get("citedByCount").and_then(|c| c.as_u64()).unwrap_or(0),
        license,
        pdf,
        keywords,
        tasks: Vec::new(),
        datasets: Vec::new(),
        lists: Vec::new(),
        fields: Vec::new(),
        reusable,
        abstract_text,
    })
}

fn tag_paper(p: &mut Paper, tasks: &[(String, Regex)], mentions: &[Mention]) {
    let text = format!("{} {} {}", p.title, p.abstract_text, p.keywords.join(" "));
    p.tasks = tasks
        .iter()
        .filter(|(_, re)| re.is_match(&text))
        .map(|(id, _)| id.clone())
        .collect();
    let found: BTreeSet<String> = mentions
        .iter()
        .filter(|m| m.re.is_match(&text))
        .map(|m| m.id.clone())
        .collect();
    p.datasets = found.into_iter().collect();
}

fn build_papers(fields: &[FieldDef], mentions: &[Mention], previous: Option<PapersOut>) -> PapersOut {
    let agent = http(60);
    let tags = Regex::new(r"<[^>]+>").expect("static regex");
    let since = (Utc::now() - chrono::Duration::days(730)).format("%Y-%m-%d").to_string();
    let until = today();
    let old: BTreeMap<String, FieldPapers> = previous
        .map(|p| p.fields.into_iter().map(|f| (f.id.clone(), f)).collect())
        .unwrap_or_default();

    let mut out = Vec::new();
    for field in fields {
        let base = format!("{} AND OPEN_ACCESS:y", field.query);
        let recent_query = format!("{} AND FIRST_PDATE:[{} TO {}]", base, since, until);
        let tasks: Vec<(String, Regex)> = field
            .tasks
            .iter()
            .filter_map(|t| Regex::new(&format!("(?i){}", t.pattern)).ok().map(|re| (t.id.clone(), re)))
            .collect();

        let mut merged: Vec<Paper> = Vec::new();
        let mut ok = true;
        for (list, query) in [("classic", &base), ("recent", &recent_query)] {
            match fetch_papers(&agent, query, &tags) {
                Ok(found) => {
                    for mut p in found {
                        if let Some(i) = merged.iter().position(|m| m.id == p.id) {
                            merged[i].lists.push(list.to_string());
                        } else {
                            p.lists.push(list.to_string());
                            merged.push(p);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("papers: {} ({}) failed: {}", field.id, list, e);
                    ok = false;
                }
            }
            sleep(Duration::from_millis(400));
        }
        if !ok || merged.is_empty() {
            if let Some(kept) = old.get(&field.id) {
                println!("papers: {:<12} kept previous {}", field.id, kept.papers.len());
                out.push(kept.clone());
                continue;
            }
        }
        for p in merged.iter_mut() {
            tag_paper(p, &tasks, mentions);
        }
        println!("papers: {:<12} {}", field.id, merged.len());
        out.push(FieldPapers {
            id: field.id.clone(),
            label: field.label.clone(),
            query: base,
            papers: merged,
        });
    }
    PapersOut {
        generated_at: now(),
        source: "Europe PMC REST API".to_string(),
        rule: "For each field, the 30 most cited open-access papers of all time and the 30 most cited \
               of the last 24 months that match the field query. Tasks come from keyword patterns; \
               datasets are databases and datasets named in the title, abstract or keywords."
            .to_string(),
        fields: out,
    }
}

// ---------- latest papers from selected journals ----------

fn journal_clause(names: &[String]) -> String {
    let parts: Vec<String> = names.iter().map(|j| format!("JOURNAL:\"{}\"", j)).collect();
    format!("({})", parts.join(" OR "))
}

/// Fields whose pattern matches at least twice, strongest first, at most
/// three. A paper with only single matches keeps its single best field.
fn pick_fields(matchers: &[(String, Regex)], text: &str) -> Vec<String> {
    let mut scored: Vec<(usize, &String)> = matchers
        .iter()
        .map(|(id, re)| (re.find_iter(text).count(), id))
        .filter(|(n, _)| *n > 0)
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    let strong: Vec<String> = scored.iter().filter(|(n, _)| *n >= 2).take(3).map(|(_, id)| (*id).clone()).collect();
    if strong.is_empty() {
        scored.first().map(|(_, id)| vec![(*id).clone()]).unwrap_or_default()
    } else {
        strong
    }
}

fn build_latest(
    cfg: &LatestConfig,
    fields: &[FieldDef],
    mentions: &[Mention],
    previous: Option<LatestOut>,
) -> Option<LatestOut> {
    let agent = http(90);
    let tags = Regex::new(r"<[^>]+>").expect("static regex");
    let since = (Utc::now() - chrono::Duration::days(cfg.days)).format("%Y-%m-%d").to_string();
    let until = today();
    let query = format!(
        "({} OR ({} AND {})) AND FIRST_PDATE:[{} TO {}]",
        journal_clause(&cfg.core_journals),
        journal_clause(&cfg.general_journals),
        cfg.general_filter,
        since,
        until
    );

    let matchers: Vec<(String, Regex)> = fields
        .iter()
        .filter(|f| !f.match_pattern.is_empty())
        .filter_map(|f| Regex::new(&format!("(?i){}", f.match_pattern)).ok().map(|re| (f.id.clone(), re)))
        .collect();
    let tasks: Vec<(String, Regex)> = fields
        .iter()
        .flat_map(|f| {
            f.tasks.iter().filter_map(move |t| {
                Regex::new(&format!("(?i){}", t.pattern)).ok().map(|re| (format!("{}:{}", f.id, t.id), re))
            })
        })
        .collect();

    let mut papers: Vec<Paper> = Vec::new();
    let mut cursor = "*".to_string();
    loop {
        let url = format!(
            "{}?query={}&format=json&resultType=core&pageSize=1000&sort={}&cursorMark={}",
            EUROPE_PMC,
            percent_encode(&query),
            percent_encode("P_PDATE_D desc"),
            percent_encode(&cursor)
        );
        let json: Value = match agent.get(&url).call().map_err(|e| e.to_string()).and_then(|r| {
            r.into_string().map_err(|e| e.to_string())
        }) {
            Ok(body) => match serde_json::from_str(&body) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("latest: bad JSON: {}", e);
                    break;
                }
            },
            Err(e) => {
                eprintln!("latest: request failed: {}", e);
                break;
            }
        };
        let page = results_of(&json);
        if page.is_empty() {
            break;
        }
        for r in &page {
            if let Some(p) = parse_record(r, &tags, false) {
                if !papers.iter().any(|x| x.id == p.id) {
                    papers.push(p);
                }
            }
        }
        let next = text_of(&json, "nextCursorMark");
        if papers.len() >= cfg.max_papers || next.is_empty() || next == cursor {
            break;
        }
        cursor = next;
        sleep(Duration::from_millis(500));
    }

    if papers.is_empty() {
        eprintln!("latest: no papers fetched; keeping the previous file");
        return previous;
    }
    papers.truncate(cfg.max_papers);
    for p in papers.iter_mut() {
        let text = format!("{} {} {}", p.title, p.abstract_text, p.keywords.join(" "));
        p.fields = pick_fields(&matchers, &text);
        p.tasks = tasks
            .iter()
            .filter(|(id, re)| p.fields.iter().any(|f| id.starts_with(&format!("{}:", f))) && re.is_match(&text))
            .map(|(id, _)| id.clone())
            .collect();
        let found: BTreeSet<String> = mentions.iter().filter(|m| m.re.is_match(&text)).map(|m| m.id.clone()).collect();
        p.datasets = found.into_iter().collect();
        // Tag from the full abstract, but publish it only when it may be reused.
        if !p.reusable {
            p.abstract_text.clear();
        }
    }
    println!("latest: {} papers since {}", papers.len(), since);

    let mut journals = cfg.core_journals.clone();
    journals.extend(cfg.general_journals.iter().map(|j| format!("{} (computational papers only)", j)));
    Some(LatestOut {
        generated_at: now(),
        since,
        until,
        days: cfg.days,
        journals,
        rule: "Every paper first published in the listed journals during the window, newest first. \
               Fields, tasks and named datasets are assigned from keyword patterns. Abstracts are shown \
               for open-access or Creative Commons papers."
            .to_string(),
        papers,
    })
}

// ---------- leaderboards ----------

fn parse_score(text: &str) -> Option<f64> {
    text.trim().parse::<f64>().ok().filter(|v| v.is_finite())
}

fn fetch_board(agent: &ureq::Agent, def: &BoardDef, anchor: &Regex) -> Res<BoardOut> {
    let body = agent.get(&def.url).call()?.into_string()?;
    let rows = read_csv_text(body.trim_start_matches('\u{feff}'))?;
    let columns: Vec<(String, String)> = def
        .columns
        .iter()
        .filter_map(|c| c.split_once('=').map(|(k, v)| (k.trim().to_string(), v.trim().to_string())))
        .collect();
    let mut out = Vec::new();
    for row in &rows {
        let model = get(row, &def.model);
        let score = match parse_score(&get(row, &def.metric)) {
            Some(s) if !model.is_empty() => s,
            _ => continue,
        };
        let reference = def.reference.as_ref().map(|r| get(row, r)).unwrap_or_default();
        let (paper, paper_url) = match anchor.captures(&reference) {
            Some(c) => (c[2].trim().to_string(), c[1].to_string()),
            None => (String::new(), String::new()),
        };
        out.push(BoardRow {
            rank: 0,
            model,
            kind: def.kind.as_ref().map(|k| get(row, k)).unwrap_or_default(),
            score,
            values: columns.iter().map(|(k, _)| parse_score(&get(row, k))).collect(),
            paper,
            paper_url,
        });
    }
    if out.is_empty() {
        return Err(format!("no rows with column '{}'", def.metric).into());
    }
    out.sort_by(|a, b| {
        let o = a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal);
        if def.higher { o.reverse() } else { o }
    });
    for (i, r) in out.iter_mut().enumerate() {
        r.rank = i + 1;
    }
    Ok(BoardOut {
        id: def.id.clone(),
        title: def.title.clone(),
        field: def.field.clone(),
        task: def.task.clone(),
        dataset: def.dataset.clone(),
        source: def.source.clone(),
        csv: def.url.clone(),
        metric_label: def.metric_label.clone(),
        higher: def.higher,
        columns: columns.into_iter().map(|(_, label)| label).collect(),
        fetched_at: now(),
        rows: out,
    })
}

fn build_boards(defs: &[BoardDef], previous: Option<BoardsOut>) -> BoardsOut {
    let agent = http(60);
    let anchor = Regex::new(r#"(?s)<a[^>]*href=['"]([^'"]+)['"][^>]*>(.*?)</a>"#).expect("static regex");
    let old: BTreeMap<String, BoardOut> = previous
        .map(|p| p.boards.into_iter().map(|b| (b.id.clone(), b)).collect())
        .unwrap_or_default();
    let mut boards = Vec::new();
    for def in defs {
        match fetch_board(&agent, def, &anchor) {
            Ok(b) => {
                println!("board: {:<40} {} rows", b.id, b.rows.len());
                boards.push(b);
            }
            Err(e) => {
                eprintln!("board: {} failed: {}", def.id, e);
                if let Some(b) = old.get(&def.id) {
                    boards.push(b.clone());
                }
            }
        }
    }
    BoardsOut { boards }
}

// ---------- source and link status ----------

fn probe(agent: &ureq::Agent, url: &str) -> (String, u16, u64) {
    let started = Instant::now();
    let first = match agent.head(url).call() {
        Ok(resp) => resp.status(),
        Err(ureq::Error::Status(code, _)) => code,
        Err(_) => 0,
    };
    // Some servers refuse HEAD. Try one ordinary GET before deciding.
    let code = if first == 0 || first == 405 || first == 501 {
        match agent.get(url).call() {
            Ok(resp) => resp.status(),
            Err(ureq::Error::Status(c, _)) => c,
            Err(_) => 0,
        }
    } else {
        first
    };
    let state = match code {
        200..=399 => "ok",
        // The server answered but refuses automated clients. It is up.
        401 | 403 | 406 | 429 => "blocked",
        _ => "down",
    };
    (state.to_string(), code, started.elapsed().as_millis() as u64)
}

fn build_status(defs: &[SourceDef], sources: &SourcesOut, previous: Option<StatusOut>) -> StatusOut {
    let agent = http(25);
    let mut old = previous.map(|p| p.sources).unwrap_or_default();
    let day = today();
    let mut out = BTreeMap::new();
    for def in defs {
        let url = def.check.clone().unwrap_or_else(|| def.homepage.clone());
        let (state, code, ms) = probe(&agent, &url);
        println!("status: {:<22} {:<8} {} ({} ms)", def.id, state, code, ms);
        let mut history = old.remove(&def.id).map(|s| s.history).unwrap_or_default();
        history.retain(|h| h.d != day);
        history.push(DayState { d: day.clone(), s: state.clone() });
        if history.len() > HISTORY_DAYS {
            let cut = history.len() - HISTORY_DAYS;
            history.drain(0..cut);
        }
        out.insert(def.id.clone(), SourceStatus { state, code, ms, url, history });
        sleep(Duration::from_millis(150));
    }

    // Check the download link of the current release of each source.
    let mut links = BTreeMap::new();
    for s in &sources.sources {
        let u = &s.latest_url;
        let checkable = (u.starts_with("https://") || u.starts_with("http://"))
            && !u.contains('{')
            && matches!(s.latest_url_type.as_str(), "file" | "directory" | "api");
        if !checkable {
            continue;
        }
        let (state, code, _) = probe(&agent, u);
        println!("link:   {:<22} {:<8} {}", s.id, state, code);
        links.insert(s.id.clone(), LinkStatus { url: u.clone(), state, code });
        sleep(Duration::from_millis(150));
    }
    StatusOut { checked_at: now(), sources: out, links }
}

// ---------- main ----------

fn run() -> Res<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut root = PathBuf::from(".");
    let mut offline = false;
    let mut command = String::from("build");
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--offline" => offline = true,
            "--root" => {
                i += 1;
                root = PathBuf::from(args.get(i).ok_or("--root needs a directory")?);
            }
            "-h" | "--help" => {
                println!("atlas build [--root DIR] [--offline]");
                return Ok(());
            }
            other if !other.starts_with('-') => command = other.to_string(),
            other => return Err(format!("unknown option: {}", other).into()),
        }
        i += 1;
    }
    if command != "build" {
        return Err(format!("unknown command: {}", command).into());
    }

    let data_in = root.join("data");
    let sources_file: SourcesFile = toml::from_str(&fs::read_to_string(data_in.join("sources.toml"))?)?;
    let fields_file: FieldsFile = toml::from_str(&fs::read_to_string(data_in.join("fields.toml"))?)?;
    let boards_file: BoardsFile = toml::from_str(&fs::read_to_string(data_in.join("leaderboards.toml"))?)?;
    let out = root.join("site/data");
    fs::create_dir_all(&out)?;

    let sources = build_sources(&root, &sources_file.source, &fields_file.field)?;
    write_json(&out.join("sources.json"), &sources)?;
    let datasets = build_datasets(&root, &fields_file.category)?;
    write_json(&out.join("datasets.json"), &datasets)?;

    let mut counts = BTreeMap::new();
    counts.insert("sources".to_string(), sources.sources.len());
    counts.insert("versions".to_string(), sources.sources.iter().map(|s| s.versions.len()).sum());
    counts.insert("datasets".to_string(), datasets.datasets.len());

    if offline {
        println!("offline: papers, leaderboards and status left unchanged");
    } else {
        let mentions = build_mentions(&sources_file.source, &datasets);
        let papers = build_papers(&fields_file.field, &mentions, read_json(&out.join("papers.json")));
        counts.insert("papers".to_string(), papers.fields.iter().map(|f| f.papers.len()).sum());
        write_json(&out.join("papers.json"), &papers)?;

        let latest_cfg: LatestConfig = toml::from_str(&fs::read_to_string(data_in.join("latest.toml"))?)?;
        if let Some(latest) = build_latest(&latest_cfg, &fields_file.field, &mentions, read_json(&out.join("latest.json"))) {
            counts.insert("latest_papers".to_string(), latest.papers.len());
            write_json(&out.join("latest.json"), &latest)?;
        }

        let boards = build_boards(&boards_file.board, read_json(&out.join("leaderboards.json")));
        counts.insert("leaderboard_rows".to_string(), boards.boards.iter().map(|b| b.rows.len()).sum());
        write_json(&out.join("leaderboards.json"), &boards)?;

        let status = build_status(&sources_file.source, &sources, read_json(&out.join("status.json")));
        write_json(&out.join("status.json"), &status)?;
    }

    let mut inputs = BTreeMap::new();
    for name in [
        "data/sources.toml",
        "data/fields.toml",
        "data/leaderboards.toml",
        "data/latest.toml",
        "data/database_versions.csv",
        "data/datasets.csv",
    ] {
        inputs.insert(name.to_string(), sha256_file(&root.join(name))?);
    }
    write_json(
        &out.join("build.json"),
        &BuildOut {
            generated_at: now(),
            engine: format!("atlas-engine {}", env!("CARGO_PKG_VERSION")),
            commit: env::var("GITHUB_SHA").unwrap_or_else(|_| "local".to_string()),
            mode: if offline { "offline" } else { "online" }.to_string(),
            inputs,
            counts,
        },
    )?;
    println!("done: wrote {}", out.display());
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}
