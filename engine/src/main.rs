//! atlas: builds the JSON data files that the static site reads.
//!
//! Inputs (all in the repository, so a build is repeatable):
//!   registry/sources.toml     one block per database
//!   registry/fields.toml      research fields, paper queries, category map
//!   databases_versions.csv    every release of every database
//!   datasets.csv              datasets and benchmarks
//!
//! Outputs (site/data/):
//!   sources.json   databases with all versions        (deterministic)
//!   datasets.json  datasets and benchmarks            (deterministic)
//!   papers.json    top open-access papers per field   (network, daily)
//!   status.json    reachability of every source       (network, daily)
//!   build.json     provenance: time, commit, input hashes, counts
//!
//! Usage:
//!   atlas build [--root DIR] [--offline]
//!
//! `--offline` skips every network call and keeps the papers and status
//! files as they are, so the same inputs always give the same outputs.

use std::collections::BTreeMap;
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
const PAPERS_PER_LIST: usize = 8;
const HISTORY_DAYS: usize = 30;

// ---------- registry files ----------

#[derive(Deserialize)]
struct SourcesFile {
    source: Vec<SourceDef>,
}

#[derive(Deserialize)]
struct SourceDef {
    id: String,
    name: String,
    csv: Option<String>,
    field: String,
    homepage: String,
    license: String,
    summary: String,
    check: Option<String>,
}

#[derive(Deserialize)]
struct FieldsFile {
    field: Vec<FieldDef>,
    #[serde(default)]
    category: Vec<CategoryDef>,
}

#[derive(Deserialize, Serialize, Clone)]
struct FieldDef {
    id: String,
    label: String,
    base: String,
    shape: String,
    query: String,
}

#[derive(Deserialize)]
struct CategoryDef {
    prefix: String,
    field: String,
}

// ---------- output files ----------

#[derive(Serialize)]
struct VersionOut {
    version: String,
    date: String,
    url: String,
    verified: bool,
    latest: bool,
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
    desc: String,
    field: String,
    category: String,
    stars: Option<u64>,
    repo: String,
    links: Vec<LinkOut>,
    access: String,
}

#[derive(Serialize)]
struct DatasetsOut {
    datasets: Vec<DatasetOut>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Paper {
    id: String,
    title: String,
    authors: String,
    journal: String,
    year: String,
    date: String,
    doi: String,
    cited: u64,
    #[serde(rename = "abstract")]
    abstract_text: String,
    url: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct FieldPapers {
    id: String,
    label: String,
    query: String,
    classics: Vec<Paper>,
    recent: Vec<Paper>,
}

#[derive(Serialize, Deserialize)]
struct PapersOut {
    generated_at: String,
    source: String,
    rule: String,
    fields: Vec<FieldPapers>,
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

#[derive(Serialize, Deserialize)]
struct StatusOut {
    checked_at: String,
    sources: BTreeMap<String, SourceStatus>,
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
    let bytes = fs::read(path)?;
    let digest = Sha256::digest(&bytes);
    let mut hex = String::with_capacity(64);
    for b in digest.iter() {
        hex.push_str(&format!("{:02x}", b));
    }
    Ok(hex)
}

/// Reads a CSV file (with or without a UTF-8 BOM) into rows of strings,
/// skipping the header row.
fn read_csv(path: &Path) -> Res<Vec<Vec<String>>> {
    let text = fs::read_to_string(path)?;
    let text = text.trim_start_matches('\u{feff}');
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());
    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record?;
        rows.push(record.iter().map(|c| c.trim().to_string()).collect());
    }
    Ok(rows)
}

fn cell(row: &[String], i: usize) -> String {
    row.get(i).cloned().unwrap_or_default()
}

fn slug(text: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for ch in text.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    out.trim_end_matches('-').to_string()
}

fn percent_encode(text: &str) -> String {
    let mut out = String::new();
    for b in text.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
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
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn agent(seconds: u64) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(seconds))
        .user_agent(USER_AGENT)
        .build()
}

// ---------- sources and versions ----------

