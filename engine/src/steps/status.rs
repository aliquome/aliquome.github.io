//! Reachability of every source and of its current download link (network).

use crate::domain::config::SourceDef;
use crate::domain::model::DayState;
use crate::domain::model::LinkStatus;
use crate::domain::model::SourceStatus;
use crate::domain::model::SourcesOut;
use crate::domain::model::StatusOut;
use crate::infra::files::now;
use crate::infra::files::today;
use crate::infra::net::http;
use std::collections::BTreeMap;
use std::thread::sleep;
use std::time::Duration;
use std::time::Instant;

pub(crate) const HISTORY_DAYS: usize = 30;

pub(crate) fn probe(agent: &ureq::Agent, url: &str) -> (String, u16, u64) {
    let started = Instant::now();
    let first = match agent.head(url).call() {
        Ok(resp) => resp.status(),
        Err(ureq::Error::Status(code, _)) => code,
        Err(_) => 0,
    };
    // Some servers refuse HEAD. Try one ordinary GET before deciding.
    let code = if first == 0 || first == 405 || first == 501 {
        match agent.get(url).call() {
            Ok(resp) => resp.status(),
            Err(ureq::Error::Status(c, _)) => c,
            Err(_) => 0,
        }
    } else {
        first
    };
    let state = match code {
        200..=399 => "ok",
        // The server answered but refuses automated clients. It is up.
        401 | 403 | 406 | 429 => "blocked",
        _ => "down",
    };
    (state.to_string(), code, started.elapsed().as_millis() as u64)
}

pub(crate) fn build_status(defs: &[SourceDef], sources: &SourcesOut, previous: Option<StatusOut>) -> StatusOut {
    let agent = http(25);
    let mut old = previous.map(|p| p.sources).unwrap_or_default();
    let day = today();
    let mut out = BTreeMap::new();
    for def in defs {
        let url = def.check.clone().unwrap_or_else(|| def.homepage.clone());
        let (state, code, ms) = probe(&agent, &url);
        println!("status: {:<22} {:<8} {} ({} ms)", def.id, state, code, ms);
        let mut history = old.remove(&def.id).map(|s| s.history).unwrap_or_default();
        history.retain(|h| h.d != day);
        history.push(DayState { d: day.clone(), s: state.clone() });
        if history.len() > HISTORY_DAYS {
            let cut = history.len() - HISTORY_DAYS;
            history.drain(0..cut);
        }
        out.insert(def.id.clone(), SourceStatus { state, code, ms, url, history });
        sleep(Duration::from_millis(150));
    }

    // Check the download link of the current release of each source.
    let mut links = BTreeMap::new();
    for s in &sources.sources {
        let u = &s.latest_url;
        let checkable = (u.starts_with("https://") || u.starts_with("http://"))
            && !u.contains('{')
            && matches!(s.latest_url_type.as_str(), "file" | "directory" | "api");
        if !checkable {
            continue;
        }
        let (state, code, _) = probe(&agent, u);
        println!("link:   {:<22} {:<8} {}", s.id, state, code);
        links.insert(s.id.clone(), LinkStatus { url: u.clone(), state, code });
        sleep(Duration::from_millis(150));
    }
    StatusOut { checked_at: now(), sources: out, links }
}
