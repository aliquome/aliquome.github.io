//! Datasets and benchmarks (deterministic).

use crate::domain::config::CategoryDef;
use crate::domain::model::DatasetOut;
use crate::domain::model::DatasetsOut;
use crate::domain::model::LinkOut;
use crate::Res;
use crate::infra::files::get;
use crate::infra::files::read_csv;
use std::path::Path;

pub(crate) fn build_datasets(root: &Path, categories: &[CategoryDef]) -> Res<DatasetsOut> {
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
            loaders: Vec::new(),
        });
    }
    Ok(DatasetsOut { datasets })
}
