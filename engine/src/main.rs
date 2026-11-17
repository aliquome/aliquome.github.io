//! pinomics: builds the JSON files that the static site reads.
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
//! Usage:  pinomics build [--root DIR] [--offline]
//! `--offline` makes no network call and leaves the network files untouched,
//! so the same inputs always produce byte-identical deterministic outputs.

mod build;
mod domain;
mod infra;
mod steps;

use std::error::Error;
use std::path::PathBuf;

/// The result type every fallible function of the engine returns.
pub(crate) type Res<T> = Result<T, Box<dyn Error>>;

/// Command line: `pinomics build [--root DIR] [--offline]`. Returns None for --help.
fn parse_args() -> Res<Option<(PathBuf, bool)>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
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
                println!("pinomics build [--root DIR] [--offline]");
                return Ok(None);
            }
            other if !other.starts_with('-') => command = other.to_string(),
            other => return Err(format!("unknown option: {}", other).into()),
        }
        i += 1;
    }
    if command != "build" {
        return Err(format!("unknown command: {}", command).into());
    }
    Ok(Some((root, offline)))
}

fn main() {
    let result = parse_args().and_then(|args| match args {
        Some((root, offline)) => build::run(&root, offline),
        None => Ok(()),
    });
    if let Err(e) = result {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}
