//! Results tables and approved ranking changes (deterministic).

use crate::Res;
use crate::infra::files::write_json;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

/// Results tables (data/benchmarks/*.json) are copied unchanged to
/// site/data/benchmarks/. Approved ranking changes (data/rankings.toml) are
/// written as site/data/rankings.json; the site applies them to the tables.
pub(crate) fn build_benchmarks(root: &Path, out: &Path) -> Res<usize> {
    let dir = root.join("data/benchmarks");
    let dest = out.join("benchmarks");
    fs::create_dir_all(&dest)?;
    let mut files: Vec<PathBuf> = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(&dir)? {
            let p = entry?.path();
            if p.extension().map_or(false, |x| x == "json") {
                files.push(p);
            }
        }
    }
    files.sort();
    for p in &files {
        if let Some(name) = p.file_name() {
            fs::copy(p, dest.join(name))?;
        }
    }
    let rankings: toml::Value = match fs::read_to_string(root.join("data/rankings.toml")) {
        Ok(text) => toml::from_str(&text)?,
        Err(_) => toml::Value::Table(Default::default()),
    };
    write_json(&out.join("rankings.json"), &rankings)?;
    Ok(files.len())
}
