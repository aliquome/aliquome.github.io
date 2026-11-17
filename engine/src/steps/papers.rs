//! Most cited open-access papers per field (network).

use chrono::Utc;
use crate::domain::config::FieldDef;
use crate::domain::model::FieldPapers;
use crate::domain::model::Paper;
use crate::domain::model::PapersOut;
use crate::infra::europe_pmc::fetch_papers;
use crate::infra::files::now;
use crate::infra::files::today;
use crate::infra::net::http;
use crate::steps::mentions::Mention;
use regex::Regex;
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::thread::sleep;
use std::time::Duration;

pub(crate) fn tag_paper(p: &mut Paper, tasks: &[(String, Regex)], mentions: &[Mention]) {
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

pub(crate) fn build_papers(fields: &[FieldDef], mentions: &[Mention], previous: Option<PapersOut>) -> PapersOut {
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
