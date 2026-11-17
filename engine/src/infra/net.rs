//! HTTP: one agent with a timeout and a polite user agent.

use std::env;
use std::time::Duration;

pub(crate) const USER_AGENT: &str = concat!(
    "atlas-engine/",
    env!("CARGO_PKG_VERSION"),
    " (bioinformatics data atlas; daily link and literature check)"
);

pub(crate) fn percent_encode(text: &str) -> String {
    let mut out = String::new();
    for b in text.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

pub(crate) fn http(seconds: u64) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(seconds))
        .user_agent(USER_AGENT)
        .build()
}
