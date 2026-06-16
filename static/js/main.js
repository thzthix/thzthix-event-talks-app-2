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

refreshButton.addEventListener('click', () => loadReleases(true));
closeDialog.addEventListener('click', closeTweetDialog);
cancelTweet.addEventListener('click', closeTweetDialog);
postTweet.addEventListener('click', openTweetIntent);
tweetText.addEventListener('input', updateTweetCount);

loadReleases();

async function loadReleases(force = false) {
    setLoading(true);
    statusMessage.textContent = force ? 'Refreshing release notes...' : 'Loading release notes...';

    try {
        const response = await fetch(`/api/releases${force ? '?force=true' : ''}`);
        const payload = await response.json();

        if (!response.ok || payload.status !== 'success') {
            throw new Error(payload.message || 'Could not load release notes.');
        }

        state.releases = payload.data || [];
        renderReleases();
        statusMessage.textContent = `${state.releases.length} updates loaded from ${payload.source}.`;
        lastUpdated.textContent = payload.last_updated ? `Last refreshed ${payload.last_updated}` : '';
    } catch (error) {
        releaseList.innerHTML = '';
        statusMessage.textContent = error.message || 'Could not load release notes.';
        renderEmptyState('The feed could not be loaded. Try refreshing again.');
    } finally {
        setLoading(false);
    }
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

        const header = document.createElement('div');
        header.className = 'release-header';

        const meta = document.createElement('div');
        meta.className = 'release-meta';
        meta.innerHTML = `
            <span class="release-category">${escapeHtml(release.category)}</span>
            <time>${escapeHtml(release.date)}</time>
        `;

        const tweetButton = document.createElement('button');
        tweetButton.className = 'tweet-button';
        tweetButton.type = 'button';
        tweetButton.textContent = 'Tweet';
        tweetButton.addEventListener('click', () => openTweetDialog(release));

        header.append(meta, tweetButton);

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

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }[char]));
}
