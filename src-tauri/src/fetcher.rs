use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_SIZE: usize = 10 * 1024 * 1024; // 10MB
const CACHE_TTL_SECS: i64 = 7 * 24 * 3600; // 7 天

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub url: String,
    pub content: String,
    pub fetched_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchResult {
    pub content: String,
    pub from_cache: bool,
    pub stale: bool,
}

/// GitHub blob URL 转 raw URL。
/// github.com/user/repo/blob/branch/path.md → raw.githubusercontent.com/user/repo/branch/path.md
pub fn github_to_raw(url: &str) -> String {
    url.replace("github.com/", "raw.githubusercontent.com/")
        .replace("/blob/", "/")
}

fn url_hash(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

fn cache_file_path(dir: &Path, url: &str) -> PathBuf {
    dir.join(format!("{}.json", url_hash(url)))
}

pub fn load_cache(dir: &Path, url: &str) -> Option<CacheEntry> {
    let path = cache_file_path(dir, url);
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
}

pub fn save_cache(dir: &Path, entry: &CacheEntry) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(entry).map_err(|e| e.to_string())?;
    fs::write(cache_file_path(dir, &entry.url), json).map_err(|e| e.to_string())?;
    Ok(())
}

/// 拉取 URL 内容。先返回缓存(若有),实拉存缓存。
pub fn fetch(url: &str, dir: &Path) -> Result<FetchResult, String> {
    if !url.starts_with("https://") {
        return Err("仅支持 https URL".to_string());
    }
    let raw_url = github_to_raw(url);

    // 先查缓存
    let now = chrono::Utc::now().timestamp();
    if let Some(cache) = load_cache(dir, &raw_url) {
        let stale = now - cache.fetched_at > CACHE_TTL_SECS;
        return Ok(FetchResult {
            content: cache.content,
            from_cache: true,
            stale,
        });
    }

    // 无缓存,实拉
    let content = fetch_fresh_internal(&raw_url)?;
    let entry = CacheEntry {
        url: raw_url.clone(),
        content: content.clone(),
        fetched_at: now,
    };
    let _ = save_cache(dir, &entry);

    Ok(FetchResult {
        content,
        from_cache: false,
        stale: false,
    })
}

/// 强制重新拉取(忽略缓存,用于 stale-while-revalidate 的后台刷新)。
pub fn fetch_fresh(url: &str, dir: &Path) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("仅支持 https URL".to_string());
    }
    let raw_url = github_to_raw(url);
    let content = fetch_fresh_internal(&raw_url)?;
    let entry = CacheEntry {
        url: raw_url.clone(),
        content: content.clone(),
        fetched_at: chrono::Utc::now().timestamp(),
    };
    let _ = save_cache(dir, &entry);
    Ok(content)
}

fn fetch_fresh_internal(raw_url: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(raw_url)
        .send()
        .map_err(|e| format!("请求失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let content = resp.text().map_err(|e| e.to_string())?;
    if content.len() > MAX_SIZE {
        return Err("文件过大(超 10MB)".to_string());
    }
    Ok(content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_blob_to_raw() {
        let raw = github_to_raw("https://github.com/user/repo/blob/main/README.md");
        assert_eq!(
            raw,
            "https://raw.githubusercontent.com/user/repo/main/README.md"
        );
    }

    #[test]
    fn non_github_url_unchanged() {
        let url = "https://example.com/doc.md";
        assert_eq!(github_to_raw(url), url);
    }

    #[test]
    fn url_hash_consistent() {
        assert_eq!(url_hash("https://a.com"), url_hash("https://a.com"));
        assert_ne!(url_hash("https://a.com"), url_hash("https://b.com"));
    }

    #[test]
    fn cache_roundtrip() {
        let dir = std::env::temp_dir().join(format!(
            "mdreader-cache-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let entry = CacheEntry {
            url: "https://example.com/a.md".into(),
            content: "# Hello".into(),
            fetched_at: 1000,
        };
        save_cache(&dir, &entry).unwrap();
        let loaded = load_cache(&dir, "https://example.com/a.md").unwrap();
        assert_eq!(loaded.content, "# Hello");
    }

    #[test]
    fn fetch_rejects_http() {
        let dir = std::env::temp_dir().join(format!(
            "mdreader-cache-test2-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let result = fetch("http://insecure.com", &dir);
        assert!(result.is_err());
    }
}
