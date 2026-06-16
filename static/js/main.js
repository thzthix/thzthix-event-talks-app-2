const state = {
    releases: [],
    selectedRelease: null,
};

const refreshButton = document.getElementById('refresh-button');
const releaseList = document.getElementById('release-list');
const statusMessage = document.getElementById('status-message');
const lastUpdated = document.getElementById('last-updated');
const tweetDialog = document.getElementById('tweet-dialog');
const tweetText = document.getElementById('tweet-text');
const tweetCount = document.getElementById('tweet-count');
const closeDialog = document.getElementById('close-dialog');
const cancelTweet = document.getElementById('cancel-tweet');
const postTweet = document.getElementById('post-tweet');
const themeToggle = document.getElementById('theme-toggle');
const themeToggleLabel = document.getElementById('theme-toggle-label');

refreshButton.addEventListener('click', () => loadReleases(true));
closeDialog.addEventListener('click', closeTweetDialog);
cancelTweet.addEventListener('click', closeTweetDialog);
postTweet.addEventListener('click', openTweetIntent);
tweetText.addEventListener('input', updateTweetCount);
themeToggle.addEventListener('change', toggleTheme);

initTheme();
loadReleases();

async function loadReleases(force = false) {
    setLoading(true);
    statusMessage.textContent = force ? 'Refreshing release notes...' : 'Loading release notes...';
    renderLoadingState();

    try {
        const payload = await fetchReleasePayload(force);

        state.releases = payload.data || [];
        renderReleases();
        statusMessage.textContent = `${state.releases.length} updates loaded from ${payload.source}.`;
        lastUpdated.textContent = payload.last_updated ? `Last refreshed ${payload.last_updated}` : '';
    } catch (error) {
        releaseList.innerHTML = '';
        statusMessage.textContent = 'Release notes could not be loaded.';
        renderEmptyState(error.message || 'Check your network connection, then try refreshing again.');
    } finally {
        setLoading(false);
    }
}

async function fetchReleasePayload(force) {
    try {
        return await fetchJson(`/api/releases${force ? '?force=true' : ''}`);
    } catch (apiError) {
        const staticPayload = await fetchJson('data/releases.json');
        staticPayload.source = force ? 'static snapshot; live refresh unavailable on GitHub Pages' : staticPayload.source;
        return staticPayload;
    }
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json();

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Could not load release notes.');
    }

    return payload;
}

function setLoading(isLoading) {
    refreshButton.disabled = isLoading;
    refreshButton.classList.toggle('is-loading', isLoading);
}

function renderReleases() {
    releaseList.innerHTML = '';

    if (!state.releases.length) {
        renderEmptyState('No release notes were found in the feed.');
        return;
    }

    const fragment = document.createDocumentFragment();

    state.releases.forEach((release) => {
        const article = document.createElement('article');
        article.className = 'release-card';
        article.dataset.category = normalizeCategory(release.category);

        const header = document.createElement('div');
        header.className = 'release-header';

        const meta = document.createElement('div');
        meta.className = 'release-meta';
        meta.innerHTML = `
            <span class="release-category">${escapeHtml(release.category)}</span>
            <time>${escapeHtml(release.date)}</time>
        `;

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const copyButton = document.createElement('button');
        copyButton.className = 'utility-button';
        copyButton.type = 'button';
        copyButton.textContent = 'Copy';
        copyButton.title = 'Copy this update to the clipboard';
        copyButton.setAttribute('aria-label', `Copy ${release.category} update from ${release.date} to clipboard`);
        copyButton.addEventListener('click', () => copyRelease(release, copyButton));

        const csvButton = document.createElement('button');
        csvButton.className = 'utility-button';
        csvButton.type = 'button';
        csvButton.textContent = 'Export CSV';
        csvButton.title = 'Export this update as a CSV file';
        csvButton.setAttribute('aria-label', `Export ${release.category} update from ${release.date} as CSV`);
        csvButton.addEventListener('click', () => exportReleaseCsv(release, csvButton));

        const tweetButton = document.createElement('button');
        tweetButton.className = 'tweet-button';
        tweetButton.type = 'button';
        tweetButton.textContent = 'Tweet';
        tweetButton.setAttribute('aria-label', `Compose tweet for ${release.category} update from ${release.date}`);
        tweetButton.addEventListener('click', () => openTweetDialog(release));

        actions.append(copyButton, csvButton, tweetButton);
        header.append(meta, actions);

        const body = document.createElement('div');
        body.className = 'release-body';
        body.innerHTML = release.html;

        const sourceLink = document.createElement('a');
        sourceLink.className = 'source-link';
        sourceLink.href = release.link;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.textContent = 'View source';

        article.append(header, body, sourceLink);
        fragment.appendChild(article);
    });

    releaseList.appendChild(fragment);
}

