//! New papers from the leading journals (network).

use chrono::Utc;
use crate::domain::config::FieldDef;
use crate::domain::config::LatestConfig;
use crate::domain::model::LatestOut;
use crate::domain::model::Paper;
use crate::infra::europe_pmc::EUROPE_PMC;
use crate::infra::europe_pmc::parse_record;
use crate::infra::europe_pmc::results_of;
use crate::infra::europe_pmc::text_of;
use crate::infra::files::now;
use crate::infra::files::today;
use crate::infra::net::http;
use crate::infra::net::percent_encode;
use crate::steps::mentions::Mention;
use regex::Regex;
use serde_json::Value;
use std::collections::BTreeSet;
use std::thread::sleep;
use std::time::Duration;

pub(crate) fn journal_clause(names: &[String]) -> String {
    let parts: Vec<String> = names.iter().map(|j| format!("JOURNAL:\"{}\"", j)).collect();
    format!("({})", parts.join(" OR "))
}

/// Fields whose pattern matches at least twice, strongest first, at most
/// three. A paper with only single matches keeps its single best field.
pub(crate) fn pick_fields(matchers: &[(String, Regex)], text: &str) -> Vec<String> {
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

pub(crate) fn build_latest(
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
