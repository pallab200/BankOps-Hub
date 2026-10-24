const UCB_LOGO_BASE64 = "data:image/png;base64,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";

/**
 * BankOps Hub — Quick File Share Worker
 * Ephemeral 30-Minute File Transfer powered by Cloudflare KV
 * 100% Free Tier Architecture ($0.00)
 * Native 30-Minute Auto-Purge (expirationTtl: 1800)
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS Headers for cross-origin requests from BankOps Hub
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400"
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            // API: Upload File
            if (path === "/api/upload" && request.method === "POST") {
                return await handleUpload(request, env, corsHeaders);
            }

            // API: Check File Metadata by 4-digit code
            if (path.startsWith("/api/info/") && request.method === "GET") {
                const code = path.split("/api/info/")[1]?.trim();
                return await handleInfo(code, env, corsHeaders);
            }

            // API: Download File by 4-digit code
            if (path.startsWith("/api/download/") && request.method === "GET") {
                const code = path.split("/api/download/")[1]?.trim();
                return await handleDownload(code, env, ctx, corsHeaders);
            }

            // API: Manual Early Delete
            if (path.startsWith("/api/delete/") && request.method === "DELETE") {
                const code = path.split("/api/delete/")[1]?.trim();
                return await handleDelete(code, env, corsHeaders);
            }

            // Web Portal: Serve Standalone UI
            if (path === "/" || path === "/index.html") {
                return handleWebPortal(url);
            }

            return new Response("Not Found", { status: 404, headers: corsHeaders });
        } catch (err) {
            console.error("Worker error:", err);
            return new Response(JSON.stringify({ success: false, error: err.message || "Internal Server Error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    },

    // Scheduled Cron Trigger: Runs every 10 mins to clean up any expired entries
    async scheduled(event, env, ctx) {
        // Cloudflare KV automatically cleans up keys with expirationTtl: 1800
    }
};

/**
 * Handle File Upload
 */
async function handleUpload(request, env, corsHeaders) {
    let fileName = "file";
    let mimeType = "application/octet-stream";
    let fileSize = 0;
    let arrayBuffer = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
            return jsonResponse({ success: false, error: "No file provided in form-data" }, 400, corsHeaders);
        }
        fileName = file.name || "document";
        mimeType = file.type || "application/octet-stream";
        fileSize = file.size;
        arrayBuffer = await file.arrayBuffer();
    } else {
        fileName = decodeURIComponent(request.headers.get("X-File-Name") || "document");
        mimeType = request.headers.get("X-Mime-Type") || "application/octet-stream";
        fileSize = parseInt(request.headers.get("X-File-Size") || "0", 10);
        arrayBuffer = await request.arrayBuffer();
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return jsonResponse({ success: false, error: "Empty file body received" }, 400, corsHeaders);
    }

    fileSize = arrayBuffer.byteLength;

    // Generate a unique 4-digit code (1000 - 9999)
    let code = "";
    let attempts = 0;
    while (attempts < 10) {
        const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
        const existing = await env.METADATA.get("code:" + randomCode);
        if (!existing) {
            code = randomCode;
            break;
        }
        attempts++;
    }

    if (!code) {
        code = (Date.now() % 9000 + 1000).toString();
    }

    const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, "_");
    const now = Date.now();
    const ttlSeconds = 1800; // 30 minutes
    const expiresAt = now + ttlSeconds * 1000;

    // Store in KV (chunks of 20MB if large)
    const chunkSize = 20 * 1024 * 1024;
    const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize) || 1;

    for (let i = 0; i < totalChunks; i++) {
        const chunk = arrayBuffer.slice(i * chunkSize, (i + 1) * chunkSize);
        await env.FILES.put(`file:${code}:${i}`, chunk, { expirationTtl: ttlSeconds });
    }

    // Save metadata in METADATA KV
    const metadata = {
        code,
        fileName: safeFileName,
        fileSize,
        mimeType,
        totalChunks,
        uploadedAt: now,
        expiresAt: expiresAt
    };

    await env.METADATA.put("code:" + code, JSON.stringify(metadata), {
        expirationTtl: ttlSeconds
    });

    return jsonResponse({
        success: true,
        code,
        fileName: safeFileName,
        fileSize,
        mimeType,
        uploadedAt: now,
        expiresAt,
        ttlSeconds
    }, 200, corsHeaders);
}

/**
 * Handle File Metadata Check
 */
