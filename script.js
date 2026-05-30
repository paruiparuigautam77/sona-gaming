// ==================== NAVBAR ====================
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('open');
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('open');
    });
});

// Scroll effects
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Active nav link highlight
const sections = document.querySelectorAll('.section, .hero');
const navItems = navLinks.querySelectorAll('a');

const observerNav = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.id;
            navItems.forEach(a => {
                a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
            });
        }
    });
}, { threshold: 0.3 });

sections.forEach(s => observerNav.observe(s));

// ==================== FADE-IN ON SCROLL ====================
const fadeElements = document.querySelectorAll('.fade-in');

const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

fadeElements.forEach(el => fadeObserver.observe(el));

// ==================== YOUTUBE API ====================
const CHANNEL_ID = 'UClOglc-SJf_olkTpB_s9WwQ';
const API_BASE = '/api/youtube';

async function fetchYouTube(action, params = {}) {
    const url = new URL(API_BASE, window.location.origin);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('YouTube API fetch failed:', err);
        return null;
    }
}

// Load featured video
async function loadFeaturedVideo() {
    const container = document.getElementById('featuredVideo');
    const data = await fetchYouTube('latest-video', { channelId: CHANNEL_ID });

    if (data && data.videoId) {
        container.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${data.videoId}"
                title="${data.title || 'Latest Video'}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy">
            </iframe>`;
    } else {
        container.innerHTML = `
            <div class="video-placeholder">
                <p style="color: var(--primary);">Could not load video.</p>
                <p>Check that the YouTube API key is set in Vercel.</p>
            </div>`;
    }
}

// Load shorts
async function loadShorts() {
    const grid = document.getElementById('shortsGrid');
    const data = await fetchYouTube('shorts', { channelId: CHANNEL_ID });

    if (data && data.shorts && data.shorts.length > 0) {
        const labels = ['Most Viewed', 'Most Liked', 'Latest Upload'];
        grid.innerHTML = data.shorts.map((short, i) => `
            <div class="short-card fade-in visible">
                <span class="short-label">${labels[i] || ''}</span>
                <iframe
                    src="https://www.youtube.com/embed/${short.videoId}"
                    title="${short.title || labels[i]}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    loading="lazy">
                </iframe>
            </div>
        `).join('');
    } else {
        grid.innerHTML = `
            <div class="short-card fade-in visible">
                <div class="short-placeholder">
                    <p style="color: var(--primary);">Could not load shorts.</p>
                    <p>Check API key configuration.</p>
                </div>
            </div>`;
    }
}

// Load news
async function loadNews() {
    const container = document.getElementById('newsContent');
    try {
        const res = await fetch('./news.txt');
        if (!res.ok) throw new Error('File not found');
        const text = await res.text();
        if (text.trim()) {
            container.innerHTML = text.split('\n').map(line =>
                `<div class="news-line">${line || '&nbsp;'}</div>`
            ).join('');
        } else {
            container.innerHTML = '<p>No updates yet. Check back soon!</p>';
        }
    } catch {
        container.innerHTML = '<p>No updates yet. Check back soon!</p>';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedVideo();
    loadShorts();
    loadNews();
});
