//! Databases and their releases (deterministic).

use crate::domain::config::FieldDef;
use crate::domain::config::SourceDef;
use crate::domain::model::SourceOut;
use crate::domain::model::SourcesOut;
use crate::domain::model::VersionOut;
use crate::Res;
use crate::infra::files::get;
use crate::infra::files::read_csv;
use std::collections::BTreeMap;
use std::path::Path;

pub(crate) fn build_sources(root: &Path, defs: &[SourceDef], fields: &[FieldDef]) -> Res<SourcesOut> {
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
            loaders: Vec::new(),
        });
    }
    for id in by_id.keys() {
        eprintln!("warning: source '{}' has releases but no entry in data/sources.toml", id);
    }
    Ok(SourcesOut { fields: fields.to_vec(), sources })
}
