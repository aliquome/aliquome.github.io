//! Published model comparison tables (network).

use crate::domain::config::BoardDef;
use crate::domain::model::BoardOut;
use crate::domain::model::BoardRow;
use crate::domain::model::BoardsOut;
use crate::Res;
use crate::infra::files::get;
use crate::infra::files::now;
use crate::infra::files::read_csv_text;
use crate::infra::net::http;
use regex::Regex;
use std::collections::BTreeMap;

pub(crate) fn parse_score(text: &str) -> Option<f64> {
    text.trim().parse::<f64>().ok().filter(|v| v.is_finite())
}

pub(crate) fn fetch_board(agent: &ureq::Agent, def: &BoardDef, anchor: &Regex) -> Res<BoardOut> {
    let body = agent.get(&def.url).call()?.into_string()?;
    let rows = read_csv_text(body.trim_start_matches('\u{feff}'))?;
    let columns: Vec<(String, String)> = def
        .columns
        .iter()
        .filter_map(|c| c.split_once('=').map(|(k, v)| (k.trim().to_string(), v.trim().to_string())))
        .collect();
    let mut out = Vec::new();
    for row in &rows {
        let model = get(row, &def.model);
        let score = match parse_score(&get(row, &def.metric)) {
            Some(s) if !model.is_empty() => s,
            _ => continue,
        };
        let reference = def.reference.as_ref().map(|r| get(row, r)).unwrap_or_default();
        let (paper, paper_url) = match anchor.captures(&reference) {
            Some(c) => (c[2].trim().to_string(), c[1].to_string()),
            None => (String::new(), String::new()),
        };
        out.push(BoardRow {
            rank: 0,
            model,
            kind: def.kind.as_ref().map(|k| get(row, k)).unwrap_or_default(),
            score,
            values: columns.iter().map(|(k, _)| parse_score(&get(row, k))).collect(),
            paper,
            paper_url,
        });
    }
    if out.is_empty() {
        return Err(format!("no rows with column '{}'", def.metric).into());
    }
    out.sort_by(|a, b| {
        let o = a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal);
        if def.higher { o.reverse() } else { o }
    });
    for (i, r) in out.iter_mut().enumerate() {
        r.rank = i + 1;
    }
    Ok(BoardOut {
        id: def.id.clone(),
        title: def.title.clone(),
        field: def.field.clone(),
        task: def.task.clone(),
        dataset: def.dataset.clone(),
        source: def.source.clone(),
        csv: def.url.clone(),
        metric_label: def.metric_label.clone(),
        higher: def.higher,
        columns: columns.into_iter().map(|(_, label)| label).collect(),
        fetched_at: now(),
        rows: out,
    })
}

pub(crate) fn build_boards(defs: &[BoardDef], previous: Option<BoardsOut>) -> BoardsOut {
    let agent = http(60);
    let anchor = Regex::new(r#"(?s)<a[^>]*href=['"]([^'"]+)['"][^>]*>(.*?)</a>"#).expect("static regex");
    let old: BTreeMap<String, BoardOut> = previous
        .map(|p| p.boards.into_iter().map(|b| (b.id.clone(), b)).collect())
        .unwrap_or_default();
    let mut boards = Vec::new();
    for def in defs {
        match fetch_board(&agent, def, &anchor) {
            Ok(b) => {
                println!("board: {:<40} {} rows", b.id, b.rows.len());
                boards.push(b);
            }
            Err(e) => {
                eprintln!("board: {} failed: {}", def.id, e);
                if let Some(b) = old.get(&def.id) {
                    boards.push(b.clone());
                }
            }
        }
    }
    BoardsOut { boards }
}