async function handleInfo(code, env, corsHeaders) {
    if (!code || !/^\d{4}$/.test(code)) {
        return jsonResponse({ success: false, error: "Invalid 4-digit code" }, 400, corsHeaders);
    }

    const data = await env.METADATA.get("code:" + code);
    if (!data) {
        return jsonResponse({ success: false, error: "File not found or expired after 30 minutes" }, 404, corsHeaders);
    }

    const meta = JSON.parse(data);
    const now = Date.now();
    if (now >= meta.expiresAt) {
        // Purge immediately
        for (let i = 0; i < (meta.totalChunks || 1); i++) {
            await env.FILES.delete(`file:${code}:${i}`);
        }
        await env.METADATA.delete("code:" + code);
        return jsonResponse({ success: false, error: "File validity expired after 30 minutes" }, 410, corsHeaders);
    }

    const expiresInSeconds = Math.max(0, Math.round((meta.expiresAt - now) / 1000));

    return jsonResponse({
        success: true,
        code: meta.code,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        mimeType: meta.mimeType,
        uploadedAt: meta.uploadedAt,
        expiresAt: meta.expiresAt,
        expiresInSeconds
    }, 200, corsHeaders);
}

/**
 * Handle File Download
 */
async function handleDownload(code, env, ctx, corsHeaders) {
    if (!code || !/^\d{4}$/.test(code)) {
        return new Response("Invalid 4-digit code", { status: 400, headers: corsHeaders });
    }

    const data = await env.METADATA.get("code:" + code);
    if (!data) {
        return new Response("File not found or expired after 30 minutes.", { status: 404, headers: corsHeaders });
    }

    const meta = JSON.parse(data);
    const now = Date.now();
    if (now >= meta.expiresAt) {
        for (let i = 0; i < (meta.totalChunks || 1); i++) {
            await env.FILES.delete(`file:${code}:${i}`);
        }
        await env.METADATA.delete("code:" + code);
        return new Response("File has expired and was permanently deleted.", { status: 410, headers: corsHeaders });
    }

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", meta.mimeType || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(meta.fileName)}"; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`);
    if (meta.fileSize && meta.fileSize > 0) {
        headers.set("Content-Length", String(meta.fileSize));
    }
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("X-Content-Type-Options", "nosniff");

    const totalChunks = meta.totalChunks || 1;
    if (totalChunks === 1) {
        const fileData = await env.FILES.get(`file:${code}:0`, { type: "arrayBuffer" });
        if (!fileData) {
            return new Response("File chunk missing or expired.", { status: 404, headers: corsHeaders });
        }
        return new Response(fileData, { headers });
    }

    // Stream multi-chunk files
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    ctx.waitUntil((async () => {
        try {
            for (let i = 0; i < totalChunks; i++) {
                const chunk = await env.FILES.get(`file:${code}:${i}`, { type: "arrayBuffer" });
                if (chunk) {
                    await writer.write(new Uint8Array(chunk));
                }
            }
        } finally {
            await writer.close();
        }
    })());

    return new Response(readable, { headers });
}

/**
 * Handle Manual Delete
 */
async function handleDelete(code, env, corsHeaders) {
    if (!code || !/^\d{4}$/.test(code)) {
        return jsonResponse({ success: false, error: "Invalid code" }, 400, corsHeaders);
    }

    const data = await env.METADATA.get("code:" + code);
    if (data) {
        const meta = JSON.parse(data);
        for (let i = 0; i < (meta.totalChunks || 1); i++) {
            await env.FILES.delete(`file:${code}:${i}`);
        }
        await env.METADATA.delete("code:" + code);
    }

    return jsonResponse({ success: true, message: "File successfully deleted from server" }, 200, corsHeaders);
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...extraHeaders
        }
    });
}

/**
 * Standalone Web Portal HTML (English, Clean UI)
 */
function handleWebPortal(url) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>BranchEase Quick File Share · United Commercial Bank PLC</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,300..800;1,300..800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            /* Official United Commercial Bank (UCB) Design System */
            --primary: #ed1b24;               /* UCB Signature Red */
            --primary-dark: #c00000;          /* Deep Crimson Accent */
            --primary-light: #ff4d55;         /* Vibrant Highlight */
            --primary-rgb: 237, 27, 36;
            --primary-glow: rgba(237, 27, 36, 0.28);
            --primary-gradient: linear-gradient(135deg, #ed1b24 0%, #c00000 50%, #900000 100%);
            --accent: #ed1b24;
            --accent-hover: #c00000;
            --accent-glow: rgba(237, 27, 36, 0.35);
            --gold: #d4af37;                  /* UCB Gold Accent */
            --gold-glow: rgba(212, 175, 55, 0.25);
            --bg-page: #0f1115;
            --bg-card: #181920;
            --bg-surface: #20232a;
            --border: #2d3139;
            --border-light: rgba(237, 27, 36, 0.2);
            --text-main: #f8fafc;
            --text-muted: #9ba3af;
            --danger: #ef4444;
            --success: #10b981;
            --warning: #f59e0b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Exo 2', 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body {
            background: radial-gradient(circle at 50% 0%, #291216 0%, #181920 40%, #0c0d10 100%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }
        .container {
            width: 100%;
            max-width: 480px;
            max-height: min(94vh, 700px);
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 35px var(--primary-glow);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #ed1b24, #d4af37, #ed1b24);
            z-index: 10;
        }
        .header {
            flex-shrink: 0;
            padding: 22px 20px 16px;
            text-align: center;
            background: linear-gradient(180deg, rgba(237, 27, 36, 0.08) 0%, rgba(24, 25, 32, 0.95) 100%);
            border-bottom: 1px solid var(--border);
        }
        /* ============ ANIMATED UCB LOGO (Header) ============ */
        .ucb-logo-anim {
            position: relative;
            height: 48px;
            width: auto;
            display: inline-flex;
            align-items: center;
            aspect-ratio: 1024 / 486;
            overflow: visible;
            transform-origin: center center;
            animation: ucbIntro 2.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
            flex-shrink: 0;
            cursor: pointer;
        }
        .ucb-logo-anim .ucb-logo-img {
            height: 100%;
            width: 100%;
            object-fit: contain;
            display: block;
            filter: brightness(0.35) contrast(1.05) saturate(1);
            animation: ucbIllumine 2.6s ease-out 0.2s both, ucbEmberPulse 3.6s ease-in-out 2.8s infinite;
        }
        .ucb-logo-anim .ucb-sweep {
            position: absolute;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
            border-radius: 6px;
        }
        .ucb-logo-anim .ucb-sweep::before {
            content: '';
            position: absolute;
            top: -20%;
            left: -60%;
            width: 40%;
            height: 140%;
            transform: skewX(-18deg);
            background: linear-gradient(90deg,
                rgba(255,255,255,0) 0%,
                rgba(255,235,235,0.15) 35%,
                rgba(255,255,255,0.85) 50%,
                rgba(255,90,90,0.35) 62%,
                rgba(255,255,255,0) 100%);
            filter: blur(2px);
            opacity: 0;
            animation: ucbSweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) 1.9s 1 both;
        }
        .ucb-logo-anim .ucb-beam {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: visible;
        }
        .ucb-logo-anim .ucb-beam path {
            fill: none;
            stroke: url(#ucbBeamGrad);
            stroke-width: 7;
            stroke-linecap: round;
            filter: drop-shadow(0 0 5px rgba(255,40,40,0.9)) drop-shadow(0 0 12px rgba(255,0,0,0.6));
            stroke-dasharray: 1400;
            stroke-dashoffset: 1400;
            opacity: 0;
            animation: ucbBeamDraw 1.5s cubic-bezier(0.5, 0, 0.2, 1) 0.7s both, ucbBeamFade 0.8s ease-out 2.1s both;
        }
        .ucb-logo-anim .ucb-beam circle {
            fill: #fff;
            filter: drop-shadow(0 0 6px #ff3b3b) drop-shadow(0 0 14px #ff0000);
            opacity: 0;
            animation: ucbSparkHead 1.5s cubic-bezier(0.5, 0, 0.2, 1) 0.7s both;
        }
        .ucb-logo-anim .ucb-particles {
            position: absolute;
            inset: -10% -6%;
            pointer-events: none;
            overflow: visible;
        }
        .ucb-logo-anim .ucb-particles i {
            position: absolute;
            width: 3px; height: 3px;
            border-radius: 50%;
            background: radial-gradient(circle, #fff 0%, #ff6a6a 55%, rgba(255,0,0,0) 100%);
            opacity: 0;
            box-shadow: 0 0 6px rgba(255,60,60,0.9);
            animation: ucbFloat 4.2s ease-in-out infinite;
        }
        .ucb-logo-anim .ucb-particles i:nth-child(1) { left: 8%;  top: 70%; animation-delay: 1.6s; }
        .ucb-logo-anim .ucb-particles i:nth-child(2) { left: 24%; top: 82%; animation-delay: 2.2s; width:2px;height:2px; }
        .ucb-logo-anim .ucb-particles i:nth-child(3) { left: 46%; top: 88%; animation-delay: 1.9s; }
        .ucb-logo-anim .ucb-particles i:nth-child(4) { left: 63%; top: 30%; animation-delay: 2.6s; width:2px;height:2px; }
        .ucb-logo-anim .ucb-particles i:nth-child(5) { left: 82%; top: 20%; animation-delay: 2.0s; }
        .ucb-logo-anim .ucb-particles i:nth-child(6) { left: 90%; top: 60%; animation-delay: 2.9s; width:2px;height:2px; }
        .ucb-logo-anim .ucb-glow {
            position: absolute;
            right: 6%;
            top: 50%;
            width: 42%;
            height: 120%;
            transform: translateY(-50%);
            pointer-events: none;
            background: radial-gradient(ellipse at center, rgba(255,30,30,0.35) 0%, rgba(255,0,0,0) 70%);
            filter: blur(6px);
            opacity: 0;
            animation: ucbGlowIn 1.4s ease-out 1.6s both, ucbGlowPulse 3.6s ease-in-out 3s infinite;
        }
        @keyframes ucbIntro {
            0%   { opacity: 0; transform: scale(0.86) translateZ(0); filter: blur(3px); }
            55%  { opacity: 1; filter: blur(0); }
            100% { opacity: 1; transform: scale(1) translateZ(0); filter: blur(0); }
        }
        @keyframes ucbIllumine {
            0%   { filter: brightness(0.30) contrast(1.05) saturate(0.9); }
            60%  { filter: brightness(1.18) contrast(1.12) saturate(1.12); }
            100% { filter: brightness(1) contrast(1.05) saturate(1.04); }
        }
        @keyframes ucbEmberPulse {
            0%, 100% { filter: brightness(1) contrast(1.05) saturate(1.04); }
            50%      { filter: brightness(1.06) contrast(1.07) saturate(1.09); }
        }
        @keyframes ucbSweep {
            0%   { left: -60%; opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 1; }
            100% { left: 130%; opacity: 0; }
        }
        @keyframes ucbBeamDraw {
            0%   { stroke-dashoffset: 1400; opacity: 0; }
            8%   { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ucbBeamFade {
            0%   { opacity: 1; }
            100% { opacity: 0; }
        }
        @keyframes ucbSparkHead {
            0%   { opacity: 0; offset-distance: 0%; }
            8%   { opacity: 1; }
            92%  { opacity: 1; }
            100% { opacity: 0; offset-distance: 100%; }
        }
        @keyframes ucbGlowIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ucbGlowPulse {
            0%, 100% { opacity: 0.55; transform: translateY(-50%) scale(1); }
            50%      { opacity: 0.9;  transform: translateY(-50%) scale(1.04); }
        }
        @keyframes ucbFloat {
            0%   { opacity: 0; transform: translate(0, 6px) scale(0.6); }
            20%  { opacity: 1; }
            60%  { opacity: 0.8; }
            100% { opacity: 0; transform: translate(-6px, -14px) scale(1); }
        }
        .hub-brand-group .ucb-logo-anim.ucb-fallback { display: none !important; }
        .hub-brand-group .ucb-logo-anim.ucb-fallback ~ .hub-logo-box { display: flex !important; }

        .hub-brand-titles h1 {
            font-family: 'Exo 2', sans-serif !important;
            letter-spacing: -0.01em;
            background: linear-gradient(100deg, #ffffff 0%, #ffffff 40%, #ff858a 48%, #ffffff 54%, #ffffff 100%);
            background-size: 200% 100%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: ucbTextShine 7s ease-in-out infinite 2.5s;
        }
        @keyframes ucbTextShine {
            0%, 70% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        @media (max-width: 768px) {
            .ucb-logo-anim { height: 38px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .ucb-logo-anim,
            .ucb-logo-anim .ucb-logo-img { animation: none !important; }
            .ucb-logo-anim .ucb-logo-img { filter: none !important; }
            .ucb-logo-anim .ucb-sweep::before,
            .ucb-logo-anim .ucb-beam path,
            .ucb-logo-anim .ucb-beam circle,
            .ucb-logo-anim .ucb-particles i,
            .ucb-logo-anim .ucb-glow { animation: none !important; opacity: 0 !important; }
            .ucb-logo-anim .ucb-logo-img { opacity: 1 !important; }
        }

    
        .ucb-logo-anim-wrapper { display: flex; justify-content: center; align-items: center; margin-bottom: 12px; }
        .hub-brand-titles { text-align: center; margin-bottom: 8px; }
        .hub-brand-titles .brand-h1 { font-family: "Exo 2", sans-serif !important; font-size: 24px; font-weight: 800; letter-spacing: -0.01em; background: linear-gradient(100deg, #ffffff 0%, #ffffff 40%, #ff858a 48%, #ffffff 54%, #ffffff 100%); background-size: 200% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: ucbTextShine 7s ease-in-out infinite 2.5s; margin-bottom: 2px; }
        .hub-brand-titles .brand-sub { font-size: 12.5px; color: var(--text-muted); letter-spacing: 0.02em; }
        .tab-btn {
            flex: 1;
            padding: 13px 14px;
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: 13.5px;
            font-weight: 700;
            letter-spacing: 0.01em;
            cursor: pointer;
            transition: all 0.25s ease;
            border-bottom: 2px solid transparent;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .tab-btn:hover {
            color: #ffffff;
            background: rgba(237, 27, 36, 0.04);
        }
        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
            background: rgba(237, 27, 36, 0.08);
            font-weight: 800;
        }
        .content { flex: 1 1 auto; overflow-y: auto; padding: 20px 22px; }
        .content::-webkit-scrollbar { width: 5px; }
        .content::-webkit-scrollbar-thumb { background: #2d3139; border-radius: 10px; }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        
        .dropzone {
            border: 2px dashed rgba(237, 27, 36, 0.35);
            border-radius: 16px;
            padding: 34px 18px;
            text-align: center;
            cursor: pointer;
            transition: all 0.25s ease;
            background: rgba(237, 27, 36, 0.03);
        }
        .dropzone:hover, .dropzone.dragover {
            border-color: var(--primary);
            background: rgba(237, 27, 36, 0.08);
            transform: translateY(-1px);
            box-shadow: 0 8px 24px var(--primary-glow);
        }
        .dropzone svg {
            width: 46px;
            height: 46px;
            color: var(--primary);
            margin-bottom: 12px;
            filter: drop-shadow(0 4px 10px var(--primary-glow));
            transition: transform 0.25s ease;
        }
        .dropzone:hover svg {
            transform: translateY(-2px) scale(1.05);
        }
        .dropzone p { font-size: 14.5px; font-weight: 700; margin-bottom: 5px; color: #ffffff; }
        .dropzone span { font-size: 12px; color: var(--text-muted); line-height: 1.4; display: block; }
        
        .code-inputs {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin: 22px 0;
        }
        .code-digit {
            width: 58px;
            height: 66px;
            font-size: 30px;
            font-weight: 800;
            text-align: center;
            background: var(--bg-surface);
            border: 2px solid var(--border);
            border-radius: 14px;
            color: #ffffff;
            outline: none;
            transition: all 0.25s ease;
            font-family: 'Exo 2', monospace;
        }
        .code-digit:focus {
            border-color: var(--primary);
            box-shadow: 0 0 16px var(--primary-glow);
            background: #252833;
            transform: translateY(-2px);
        }
        
        .btn {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            font-size: 14.5px;
            font-weight: 700;
            letter-spacing: 0.02em;
            border: none;
            cursor: pointer;
            transition: all 0.22s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .btn-primary {
            background: var(--primary-gradient);
            color: white;
            box-shadow: 0 6px 20px var(--primary-glow);
        }
        .btn-primary:hover {
            opacity: 0.95;
            transform: translateY(-1.5px);
            box-shadow: 0 8px 25px rgba(237, 27, 36, 0.45);
        }
        .btn-primary:active {
            transform: translateY(0);
        }
        .btn-danger {
            background: rgba(239, 68, 68, 0.12);
            color: #ff6b72;
            border: 1px solid rgba(239, 68, 68, 0.3);
            margin-top: 10px;
        }
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.22);
            color: #ffffff;
        }
        
        .result-box {
            text-align: center;
            padding: 22px 18px;
            background: var(--bg-surface);
            border-radius: 16px;
            border: 1px solid rgba(237, 27, 36, 0.25);
            margin-bottom: 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .code-display {
            font-size: 44px;
            font-weight: 800;
            letter-spacing: 10px;
            color: #ffffff;
            margin: 12px 0;
            font-family: 'Exo 2', monospace;
            text-shadow: 0 0 24px var(--primary-glow);
        }
        .timer {
            font-size: 13px;
            color: var(--gold);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-weight: 700;
            margin-top: 8px;
            letter-spacing: 0.02em;
        }
        .progress-bar {
            width: 100%;
            height: 9px;
            background: var(--bg-surface);
            border-radius: 6px;
            overflow: hidden;
            margin: 18px 0 10px;
            border: 1px solid var(--border);
        }
        .progress-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #c00000 0%, #ed1b24 50%, #d4af37 100%);
            transition: width 0.2s ease;
            box-shadow: 0 0 12px var(--primary-glow);
        }
        .file-info-card {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .file-info-icon { font-size: 32px; }
        .file-info-details { flex: 1; min-width: 0; }
        .file-info-name {
            font-weight: 700;
            font-size: 14.5px;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .file-info-meta { font-size: 12px; color: var(--text-muted); margin-top: 3px; font-weight: 500; }
        .qr-wrapper {
            margin: 16px auto;
            padding: 12px;
            background: white;
            border-radius: 14px;
            display: inline-block;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            border: 2px solid var(--gold);
        }
        .qr-wrapper img { display: block; width: 140px; height: 140px; }
        
        .footer-note {
            padding: 10px 16px;
            text-align: center;
            font-size: 11px;
            color: #717886;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            background: rgba(10, 11, 14, 0.6);
        }
        .footer-note a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
        }
        .footer-note a:hover {
            text-decoration: underline;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- Animated UCB Logo with Cinematic Beam, Particles & Glow -->
            <div class="ucb-logo-anim-wrapper">
                <div class="ucb-logo-anim" aria-label="United Commercial Bank PLC">
                    <div class="ucb-glow"></div>
                    <img class="ucb-logo-img" src="${UCB_LOGO_BASE64}" alt="UCB">
                    <div class="ucb-particles"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                    <svg class="ucb-beam" viewBox="0 0 1024 486" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                        <defs>
                            <linearGradient id="ucbBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#ff2b2b" stop-opacity="0"/>
                                <stop offset="30%" stop-color="#ff2b2b" stop-opacity="0.9"/>
                                <stop offset="60%" stop-color="#ff5a5a" stop-opacity="1"/>
                                <stop offset="100%" stop-color="#ffffff" stop-opacity="0.95"/>
                            </linearGradient>
                        </defs>
                        <path d="M40 372 C 190 470, 470 470, 640 392 C 800 320, 900 250, 985 150"/>
                        <circle r="4" style="offset-path: path('M40 372 C 190 470, 470 470, 640 392 C 800 320, 900 250, 985 150');"></circle>
                    </svg>
                    <div class="ucb-sweep"></div>
                </div>
            </div>
            <div class="hub-brand-titles">
                <h1 class="brand-h1">BranchEase</h1>
                <p class="brand-sub">Quick File Share &middot; United Commercial Bank PLC</p>
            </div>
            <div class="badge">⏱️ Ephemeral &middot; Auto-purged after 30 minutes</div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('send')">📤 Send File</button>
            <button class="tab-btn" onclick="switchTab('receive')">📥 Receive File</button>
        </div>

        <div class="content">
            <!-- SEND PANEL -->
            <div id="sendPanel" class="tab-panel active">
                <div id="dropzoneView">
                    <div class="dropzone" id="dropzone" onclick="document.getElementById('fileInput').click()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p>Click to choose file(s) or drag & drop here</p>
                        <span>Single or multiple files (Auto-zipped into 1 code) • All formats supported</span>
                    </div>
                    <input type="file" id="fileInput" style="display: none;" multiple onchange="handleFileSelect(this.files)">
                </div>

                <div id="uploadProgressView" style="display: none; text-align: center; padding: 20px 0;">
                    <p id="uploadingFileName" style="font-weight: 600; margin-bottom: 6px;">Uploading...</p>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <span id="uploadProgressText" style="font-size: 12px; color: var(--text-muted);">0%</span>
                </div>

                <div id="sendResultView" style="display: none;">
                    <div class="result-box">
                        <span style="font-size: 12px; color: var(--text-muted);">Your 4-Digit File Code:</span>
                        <div class="code-display" id="generatedCode">----</div>
                        <div class="timer">
                            <span>⏳</span>
                            <span id="sendCountdown">29:59 remaining</span>
                        </div>
                        <div class="qr-wrapper">
                            <img id="qrCodeImg" alt="QR Code" src="">
                        </div>
                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Scan with phone camera to start instant file download</p>
                    </div>

                    <button class="btn btn-primary" onclick="copyCode()">📋 Copy 4-Digit Code</button>
                    <button class="btn btn-danger" onclick="deleteCurrentFile()">🗑️ Delete File Now</button>
                    <button class="btn" style="background: transparent; color: var(--text-muted); margin-top: 8px;" onclick="resetSendView()">🔄 Send Another File</button>
                </div>
            </div>

            <!-- RECEIVE PANEL -->
            <div id="receivePanel" class="tab-panel">
                <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Enter 4-digit code provided by sender:</p>
                <div class="code-inputs">
                    <input type="text" maxlength="1" class="code-digit" id="d1" inputmode="numeric" autofocus>
                    <input type="text" maxlength="1" class="code-digit" id="d2" inputmode="numeric">
                    <input type="text" maxlength="1" class="code-digit" id="d3" inputmode="numeric">
                    <input type="text" maxlength="1" class="code-digit" id="d4" inputmode="numeric">
                </div>

                <button class="btn btn-primary" id="fetchBtn" onclick="fetchFileByCode()">🔍 Fetch File</button>

                <div id="receiveResultView" style="display: none; margin-top: 20px;">
                    <div class="file-info-card">
                        <div class="file-info-icon">📄</div>
                        <div class="file-info-details">
                            <div class="file-info-name" id="recFileName">document.pdf</div>
                            <div class="file-info-meta" id="recFileMeta">1.4 MB • 24 mins remaining</div>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="downloadFile()">⬇️ Download File</button>
                </div>
                <div id="receiveError" style="display:none; color: var(--danger); font-size: 13px; text-align: center; margin-top: 14px;"></div>
            </div>
        </div>
    </div>

    <script>
        let currentCode = "";
        let countdownTimer = null;

        window.addEventListener('DOMContentLoaded', () => {
            const params = new URLSearchParams(window.location.search);
            const codeParam = params.get('code');
            if (codeParam && codeParam.length === 4) {
                switchTab('receive');
                fillCode(codeParam);
                fetchFileByCode();
            }
        });

        function switchTab(tab) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            if (tab === 'send') {
                document.querySelectorAll('.tab-btn')[0].classList.add('active');
                document.getElementById('sendPanel').classList.add('active');
            } else {
                document.querySelectorAll('.tab-btn')[1].classList.add('active');
                document.getElementById('receivePanel').classList.add('active');
                document.getElementById('d1').focus();
            }
        }

        const digits = [document.getElementById('d1'), document.getElementById('d2'), document.getElementById('d3'), document.getElementById('d4')];
        digits.forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                if (input.value && idx < 3) digits[idx + 1].focus();
                if (idx === 3 && getEnteredCode().length === 4) fetchFileByCode();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && idx > 0) digits[idx - 1].focus();
            });
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
                fillCode(pasteData);
            });
        });

        function fillCode(val) {
            const clean = val.replace(/\\D/g, '').slice(0, 4);
            for (let i = 0; i < 4; i++) {
                digits[i].value = clean[i] || '';
            }
            if (clean.length === 4) fetchFileByCode();
        }

        function getEnteredCode() {
            return digits.map(d => d.value).join('');
        }

        const dropzone = document.getElementById('dropzone');
        ['dragenter', 'dragover'].forEach(name => {
            dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        });
        ['dragleave', 'drop'].forEach(name => {
            dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files);
            }
        });

        async function handleFileSelect(fileOrFiles) {
            if (!fileOrFiles) return;
            let files = [];
            if (fileOrFiles instanceof FileList || Array.isArray(fileOrFiles)) {
                files = Array.from(fileOrFiles);
            } else if (fileOrFiles instanceof File) {
                files = [fileOrFiles];
            }
            if (files.length === 0) return;

            document.getElementById('dropzoneView').style.display = 'none';
            document.getElementById('uploadProgressView').style.display = 'block';
            const nameEl = document.getElementById('uploadingFileName');
            const fillEl = document.getElementById('progressFill');
            const textEl = document.getElementById('uploadProgressText');
            fillEl.style.width = '0%';
            textEl.innerText = '0%';

            let fileToUpload = null;
            let batchInfo = null;

            if (files.length === 1) {
                fileToUpload = files[0];
                nameEl.innerText = fileToUpload.name;
            } else {
                try {
                    nameEl.innerText = 'Packaging ' + files.length + ' files into ZIP archive...';
                    fillEl.style.width = '10%';
                    textEl.innerText = 'Initializing ZIP engine...';

                    if (typeof JSZip === 'undefined') {
                        throw new Error('JSZip library not loaded');
                    }
                    const zip = new JSZip();
                    const usedNames = new Set();
                    for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        let name = f.name || ('file_' + (i + 1));
                        if (usedNames.has(name)) {
                            const dot = name.lastIndexOf('.');
                            const base = dot !== -1 ? name.substring(0, dot) : name;
                            const ext = dot !== -1 ? name.substring(dot) : '';
                            let cnt = 1;
                            while (usedNames.has(base + '_(' + cnt + ')' + ext)) { cnt++; }
                            name = base + '_(' + cnt + ')' + ext;
                        }
                        usedNames.add(name);
                        zip.file(name, f);
                    }

                    const zipBlob = await zip.generateAsync(
                        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
                        function (meta) {
                            const pct = Math.round(meta.percent);
                            fillEl.style.width = Math.min(95, pct) + '%';
                            textEl.innerText = 'Compressing into ZIP: ' + pct + '%';
                            nameEl.innerText = 'Bundling ' + files.length + ' files into ZIP (' + pct + '%)...';
                        }
                    );

                    const now = new Date();
                    const pad = (n) => String(n).padStart(2, '0');
                    const dateStr = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
                    const timeStr = pad(now.getHours()) + pad(now.getMinutes());
                    const zipName = 'BranchEase_' + files.length + '_Files_' + dateStr + '_' + timeStr + '.zip';

                    fileToUpload = new File([zipBlob], zipName, { type: 'application/zip' });
                    batchInfo = { count: files.length, name: zipName };

                    nameEl.innerText = 'Uploading ' + zipName + ' (' + files.length + ' files bundled)...';
                    fillEl.style.width = '0%';
                    textEl.innerText = '0%';
                } catch (zipErr) {
                    console.error('ZIP error:', zipErr);
                    alert('Could not package multiple files into ZIP: ' + (zipErr.message || zipErr));
                    resetSendView();
                    return;
                }
            }

            const formData = new FormData();
            formData.append('file', fileToUpload, fileToUpload.name);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    fillEl.style.width = percent + '%';
                    textEl.innerText = percent + '% (' + formatBytes(e.loaded) + ' / ' + formatBytes(e.total) + ')';
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const res = JSON.parse(xhr.responseText);
                        if (res.success) {
                            showUploadResult(res, batchInfo);
                        } else {
                            alert('Upload failed: ' + (res.error || 'Server error'));
                            resetSendView();
                        }
                    } catch (e) {
                        alert('Upload response parse error: ' + e.message);
                        resetSendView();
                    }
                } else {
                    alert('Upload failed with status ' + xhr.status);
                    resetSendView();
                }
            };

            xhr.onerror = () => {
                document.getElementById('uploadProgressText').innerText = 'Retrying upload...';
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(r => r.json())
                .then(res => {
                    if (res && res.success) {
                        showUploadResult(res, batchInfo);
                    } else {
                        alert('Upload failed: ' + (res.error || 'Unknown error'));
                        resetSendView();
                    }
                })
                .catch(err => {
                    alert('Upload error: ' + (err.message || 'Network error'));
                    resetSendView();
                });
            };

            xhr.send(formData);
        }

        function showUploadResult(res, batchInfo) {
            currentCode = res.code;
            document.getElementById('uploadProgressView').style.display = 'none';
            document.getElementById('sendResultView').style.display = 'block';
            document.getElementById('generatedCode').innerText = res.code.split('').join(' ');

            const currentOrigin = window.location.origin;
            const targetUrl = currentOrigin + '/api/download/' + res.code;
            document.getElementById('qrCodeImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(targetUrl);

            startCountdown(res.expiresAt);
        }

        function startCountdown(expiresAt) {
            if (countdownTimer) clearInterval(countdownTimer);
            function update() {
                const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
                const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
                const secs = String(remaining % 60).padStart(2, '0');
                document.getElementById('sendCountdown').innerText = mins + ':' + secs + ' remaining';
                if (remaining <= 0) {
                    clearInterval(countdownTimer);
                    document.getElementById('sendCountdown').innerText = ' Expired! File has been purged';
                }
            }
            update();
            countdownTimer = setInterval(update, 1000);
        }

        function copyCode() {
            if (!currentCode) return;
            navigator.clipboard.writeText(currentCode).then(() => {
                alert('Code (' + currentCode + ') copied to clipboard!');
            });
        }

        async function deleteCurrentFile() {
            if (!currentCode) return;
            if (confirm('Are you sure you want to permanently delete this file now?')) {
                await fetch('/api/delete/' + currentCode, { method: 'DELETE' });
                alert('File has been permanently deleted from server.');
                resetSendView();
            }
        }

        function resetSendView() {
            if (countdownTimer) clearInterval(countdownTimer);
            currentCode = "";
            document.getElementById('fileInput').value = "";
            document.getElementById('dropzoneView').style.display = 'block';
            document.getElementById('uploadProgressView').style.display = 'none';
            document.getElementById('sendResultView').style.display = 'none';
        }

        async function fetchFileByCode() {
            const code = getEnteredCode();
            const errEl = document.getElementById('receiveError');
            const resView = document.getElementById('receiveResultView');
            errEl.style.display = 'none';
            resView.style.display = 'none';

            if (code.length !== 4) {
                errEl.innerText = 'Please enter a complete 4-digit code.';
                errEl.style.display = 'block';
                return;
            }

            try {
                const res = await fetch('/api/info/' + code);
                const data = await res.json();
                if (data.success) {
                    document.getElementById('recFileName').innerText = data.fileName;
                    const mins = Math.ceil(data.expiresInSeconds / 60);
                    document.getElementById('recFileMeta').innerText = formatBytes(data.fileSize) + ' • ' + mins + ' mins remaining';
                    resView.style.display = 'block';
                } else {
                    errEl.innerText = data.error || 'File not found or expired.';
                    errEl.style.display = 'block';
                }
            } catch (e) {
                errEl.innerText = 'Could not connect to server.';
                errEl.style.display = 'block';
            }
        }

        function downloadFile() {
            const code = getEnteredCode();
            if (code.length === 4) {
                window.location.href = '/api/download/' + code;
            }
        }

        function formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    </script>
</body>
</html>`;

    return new Response(html, {
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "public, max-age=3600"
        }
    });
}
