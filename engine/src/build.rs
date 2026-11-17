//! The build: reads data/, runs each step, writes site/data/ and build.json.

use crate::domain::config::BoardsFile;
use crate::domain::config::FieldsFile;
use crate::domain::config::LatestConfig;
use crate::domain::config::LoadersFile;
use crate::domain::config::SourcesFile;
use crate::domain::model::BuildOut;
use crate::Res;
use crate::infra::files::now;
use crate::infra::files::read_json;
use crate::infra::files::sha256_file;
use crate::infra::files::write_json;
use crate::steps::benchmarks::build_benchmarks;
use crate::steps::boards::build_boards;
use crate::steps::datasets::build_datasets;
use crate::steps::latest::build_latest;
use crate::steps::loaders::attach_loaders;
use crate::steps::mentions::build_mentions;
use crate::steps::papers::build_papers;
use crate::steps::sources::build_sources;
use crate::steps::status::build_status;
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::Path;

/// Runs every step for the repository at `root`. With `offline`, only the
/// deterministic files are written and no network call is made.
pub(crate) fn run(root: &Path, offline: bool) -> Res<()> {
    let data_in = root.join("data");
    let sources_file: SourcesFile = toml::from_str(&fs::read_to_string(data_in.join("sources.toml"))?)?;
    let fields_file: FieldsFile = toml::from_str(&fs::read_to_string(data_in.join("fields.toml"))?)?;
    let boards_file: BoardsFile = toml::from_str(&fs::read_to_string(data_in.join("leaderboards.toml"))?)?;
    let out = root.join("site/data");
    fs::create_dir_all(&out)?;

    let loaders_file: LoadersFile = match fs::read_to_string(data_in.join("loaders.toml")) {
        Ok(text) => toml::from_str(&text)?,
        Err(_) => LoadersFile::default(),
    };
    let mut sources = build_sources(&root, &sources_file.source, &fields_file.field)?;
    let mut datasets = build_datasets(&root, &fields_file.category)?;
    attach_loaders(&loaders_file, &mut sources, &mut datasets);
    write_json(&out.join("sources.json"), &sources)?;
    write_json(&out.join("datasets.json"), &datasets)?;
    let benchmark_files = build_benchmarks(&root, &out)?;

    let mut counts = BTreeMap::new();
    counts.insert("sources".to_string(), sources.sources.len());
    counts.insert("versions".to_string(), sources.sources.iter().map(|s| s.versions.len()).sum());
    counts.insert("datasets".to_string(), datasets.datasets.len());
    counts.insert("benchmark_files".to_string(), benchmark_files);

    if offline {
        println!("offline: papers, leaderboards and status left unchanged");
    } else {
        let mentions = build_mentions(&sources_file.source, &datasets, &fields_file.mention_stoplist);
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
        "data/loaders.toml",
        "data/rankings.toml",
    ] {
        inputs.insert(name.to_string(), sha256_file(&root.join(name))?);
    }
    write_json(
        &out.join("build.json"),
        &BuildOut {
            generated_at: now(),
            engine: format!("aliquome-engine {}", env!("CARGO_PKG_VERSION")),
            commit: env::var("GITHUB_SHA").unwrap_or_else(|_| "local".to_string()),
            mode: if offline { "offline" } else { "online" }.to_string(),
            inputs,
            counts,
        },
    )?;
    println!("done: wrote {}", out.display());
    Ok(())
}
