//! Library calls and official client commands (data/loaders.toml), attached to
//! the datasets and databases they fetch (deterministic).

use crate::domain::config::LoadersFile;
use crate::domain::model::{DatasetsOut, LoaderOut, SourcesOut};

/// Each loader names its targets as "ds:<dataset id>" or "db:<source id>".
/// Unknown targets are reported and skipped.
pub(crate) fn attach_loaders(file: &LoadersFile, sources: &mut SourcesOut, datasets: &mut DatasetsOut) {
    for def in &file.loader {
        let out_l = LoaderOut { label: def.label.clone(), docs: def.docs.clone(), code: def.code.trim().to_string() };
        for t in &def.targets {
            if let Some(id) = t.strip_prefix("ds:") {
                match datasets.datasets.iter_mut().find(|d| d.id == id) {
                    Some(d) => d.loaders.push(out_l.clone()),
                    None => eprintln!("loaders.toml: unknown dataset {}", id),
                }
            } else if let Some(id) = t.strip_prefix("db:") {
                match sources.sources.iter_mut().find(|s| s.id == id) {
                    Some(s) => s.loaders.push(out_l.clone()),
                    None => eprintln!("loaders.toml: unknown source {}", id),
                }
            }
        }
    }
}
