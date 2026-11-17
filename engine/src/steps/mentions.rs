//! Names of databases and datasets to look for in paper text.

use crate::domain::config::SourceDef;
use crate::domain::model::DatasetsOut;
use regex::Regex;

/// A name to look for in titles and abstracts, pointing at a source or dataset.
pub(crate) struct Mention {
    pub(crate) id: String,
    pub(crate) re: Regex,
}

pub(crate) fn mention_needles(name: &str) -> Vec<String> {
    let mut out = Vec::new();
    let head = name.split(" (").next().unwrap_or(name).trim();
    out.push(head.to_string());
    if let (Some(a), Some(b)) = (name.find('('), name.rfind(')')) {
        if b > a + 1 {
            out.push(name[a + 1..b].trim().to_string());
        }
    }
    out.retain(|n| n.chars().count() >= 3);
    out
}

pub(crate) fn build_mentions(sources: &[SourceDef], datasets: &DatasetsOut, stoplist: &[String]) -> Vec<Mention> {
    let mut items: Vec<(String, String)> = Vec::new();
    for s in sources {
        for n in mention_needles(&s.name) {
            items.push((format!("db:{}", s.id), n));
        }
        for a in &s.aliases {
            items.push((format!("db:{}", s.id), a.clone()));
        }
    }
    for d in &datasets.datasets {
        for n in mention_needles(&d.name) {
            if stoplist.iter().any(|s| s.eq_ignore_ascii_case(&n)) {
                continue;
            }
            items.push((format!("ds:{}", d.id), n));
        }
    }
    let mut out = Vec::new();
    for (id, needle) in items {
        // All-capital or mixed names with digits (QM9, ZINC, STRING) are
        // matched case-sensitively so ordinary words do not match.
        let strict = needle.chars().any(|c| c.is_ascii_digit())
            || needle.chars().filter(|c| c.is_alphabetic()).all(|c| c.is_uppercase());
        let pattern = format!(
            r"{}(?:^|[^\w]){}(?:[^\w]|$)",
            if strict { "" } else { "(?i)" },
            regex::escape(&needle)
        );
        if let Ok(re) = Regex::new(&pattern) {
            out.push(Mention { id, re });
        }
    }
    out
}