function renderEmptyState(message) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = message;
    releaseList.appendChild(emptyState);
}

function renderLoadingState() {
    releaseList.innerHTML = '';

    for (let index = 0; index < 4; index += 1) {
        const skeleton = document.createElement('article');
        skeleton.className = 'release-card skeleton-card';
        skeleton.setAttribute('aria-hidden', 'true');
        skeleton.innerHTML = `
            <div class="skeleton-row">
                <span class="skeleton-pill"></span>
                <span class="skeleton-short"></span>
            </div>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line skeleton-line-small"></span>
        `;
        releaseList.appendChild(skeleton);
    }
}

function openTweetDialog(release) {
    state.selectedRelease = release;
    tweetText.value = buildTweetText(release);
    updateTweetCount();
    tweetDialog.showModal();
    tweetText.focus();
}

function closeTweetDialog() {
    tweetDialog.close();
    state.selectedRelease = null;
}

function buildTweetText(release) {
    const prefix = `BigQuery ${release.category} (${release.date}): `;
    const suffix = `\n\n${release.link}\n#BigQuery #GoogleCloud`;
    const maxBodyLength = Math.max(0, 280 - tweetLength(prefix + suffix, release.link));
    const body = truncateText(release.text, maxBodyLength);

    return `${prefix}${body}${suffix}`;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    if (maxLength <= 3) {
        return '';
    }

    return `${text.slice(0, maxLength - 3)}...`;
}

function updateTweetCount() {
    const url = state.selectedRelease ? state.selectedRelease.link : '';
    const count = tweetLength(tweetText.value, url);
    tweetCount.textContent = `${count} / 280`;
    tweetCount.classList.toggle('over-limit', count > 280);
    postTweet.disabled = count > 280;
}

function tweetLength(text, url) {
    if (!url) {
        return text.length;
    }

    return text.replaceAll(url, 'x'.repeat(23)).length;
}

function openTweetIntent() {
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText.value)}`;
    window.open(intentUrl, '_blank', 'noopener');
    closeTweetDialog();
}

async function copyRelease(release, button) {
    const text = [
        `BigQuery ${release.category}`,
        `Date: ${release.date}`,
        '',
        release.text,
        '',
        release.link,
    ].join('\n');

    try {
        await navigator.clipboard.writeText(text);
        flashButtonLabel(button, 'Copied');
        showTemporaryStatus('Copied update to clipboard.');
    } catch (error) {
        showTemporaryStatus('Clipboard copy failed. Your browser may require HTTPS or localhost.');
    }
}

function exportReleaseCsv(release, button) {
    const headers = ['Date', 'Category', 'Update', 'Link'];
    const row = [release.date, release.category, release.text, release.link];
    const csv = [headers, row].map((values) => values.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `bigquery-release-${slugify(release.date)}-${slugify(release.category)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    flashButtonLabel(button, 'Exported');
    showTemporaryStatus('Exported update as CSV.');
}

function flashButtonLabel(button, temporaryLabel) {
    const originalLabel = button.textContent;

    button.textContent = temporaryLabel;
    button.disabled = true;
    window.setTimeout(() => {
        button.textContent = originalLabel;
        button.disabled = false;
    }, 1400);
}

function escapeCsv(value) {
    const text = String(value || '').replace(/"/g, '""');
    return /[",\r\n]/.test(text) ? `"${text}"` : text;
}

function slugify(value) {
    return String(value || 'update').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function showTemporaryStatus(message) {
    const previousMessage = statusMessage.textContent;
    statusMessage.textContent = message;
    window.setTimeout(() => {
        statusMessage.textContent = previousMessage;
    }, 2500);
}

function initTheme() {
    const savedTheme = window.localStorage.getItem('theme');
    const theme = savedTheme === 'light' ? 'light' : 'dark';

    applyTheme(theme);
}

function toggleTheme() {
    const theme = themeToggle.checked ? 'light' : 'dark';

    applyTheme(theme);
    window.localStorage.setItem('theme', theme);
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.checked = theme === 'light';
    themeToggle.setAttribute('aria-checked', String(theme === 'light'));
    themeToggleLabel.textContent = `Theme: ${theme === 'light' ? 'Light' : 'Dark'}`;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }[char]));
}

function normalizeCategory(value) {
    return String(value || 'update').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