fn build_sources(root: &Path, defs: &[SourceDef], fields: &[FieldDef]) -> Res<SourcesOut> {
    let rows = read_csv(&root.join("databases_versions.csv"))?;
    let mut by_name: BTreeMap<String, Vec<VersionOut>> = BTreeMap::new();
    for row in &rows {
        let name = cell(row, 0);
        if name.is_empty() {
            continue;
        }
        let version = cell(row, 1);
        by_name.entry(name).or_default().push(VersionOut {
            version,
            date: cell(row, 2),
            url: cell(row, 3),
            verified: cell(row, 4).eq_ignore_ascii_case("yes"),
            latest: false,
        });
    }

    let mut sources = Vec::new();
    for def in defs {
        let key = def.csv.clone().unwrap_or_else(|| def.name.clone());
        let mut versions = by_name.remove(&key).unwrap_or_default();
        mark_latest(&mut versions);
        let newest = versions.iter().rev().find(|v| v.latest);
        let latest = newest.map(|v| v.version.clone()).unwrap_or_default();
        let latest_date = newest.map(|v| v.date.clone()).unwrap_or_default();
        sources.push(SourceOut {
            id: def.id.clone(),
            name: def.name.clone(),
            field: def.field.clone(),
            homepage: def.homepage.clone(),
            license: def.license.clone(),
            summary: def.summary.clone(),
            latest,
            latest_date,
            versions,
        });
    }
    for name in by_name.keys() {
        eprintln!("warning: '{}' is in databases_versions.csv but not in registry/sources.toml", name);
    }
    Ok(SourcesOut {
        fields: fields.to_vec(),
        sources,
    })
}

/// Picks the current release. The catalogue is written in Persian and marks
/// rows in the version text: "آخرین" = latest, "فعلی" = current,
/// "منتشر نشده" = not released, "بازنشسته" = retired.
/// Order of preference: a row marked latest, then one marked current, then
/// the last released row in file order.
fn mark_latest(versions: &mut [VersionOut]) {
    let unreleased = |v: &VersionOut| v.version.contains("منتشر نشده") || v.version.contains("بازنشسته");
    let pick = versions
        .iter()
        .rposition(|v| v.version.contains("آخرین") && !unreleased(v))
        .or_else(|| versions.iter().rposition(|v| v.version.contains("فعلی") && !unreleased(v)))
        .or_else(|| versions.iter().rposition(|v| !unreleased(v)));
    if let Some(i) = pick {
        versions[i].latest = true;
    }
}

// ---------- datasets ----------

