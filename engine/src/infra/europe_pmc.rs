//! Europe PMC REST API: queries and the parsing of its records into papers.

use crate::domain::model::Paper;
use crate::Res;
use crate::infra::net::percent_encode;
use regex::Regex;
use serde_json::Value;

pub(crate) const EUROPE_PMC: &str = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

pub(crate) const PAPERS_PER_LIST: usize = 30;

pub(crate) fn text_of(v: &Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

/// Method name from titles such as "Foldseek: fast structure search" or
/// "Fast and accurate protein structure search with Foldseek."
pub(crate) fn method_from_title(title: &str) -> String {
    if let Some((head, _)) = title.split_once(':') {
        let head = head.trim();
        let words = head.split_whitespace().count();
        if (1..=4).contains(&words) && head.chars().count() <= 40 {
            return head.to_string();
        }
    }
    let tail = Regex::new(r"\b(?:with|using|by|via|in) ([A-Z][A-Za-z0-9-]{2,})\.?$").expect("static regex");
    tail.captures(title.trim()).map(|c| c[1].to_string()).unwrap_or_default()
}

pub(crate) fn fetch_papers(agent: &ureq::Agent, query: &str, tags: &Regex) -> Res<Vec<Paper>> {
    let url = format!(
        "{}?query={}&format=json&resultType=core&pageSize={}&sort={}",
        EUROPE_PMC,
        percent_encode(query),
        PAPERS_PER_LIST + 10,
        percent_encode("CITED desc")
    );
    let json: Value = serde_json::from_str(&agent.get(&url).call()?.into_string()?)?;
    let mut papers = Vec::new();
    for r in results_of(&json) {
        if let Some(p) = parse_record(&r, tags, true) {
            papers.push(p);
            if papers.len() == PAPERS_PER_LIST {
                break;
            }
        }
    }
    Ok(papers)
}

pub(crate) fn results_of(json: &Value) -> Vec<Value> {
    json.pointer("/resultList/result")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default()
}

/// Turns one Europe PMC "core" record into a Paper. With `need_abstract`,
/// records without an abstract are skipped; otherwise the abstract is kept
/// only when the record is open access or carries a Creative Commons licence.
/// Europe PMC sometimes sends markup as entities (`&lt;i&gt;`); decode them
/// so the tag filter can remove the markup.
pub(crate) fn unescape(text: &str) -> String {
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

pub(crate) fn parse_record(r: &Value, tags: &Regex, need_abstract: bool) -> Option<Paper> {
    let title = tags.replace_all(&unescape(&text_of(r, "title")), "").trim().to_string();
    let raw_abstract = unescape(&text_of(r, "abstractText"));
    let mut abstract_text = tags.replace_all(&raw_abstract, " ").split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() || (need_abstract && abstract_text.is_empty()) {
        return None;
    }
    let license = text_of(r, "license");
    let reusable = text_of(r, "isOpenAccess") == "Y" || license.to_lowercase().starts_with("cc");
    if need_abstract && !reusable {
        abstract_text.clear();
    }
    let source = text_of(r, "source");
    let id = text_of(r, "id");
    let journal = r
        .pointer("/journalInfo/journal/title")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| if source == "PPR" { "Preprint".to_string() } else { String::new() });
    let doi = text_of(r, "doi");
    let mut keywords: Vec<String> = r
        .pointer("/keywordList/keyword")
        .and_then(|k| k.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.trim().to_string())).collect())
        .unwrap_or_default();
    if let Some(mesh) = r.pointer("/meshHeadingList/meshHeading").and_then(|m| m.as_array()) {
        for m in mesh {
            if m.get("majorTopic_YN").and_then(|y| y.as_str()) == Some("Y") {
                if let Some(d) = m.get("descriptorName").and_then(|d| d.as_str()) {
                    keywords.push(d.to_string());
                }
            }
        }
    }
    keywords.dedup();
    let pdf = r
        .pointer("/fullTextUrlList/fullTextUrl")
        .and_then(|l| l.as_array())
        .and_then(|l| {
            l.iter().find(|u| {
                u.get("documentStyle").and_then(|s| s.as_str()) == Some("pdf")
                    && u.get("availabilityCode").and_then(|s| s.as_str()) == Some("OA")
            })
        })
        .and_then(|u| u.get("url").and_then(|s| s.as_str()))
        .unwrap_or("")
        .to_string();
    Some(Paper {
        id: format!("{}:{}", source, id),
        method: method_from_title(&title),
        title,
        authors: text_of(r, "authorString"),
        journal,
        year: text_of(r, "pubYear"),
        date: text_of(r, "firstPublicationDate"),
        url: if doi.is_empty() {
            format!("https://europepmc.org/article/{}/{}", source, id)
        } else {
            format!("https://doi.org/{}", doi)
        },
        doi,
        cited: r.get("citedByCount").and_then(|c| c.as_u64()).unwrap_or(0),
        license,
        pdf,
        keywords,
        tasks: Vec::new(),
        datasets: Vec::new(),
        lists: Vec::new(),
        fields: Vec::new(),
        reusable,
        abstract_text,
    })
}
