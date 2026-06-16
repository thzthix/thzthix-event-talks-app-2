document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let state = {
        releases: [],
        filteredReleases: [],
        filters: {
            search: '',
            category: 'all',
            sort: 'newest'
        },
        selectedRelease: null
    };

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const sortSelect = document.getElementById('sort-select');
    const releasesGrid = document.getElementById('releases-grid');
    const lastRefreshedTime = document.getElementById('last-refreshed-time');
    
    // Stats elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statIssues = document.getElementById('stat-issues');
    const statDeprecations = document.getElementById('stat-deprecations');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const tweetCharCount = document.getElementById('tweet-char-count');
    const closeTweetModal = document.getElementById('close-tweet-modal');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const sendTweetBtn = document.getElementById('send-tweet-btn');
    
    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Initialize application
    init();

    function init() {
        fetchReleases();
        bindEvents();
    }

    // Bind UI Event Listeners
    function bindEvents() {
        // Refresh button
        refreshBtn.addEventListener('click', () => {
            fetchReleases(true);
        });

        // Search inputs
        searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            applyFilters();
        });

        // Dropdown filters
        categorySelect.addEventListener('change', (e) => {
            state.filters.category = e.target.value;
            applyFilters();
        });

        sortSelect.addEventListener('change', (e) => {
            state.filters.sort = e.target.value;
            applyFilters();
        });

        // Modal Close Events
        closeTweetModal.addEventListener('click', closeModal);
        cancelTweetBtn.addEventListener('click', closeModal);
        tweetModal.addEventListener('click', (e) => {
            if (e.target === tweetModal) {
                closeModal();
            }
        });

        // Tweet Edit Area
        tweetTextarea.addEventListener('input', updateCharCount);

        // Submit Tweet
        sendTweetBtn.addEventListener('click', postTweet);
    }

    // Fetch Release Notes from API
    async function fetchReleases(force = false) {
        showSkeletonLoader();
        refreshBtn.classList.add('spinning');
        refreshBtn.disabled = true;

        try {
            const url = `/api/releases${force ? '?force=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch release notes from the server.');
            }

            const result = await response.json();
            
            if (result.status === 'success') {
                state.releases = result.data;
                
                // Update last updated timestamp
                if (result.last_updated) {
                    lastRefreshedTime.textContent = `Refreshed: ${result.last_updated}`;
                }
                
                applyFilters();
                
                if (force) {
                    showToast('Successfully fetched latest release notes!', 'success');
                }
            } else {
                throw new Error(result.message || 'Unknown server error');
            }
        } catch (error) {
            console.error('Error fetching releases:', error);
            showToast(error.message || 'Error communicating with server.', 'error');
            
            // If we have no data, show error state in grid
            if (state.releases.length === 0) {
                showEmptyState(true, error.message);
            }
        } finally {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }

    // Apply filters and sorting to releases list
    function applyFilters() {
        let result = [...state.releases];

        // 1. Filter by category
        if (state.filters.category !== 'all') {
            result = result.filter(item => {
                const type = item.type.toLowerCase();
                return type === state.filters.category.toLowerCase();
            });
        }

        // 2. Filter by search query
        if (state.filters.search) {
            const query = state.filters.search;
            result = result.filter(item => {
                return (
                    item.text.toLowerCase().includes(query) ||
                    item.type.toLowerCase().includes(query) ||
                    item.date.toLowerCase().includes(query)
                );
            });
        }

        // 3. Sort releases
        result.sort((a, b) => {
            const dateA = new Date(a.updated || a.date);
            const dateB = new Date(b.updated || b.date);
            
            if (state.filters.sort === 'newest') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });

        state.filteredReleases = result;
        
        // Update stats dashboard
        updateStats();
        
        // Render to UI
        renderReleases();
    }

    // Update the Stats Dashboard counters
    function updateStats() {
        const total = state.releases.length;
        const features = state.releases.filter(i => i.type.toLowerCase() === 'feature').length;
        const issues = state.releases.filter(i => i.type.toLowerCase() === 'issue').length;
        const deprecations = state.releases.filter(i => i.type.toLowerCase() === 'deprecation').length;

        statTotal.textContent = total;
        statFeatures.textContent = features;
        statIssues.textContent = issues;
        statDeprecations.textContent = deprecations;
    }

    // Render the releases list to grid
    function renderReleases() {
        releasesGrid.innerHTML = '';

        if (state.filteredReleases.length === 0) {
            showEmptyState(false);
            return;
        }

        state.filteredReleases.forEach(item => {
            const card = document.createElement('div');
            const typeClass = item.type.toLowerCase();
            card.className = `release-card type-${typeClass}`;
            
            // Map types to badge CSS types
            let badgeType = 'notice';
            if (typeClass === 'feature') badgeType = 'feature';
            else if (typeClass === 'issue') badgeType = 'issue';
            else if (typeClass === 'deprecation') badgeType = 'deprecation';
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge badge-${badgeType}">${item.type}</span>
                        <span class="card-date">${item.date}</span>
                    </div>
                    <div class="card-actions">
                        <a href="${item.link}" target="_blank" class="btn-card" title="View Source Documentation" aria-label="View Source">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                        <button class="btn-card btn-tweet-action" title="Compose Tweet about this update" aria-label="Tweet about this">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${item.html}
                </div>
            `;

            // Bind click listener for tweet button
            const tweetBtn = card.querySelector('.btn-tweet-action');
            tweetBtn.addEventListener('click', () => {
                openTweetModal(item);
            });

            releasesGrid.appendChild(card);
        });
    }

    // Show skeleton loaders in the grid
    function showSkeletonLoader() {
        releasesGrid.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.innerHTML = `
                <div class="skeleton-header">
                    <div class="skeleton-badge"></div>
                    <div class="skeleton-date"></div>
                </div>
                <div class="skeleton-body">
                    <div class="skeleton-line" style="width: 90%;"></div>
                    <div class="skeleton-line" style="width: 100%;"></div>
                    <div class="skeleton-line" style="width: 75%;"></div>
                </div>
                <div class="skeleton-header" style="justify-content: flex-end;">
                    <div class="skeleton-badge" style="width: 30px; height: 30px; border-radius: 6px;"></div>
                </div>
            `;
            releasesGrid.appendChild(skeleton);
        }
    }

    // Show empty state inside grid
    function showEmptyState(isError = false, customMsg = '') {
        releasesGrid.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>${isError ? 'Error Loading Data' : 'No Releases Found'}</h3>
                <p>${isError ? (customMsg || 'There was an error connecting to the backend.') : 'Try adjusting your search criteria or category filters.'}</p>
            </div>
        `;
    }

    // Modal Operations
    function openTweetModal(releaseItem) {
        state.selectedRelease = releaseItem;
        
        // Construct default tweet text
        const type = releaseItem.type;
        const date = releaseItem.date;
        const text = releaseItem.text;
        const link = releaseItem.link;
        
        // Create a polished default tweet
        const prefix = `📢 BigQuery ${type} (${date}): `;
        const suffix = `\n\nRead more: ${link}\n#BigQuery #GoogleCloud`;
        
        // We calculate max length of the editable text portion to fit within Twitter limits.
        // Twitter count: text length with links counted as 23 chars.
        // Let's truncate the main text description if the overall tweet length exceeds 280 characters.
        const baseLength = calculateTweetLength(prefix + suffix, link);
        const maxTextLen = 280 - baseLength;
        
        let displayDesc = text;
        if (text.length > maxTextLen) {
            displayDesc = text.substring(0, maxTextLen - 3) + '...';
        }
        
        const defaultTweet = `${prefix}${displayDesc}${suffix}`;
        
        tweetTextarea.value = defaultTweet;
        tweetModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock background scrolling
        
        updateCharCount();
        tweetTextarea.focus();
    }

    function closeModal() {
        tweetModal.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scrolling
        state.selectedRelease = null;
    }

    // Custom character counter (considering t.co link wrapping)
    function calculateTweetLength(text, url) {
        let lengthStr = text;
        if (url && text.includes(url)) {
            // Replace the actual link with 23 characters (standard Twitter shortener length)
            lengthStr = text.replace(url, '12345678901234567890123');
        }
        return lengthStr.length;
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        const url = state.selectedRelease ? state.selectedRelease.link : null;
        
        const count = calculateTweetLength(text, url);
        const remaining = 280 - count;
        
        tweetCharCount.innerHTML = `<span>${count}</span> / 280`;
        
        // Remove old classes
        tweetCharCount.className = 'char-counter';
        
        if (remaining < 0) {
            tweetCharCount.classList.add('limit-exceeded');
            sendTweetBtn.disabled = true;
        } else if (remaining <= 20) {
            tweetCharCount.classList.add('limit-near');
            sendTweetBtn.disabled = false;
        } else {
            sendTweetBtn.disabled = false;
        }
    }

    // Redirect to X/Twitter web intent
    function postTweet() {
        const tweetText = tweetTextarea.value;
        const encodedText = encodeURIComponent(tweetText);
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        
        window.open(twitterIntentUrl, '_blank');
        closeModal();
        showToast('Redirected to X to publish your tweet!', 'success');
    }

    // Toast alert feedback
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = '';
        if (type === 'success') {
            icon = `<svg xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;color:var(--color-feature);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>`;
        } else {
            icon = `<svg xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;color:var(--color-issue);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>`;
        }

        toast.innerHTML = `
            ${icon}
            <div class="toast-message">${message}</div>
            <button class="toast-close" aria-label="Close Toast">
                <svg xmlns="http://www.w3.org/2000/svg" style="width:16px;height:16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;

        toastContainer.appendChild(toast);
        
        // Trigger reflow for animation
        toast.offsetHeight;
        toast.classList.add('show');

        // Setup auto-close
        const timeout = setTimeout(() => {
            dismissToast(toast);
        }, 4000);

        // Bind close button click
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timeout);
            dismissToast(toast);
        });
    }

    function dismissToast(toast) {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }
});