fn build_datasets(root: &Path, categories: &[CategoryDef]) -> Res<DatasetsOut> {
    let rows = read_csv(&root.join("datasets.csv"))?;
    let bold = Regex::new(r"\*\*(.+?)\*\*")?;
    let link = Regex::new(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")?;
    let md = Regex::new(r"[*`]")?;
    let mut datasets = Vec::new();
    let mut seen: BTreeMap<String, usize> = BTreeMap::new();

    for row in &rows {
        let category = cell(row, 0);
        let raw_name = cell(row, 2);
        if raw_name.is_empty() {
            continue;
        }
        let (name, desc) = match bold.captures(&raw_name) {
            Some(c) => {
                let whole = c.get(0).map(|m| m.end()).unwrap_or(0);
                let rest = raw_name[whole..].trim_start_matches([':', ' ', '،']).trim();
                (c[1].trim().to_string(), rest.to_string())
            }
            None => (raw_name.clone(), String::new()),
        };
        let desc = link.replace_all(&desc, "$1").to_string();
        let desc = md.replace_all(&desc, "").to_string();

        let access_raw = cell(row, 5);
        let links: Vec<LinkOut> = link
            .captures_iter(&access_raw)
            .map(|c| LinkOut {
                label: c[1].to_string(),
                url: c[2].to_string(),
            })
            .collect();
        let access = link.replace_all(&access_raw, "$1").to_string();
        let access = access.replace("**", "");

        let field = categories
            .iter()
            .find(|c| category.starts_with(&c.prefix))
            .map(|c| c.field.clone())
            .unwrap_or_else(|| "benchmarks".to_string());

        let mut id = slug(&name);
        if id.is_empty() {
            id = "dataset".to_string();
        }
        let n = seen.entry(id.clone()).or_insert(0);
        *n += 1;
        if *n > 1 {
            id = format!("{}-{}", id, n);
        }

        datasets.push(DatasetOut {
            id,
            name,
            desc,
            field,
            category,
            stars: cell(row, 3).parse::<u64>().ok(),
            repo: cell(row, 4),
            links,
            access,
        });
    }
    Ok(DatasetsOut { datasets })
}

// ---------- papers (Europe PMC) ----------

fn text_of(v: &Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

fn fetch_papers(agent: &ureq::Agent, query: &str, tags: &Regex) -> Res<Vec<Paper>> {
    let url = format!(
        "{}?query={}&format=json&resultType=core&pageSize={}&sort={}",
        EUROPE_PMC,
        percent_encode(query),
        PAPERS_PER_LIST + 4,
        percent_encode("CITED desc")
    );
    let body = agent.get(&url).call()?.into_string()?;
    let json: Value = serde_json::from_str(&body)?;
    let mut papers = Vec::new();
    let results = json
        .get("resultList")
        .and_then(|r| r.get("result"))
        .and_then(|r| r.as_array());
    if let Some(results) = results {
        for r in results {
            let title = tags.replace_all(&text_of(r, "title"), "").trim().to_string();
            let abstract_text = tags.replace_all(&text_of(r, "abstractText"), " ").to_string();
            let abstract_text = abstract_text.split_whitespace().collect::<Vec<_>>().join(" ");
            if title.is_empty() || abstract_text.is_empty() {
                continue;
            }
            let source = text_of(r, "source");
            let id = text_of(r, "id");
            let journal = r
                .get("journalInfo")
                .and_then(|j| j.get("journal"))
                .and_then(|j| j.get("title"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    if source == "PPR" {
                        "Preprint".to_string()
                    } else {
                        String::new()
                    }
                });
            let doi = text_of(r, "doi");
            let url = if doi.is_empty() {
                format!("https://europepmc.org/article/{}/{}", source, id)
            } else {
                format!("https://doi.org/{}", doi)
            };
            papers.push(Paper {
                id: format!("{}:{}", source, id),
                title,
                authors: text_of(r, "authorString"),
                journal,
                year: text_of(r, "pubYear"),
                date: text_of(r, "firstPublicationDate"),
                doi,
                cited: r.get("citedByCount").and_then(|c| c.as_u64()).unwrap_or(0),
                abstract_text,
                url,
            });
            if papers.len() == PAPERS_PER_LIST {
                break;
            }
        }
    }
    Ok(papers)
}

fn build_papers(fields: &[FieldDef], previous: Option<PapersOut>) -> PapersOut {
    let agent = agent(40);
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
        let kept = old.get(&field.id);

        let classics = match fetch_papers(&agent, &base, &tags) {
            Ok(p) if !p.is_empty() => p,
            Ok(_) => kept.map(|k| k.classics.clone()).unwrap_or_default(),
            Err(e) => {
                eprintln!("papers: {} (classics) failed: {}", field.id, e);
                kept.map(|k| k.classics.clone()).unwrap_or_default()
            }
        };
        sleep(Duration::from_millis(400));
        let recent = match fetch_papers(&agent, &recent_query, &tags) {
            Ok(p) if !p.is_empty() => p,
            Ok(_) => kept.map(|k| k.recent.clone()).unwrap_or_default(),
            Err(e) => {
                eprintln!("papers: {} (recent) failed: {}", field.id, e);
                kept.map(|k| k.recent.clone()).unwrap_or_default()
            }
        };
        sleep(Duration::from_millis(400));

        println!("papers: {:<12} classics {} recent {}", field.id, classics.len(), recent.len());
        out.push(FieldPapers {
            id: field.id.clone(),
            label: field.label.clone(),
            query: base,
            classics,
            recent,
        });
    }
    PapersOut {
        generated_at: now(),
        source: "Europe PMC REST API".to_string(),
        rule: "Open-access papers matching each field query, ranked by citation count. \
               'Recent' is limited to the last 24 months."
            .to_string(),
        fields: out,
    }
}

// ---------- source status ----------

fn probe(agent: &ureq::Agent, url: &str) -> (String, u16, u64) {
    let started = Instant::now();
    let code = match agent.head(url).call() {
        Ok(resp) => resp.status(),
        Err(ureq::Error::Status(code, _)) => code,
        Err(_) => 0,
    };
    // Some servers refuse HEAD. Try a normal GET once before deciding.
    let code = if code == 0 || code == 405 || code == 501 {
        match agent.get(url).call() {
            Ok(resp) => resp.status(),
            Err(ureq::Error::Status(c, _)) => c,
            Err(_) => 0,
        }
    } else {
        code
    };
    let ms = started.elapsed().as_millis() as u64;
    let state = match code {
        200..=399 => "ok",
        // The server answered but refuses automated clients. It is up.
        401 | 403 | 406 | 429 => "blocked",
        _ => "down",
    };
    (state.to_string(), code, ms)
}

fn build_status(defs: &[SourceDef], previous: Option<StatusOut>) -> StatusOut {
    let agent = agent(25);
    let mut old = previous.map(|p| p.sources).unwrap_or_default();
    let day = today();
    let mut sources = BTreeMap::new();
    for def in defs {
        let url = def.check.clone().unwrap_or_else(|| def.homepage.clone());
        let (state, code, ms) = probe(&agent, &url);
        println!("status: {:<22} {:<8} {} ({} ms)", def.id, state, code, ms);
        let mut history = old.remove(&def.id).map(|s| s.history).unwrap_or_default();
        history.retain(|h| h.d != day);
        history.push(DayState {
            d: day.clone(),
            s: state.clone(),
        });
        if history.len() > HISTORY_DAYS {
            let cut = history.len() - HISTORY_DAYS;
            history.drain(0..cut);
        }
        sources.insert(
            def.id.clone(),
            SourceStatus {
                state,
                code,
                ms,
                url,
                history,
            },
        );
        sleep(Duration::from_millis(150));
    }
    StatusOut {
        checked_at: now(),
        sources,
    }
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

    let sources_file: SourcesFile =
        toml::from_str(&fs::read_to_string(root.join("registry/sources.toml"))?)?;
    let fields_file: FieldsFile =
        toml::from_str(&fs::read_to_string(root.join("registry/fields.toml"))?)?;
    let data = root.join("site/data");
    fs::create_dir_all(&data)?;

    let sources = build_sources(&root, &sources_file.source, &fields_file.field)?;
    write_json(&data.join("sources.json"), &sources)?;
    let datasets = build_datasets(&root, &fields_file.category)?;
    write_json(&data.join("datasets.json"), &datasets)?;

    let mut counts = BTreeMap::new();
    counts.insert("sources".to_string(), sources.sources.len());
    counts.insert(
        "versions".to_string(),
        sources.sources.iter().map(|s| s.versions.len()).sum(),
    );
    counts.insert("datasets".to_string(), datasets.datasets.len());

    if offline {
        println!("offline: papers.json and status.json left unchanged");
    } else {
        let papers = build_papers(&fields_file.field, read_json(&data.join("papers.json")));
        counts.insert(
            "papers".to_string(),
            papers.fields.iter().map(|f| f.classics.len() + f.recent.len()).sum(),
        );
        write_json(&data.join("papers.json"), &papers)?;
        let status = build_status(&sources_file.source, read_json(&data.join("status.json")));
        write_json(&data.join("status.json"), &status)?;
    }

    let mut inputs = BTreeMap::new();
    for name in [
        "registry/sources.toml",
        "registry/fields.toml",
        "databases_versions.csv",
        "datasets.csv",
    ] {
        inputs.insert(name.to_string(), sha256_file(&root.join(name))?);
    }
    let build = BuildOut {
        generated_at: now(),
        engine: format!("atlas-engine {}", env!("CARGO_PKG_VERSION")),
        commit: env::var("GITHUB_SHA").unwrap_or_else(|_| "local".to_string()),
        mode: if offline { "offline" } else { "online" }.to_string(),
        inputs,
        counts,
    };
    write_json(&data.join("build.json"), &build)?;
    println!("done: wrote {}", data.display());
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}
