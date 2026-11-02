use axum::response::Html;
use axum::routing::get;
use axum::Router;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(serve_index))
}

async fn serve_index() -> Html<&'static str> {
    Html(INDEX_HTML)
}

const INDEX_HTML: &str = r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mazz MuZik - Administration</title>
    <style>
        :root {
            --bg: #0f1117;
            --surface: #1a1d27;
            --border: #2b3040;
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 24px;
            line-height: 1.5;
        }
        .container { max-width: 1100px; margin: 0 auto; }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 24px;
        }
        h1 { font-size: 26px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
        .tag { font-size: 12px; background: var(--primary); padding: 2px 8px; border-radius: 12px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
        .card h2 { font-size: 16px; margin-bottom: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-value { font-size: 32px; font-weight: 700; color: #fff; }
        input[type="text"], textarea {
            width: 100%;
            background: #0b0d13;
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px 14px;
            color: #fff;
            margin-bottom: 12px;
            font-size: 14px;
        }
        button {
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 10px 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover { background: var(--primary-hover); }
        button.secondary { background: #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--border); font-size: 14px; }
        th { color: var(--text-muted); font-weight: 600; }
        .badge {
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 600;
            display: inline-block;
        }
        .badge.pending { background: #334155; color: #94a3b8; }
        .badge.resolving, .badge.downloading { background: #1e3a8a; color: #60a5fa; }
        .badge.completed { background: #064e3b; color: #34d399; }
        .badge.failed { background: #7f1d1d; color: #f87171; }
        .badge.manual_review { background: #78350f; color: #fbbf24; }
        .candidate-box {
            background: #11141e;
            border: 1px solid #334155;
            padding: 10px;
            border-radius: 6px;
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Mazz MuZik <span class="tag">GPL-3.0</span></h1>
                <p style="color: var(--text-muted); font-size: 14px;">Écosystème auto-hébergé de musique personnelle</p>
            </div>
            <div>
                <button class="secondary" onclick="triggerScan()">Scanner la bibliothèque</button>
            </div>
        </header>

        <div class="grid">
            <div class="card">
                <h2>Morceaux locaux</h2>
                <div class="stat-value" id="stat-tracks">0</div>
            </div>
            <div class="card">
                <h2>Artistes</h2>
                <div class="stat-value" id="stat-artists">0</div>
            </div>
            <div class="card">
                <h2>Albums</h2>
                <div class="stat-value" id="stat-albums">0</div>
            </div>
        </div>

        <div class="card" style="margin-bottom: 24px;">
            <h2>Importer une playlist publique (Spotify, YT Music, Deezer, CSV, M3U)</h2>
            <div style="display: flex; gap: 10px;">
                <input type="text" id="import-url" placeholder="Collez l'URL publique de la playlist (sans compte ni cookie requis)...">
                <button onclick="importPlaylist()">Importer</button>
            </div>
            <div id="import-feedback" style="font-size: 13px; margin-top: 6px;"></div>
        </div>

        <div class="card" id="review-card" style="margin-bottom: 24px; display: none;">
            <h2 style="color: var(--warning);">Arbitrage manuel requis (<span id="review-count">0</span>)</h2>
            <div id="review-list"></div>
        </div>

        <div class="card">
            <h2>File de téléchargement active</h2>
            <table>
                <thead>
                    <tr>
                        <th>Titre / Requête</th>
                        <th>Artiste</th>
                        <th>Statut</th>
                        <th>Progression</th>
                        <th>Créé le</th>
                    </tr>
                </thead>
                <tbody id="queue-body">
                    <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Aucune tâche en cours</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        async function fetchStats() {
            try {
                const res = await fetch('/api/library');
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('stat-tracks').innerText = data.total_tracks;
                    document.getElementById('stat-artists').innerText = data.total_artists;
                    document.getElementById('stat-albums').innerText = data.total_albums;
                }
            } catch(e) {}
        }

        async function fetchQueue() {
            try {
                const res = await fetch('/api/queue');
                if (res.ok) {
                    const items = await res.json();
                    const tbody = document.getElementById('queue-body');
                    if (items.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">File d\'attente vide</td></tr>';
                        return;
                    }
                    tbody.innerHTML = items.map(item => `
                        <tr>
                            <td><strong>${escapeHtml(item.query_title)}</strong></td>
                            <td>${escapeHtml(item.query_artist)}</td>
                            <td><span class="badge ${item.status}">${item.status}</span></td>
                            <td>${Math.round(item.download_progress * 100)}%</td>
                            <td style="color: var(--text-muted); font-size: 12px;">${item.created_at}</td>
                        </tr>
                    `).join('');
                }
            } catch(e) {}
        }

        async function fetchReviews() {
            try {
                const res = await fetch('/api/review');
                if (res.ok) {
                    const items = await res.json();
                    const card = document.getElementById('review-card');
                    if (items.length === 0) {
                        card.style.display = 'none';
                        return;
                    }
                    card.style.display = 'block';
                    document.getElementById('review-count').innerText = items.length;
                    const list = document.getElementById('review-list');
                    list.innerHTML = items.map(item => {
                        let candidates = [];
                        try { candidates = JSON.parse(item.candidates_json); } catch(e) {}
                        return `
                            <div style="border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 14px;">
                                <div><strong>${escapeHtml(item.query_title)}</strong> par <em>${escapeHtml(item.query_artist)}</em></div>
                                <div style="margin-top: 8px;">
                                    ${candidates.map(c => `
                                        <div class="candidate-box">
                                            <div>
                                                <div><strong>${escapeHtml(c.title)}</strong> - ${escapeHtml(c.artist)}</div>
                                                <div style="font-size: 12px; color: var(--text-muted);">Source: ${c.provider} | Score: ${(c.confidence_score * 100).toFixed(1)}% | Durée: ${Math.round(c.duration_ms / 1000)}s</div>
                                            </div>
                                            <button style="font-size: 12px; padding: 6px 12px;" onclick="resolveReview('${item.id}', true, '${c.external_id}')">Choisir</button>
                                        </div>
                                    `).join('')}
                                </div>
                                <div style="margin-top: 8px; text-align: right;">
                                    <button class="secondary" style="font-size: 12px; padding: 6px 12px;" onclick="resolveReview('${item.id}', false, null)">Rejeter cette piste</button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            } catch(e) {}
        }

        async function resolveReview(reviewId, approved, candidateId) {
            await fetch(`/api/review/${reviewId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved, selected_candidate_id: candidateId })
            });
            fetchReviews();
            fetchQueue();
        }

        async function importPlaylist() {
            const input = document.getElementById('import-url');
            const feedback = document.getElementById('import-feedback');
            const url = input.value.trim();
            if (!url) return;

            feedback.style.color = 'var(--text-muted)';
            feedback.innerText = 'Importation en cours...';

            try {
                const res = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                const data = await res.json();
                if (res.ok) {
                    feedback.style.color = 'var(--success)';
                    feedback.innerText = data.message;
                    input.value = '';
                    fetchQueue();
                } else {
                    feedback.style.color = 'var(--error)';
                    feedback.innerText = data.message;
                }
            } catch(e) {
                feedback.style.color = 'var(--error)';
                feedback.innerText = e.message;
            }
        }

        async function triggerScan() {
            try {
                const res = await fetch('/api/library/scan', { method: 'POST' });
                const data = await res.json();
                alert(`Scan terminé ! ${data.newly_added_tracks} nouveaux morceaux indexés.`);
                fetchStats();
            } catch(e) {
                alert('Erreur lors du scan: ' + e.message);
            }
        }

        function escapeHtml(str) {
            return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        fetchStats();
        fetchQueue();
        fetchReviews();
        setInterval(() => {
            fetchQueue();
            fetchReviews();
            fetchStats();
        }, 3000);
    </script>
</body>
</html>"#;
