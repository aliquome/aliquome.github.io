//! Files on disk: CSV, JSON, hashes, timestamps.

use chrono::SecondsFormat;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use sha2::Digest;
use sha2::Sha256;
use crate::Res;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub(crate) fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub(crate) fn today() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

pub(crate) fn sha256_file(path: &Path) -> Res<String> {
    let digest = Sha256::digest(fs::read(path)?);
    Ok(digest.iter().map(|b| format!("{:02x}", b)).collect())
}

/// Reads a CSV file (with or without a UTF-8 BOM) into maps keyed by header.
pub(crate) fn read_csv(path: &Path) -> Res<Vec<BTreeMap<String, String>>> {
    let text = fs::read_to_string(path)?;
    read_csv_text(text.trim_start_matches('\u{feff}'))
}

pub(crate) fn read_csv_text(text: &str) -> Res<Vec<BTreeMap<String, String>>> {
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

pub(crate) fn get(row: &BTreeMap<String, String>, key: &str) -> String {
    row.get(key).cloned().unwrap_or_default()
}

pub(crate) fn write_json<T: Serialize>(path: &Path, value: &T) -> Res<()> {
    let mut text = serde_json::to_string_pretty(value)?;
    text.push('\n');
    fs::write(path, text)?;
    Ok(())
}

pub(crate) fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}
