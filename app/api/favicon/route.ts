import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url') || '';

  let hostname = '';
  let origin = '';
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(withProto);
    hostname = parsed.hostname;
    origin = parsed.origin;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (!hostname) {
    return new NextResponse(null, { status: 400 });
  }

  const candidateUrls = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`,
    `${origin}/favicon.ico`,
  ];

  for (const target of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        next: { revalidate: 86400 },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/png';
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) {
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            },
          });
        }
      }
    } catch {
      // Try next favicon candidate
    }
  }

  return new NextResponse(null, { status: 404 });
}
