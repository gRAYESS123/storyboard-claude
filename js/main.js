/* Easy Storyboards — landing page interactions */
(function () {
    'use strict';
    var doc = document;

    /* Current year in footer */
    var yearEl = doc.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* Sticky header background after a little scroll */
    var header = doc.getElementById('siteHeader');
    if (header) {
        var onScroll = function () {
            header.classList.toggle('scrolled', window.scrollY > 8);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* Mobile navigation */
    var toggle = doc.getElementById('navToggle');
    var navLinks = doc.getElementById('navLinks');
    if (toggle && navLinks) {
        var setNav = function (open) {
            navLinks.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };
        toggle.addEventListener('click', function () {
            setNav(!navLinks.classList.contains('open'));
        });
        navLinks.addEventListener('click', function (e) {
            if (e.target.closest('a')) setNav(false);
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth > 760) setNav(false);
        });
    }

    /* Scroll-reveal animations */
    var revealEls = doc.querySelectorAll('.reveal');
    /* Anything already on screen at load shows immediately (never a blank hero) */
    revealEls.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
    });
    if ('IntersectionObserver' in window && revealEls.length) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el) { io.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('in'); });
    }

    /* FAQ: open one at a time */
    var faqItems = doc.querySelectorAll('.faq-item');
    faqItems.forEach(function (item) {
        item.addEventListener('toggle', function () {
            if (item.open) {
                faqItems.forEach(function (other) {
                    if (other !== item) other.open = false;
                });
            }
        });
    });

    /* Copy buttons on install code blocks */
    doc.querySelectorAll('.copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var code = btn.parentElement.querySelector('code');
            if (!code || !navigator.clipboard) return;
            navigator.clipboard.writeText(code.textContent).then(function () {
                btn.textContent = 'Copied';
                btn.classList.add('copied');
                setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1600);
            });
        });
    });

    /* Hero tour video: sound toggle (autoplay must start muted) */
    var video = doc.getElementById('tourVideo');
    var soundBtn = doc.getElementById('soundBtn');
    if (video && soundBtn) {
        var label = soundBtn.querySelector('span');
        soundBtn.addEventListener('click', function () {
            if (video.muted) {
                video.muted = false; video.currentTime = 0; video.play();
                label.textContent = 'Mute'; soundBtn.setAttribute('aria-pressed', 'true');
            } else {
                video.muted = true; label.textContent = 'Play with sound'; soundBtn.setAttribute('aria-pressed', 'false');
            }
        });
    }
})();
