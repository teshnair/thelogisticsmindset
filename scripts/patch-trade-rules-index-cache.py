from pathlib import Path

p=Path('netlify/functions/trade-rules.mts')
s=p.read_text()

old="""let indexCache: { data: Chapter99Index; fetchedAt: number; url: string } | null = null;"""
new="""let indexCache: { data: Chapter99Index; fetchedAt: number; url: string; marker: string | null } | null = null;"""
if old not in s: raise SystemExit('indexCache type marker not found')
s=s.replace(old,new,1)

old="""async function getIndex(reqUrl: string) {
  const indexUrl = new URL(INDEX_PATH, reqUrl).toString();
  if (indexCache && indexCache.url===indexUrl && Date.now()-indexCache.fetchedAt<CACHE_MS) return indexCache.data;
  const res=await fetchWithTimeout(indexUrl,20000); if(!res.ok) throw new Error(`Chapter 99 index returned ${res.status}`);
  const data=await res.json() as Chapter99Index;
  if((data?.schemaVersion||0)<2 || !data?.codes || !data?.headings || !data?.htsRevision) throw new Error("Chapter 99 index is missing required legal metadata");
  indexCache={data,fetchedAt:Date.now(),url:indexUrl}; return data;
}"""
new="""async function getIndex(reqUrl: string) {
  const indexUrl = new URL(INDEX_PATH, reqUrl).toString();
  let marker: string | null = null;

  // The Chapter 99 index is a static deploy artifact while this function may
  // be reused across deploys. Validate the artifact marker before reusing a
  // warm in-memory copy so a weekly HTS refresh becomes effective immediately.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const head = await fetch(indexUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "TheLogisticsMindset-TradeRules/3.1 (+https://riteshnair.com)",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (head.ok) {
        marker = head.headers.get("etag") || head.headers.get("last-modified");
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {}

  if (indexCache && indexCache.url === indexUrl) {
    if (marker && indexCache.marker === marker) return indexCache.data;
    // If the host does not expose an ETag/Last-Modified marker, fail over to a
    // short cache only. Never preserve legal data for the old 30-minute window.
    if (!marker && Date.now() - indexCache.fetchedAt < 60_000) return indexCache.data;
  }

  const fetchUrl = new URL(indexUrl);
  fetchUrl.searchParams.set("_index_refresh", String(Date.now()));
  const res = await fetchWithTimeout(fetchUrl.toString(), 20000);
  if(!res.ok) throw new Error(`Chapter 99 index returned ${res.status}`);
  const data=await res.json() as Chapter99Index;
  if((data?.schemaVersion||0)<2 || !data?.codes || !data?.headings || !data?.htsRevision) throw new Error("Chapter 99 index is missing required legal metadata");
  const responseMarker = res.headers.get("etag") || res.headers.get("last-modified") || marker;
  indexCache={data,fetchedAt:Date.now(),url:indexUrl,marker:responseMarker}; return data;
}"""
if old not in s: raise SystemExit('getIndex marker not found')
s=s.replace(old,new,1)

p.write_text(s)
print('Trade-rules Chapter 99 cache validation patched.')
