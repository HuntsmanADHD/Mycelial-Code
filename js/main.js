/**
 * MYCELIAL LANDING PAGE - MAIN MODULE
 * Page initialization, scroll animations, and smooth interactions
 */

/**
 * Initialize the landing page
 */
function initLandingPage() {
    // Initialize scroll animations
    initScrollAnimations();

    // Initialize smooth scrolling
    initSmoothScrolling();

    // Initialize copy buttons
    initCopyButtons();

    // Initialize scroll indicator
    initScrollIndicator();

    console.log('Mycelial landing page initialized');
}

/**
 * Initialize scroll-triggered animations
 */
function initScrollAnimations() {
    // Create intersection observer for scroll animations
    const observerOptions = {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -10% 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optionally unobserve after animating once
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.add('animate-on-scroll');
        observer.observe(section);
    });

    // Observe cards
    const cards = document.querySelectorAll('.comparison-card, .benefit-card, .feature-card, .doc-card');
    cards.forEach(card => {
        card.classList.add('animate-on-scroll');
        observer.observe(card);
    });
}

/**
 * Initialize smooth scrolling for anchor links
 */
function initSmoothScrolling() {
    // Smooth scroll for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Skip if href is just "#"
            if (href === '#') return;

            e.preventDefault();

            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for nav bar

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Initialize copy buttons for code examples
 */
function initCopyButtons() {
    document.querySelectorAll('.btn-copy').forEach(button => {
        button.addEventListener('click', function() {
            const codeId = this.getAttribute('data-copy');
            const codeElement = document.getElementById(codeId);

            if (codeElement) {
                const code = codeElement.textContent;

                navigator.clipboard.writeText(code).then(() => {
                    // Show feedback
                    const originalText = this.textContent;
                    this.textContent = 'Copied!';
                    this.classList.add('copied');

                    setTimeout(() => {
                        this.textContent = originalText;
                        this.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy:', err);
                    alert('Failed to copy code');
                });
            }
        });
    });
}

/**
 * Initialize scroll indicator
 */
function initScrollIndicator() {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (!scrollIndicator) return;

    // Hide scroll indicator after scrolling
    let hasScrolled = false;

    window.addEventListener('scroll', () => {
        if (!hasScrolled && window.scrollY > 100) {
            hasScrolled = true;
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
        }
    });

    // Click to scroll to first section
    scrollIndicator.addEventListener('click', () => {
        const firstSection = document.querySelector('.section');
        if (firstSection) {
            firstSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

/**
 * Add parallax effect to hero section (optional enhancement)
 */
function initParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallaxSpeed = 0.5;

        hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
    });
}

/**
 * Track scroll progress (optional enhancement)
 */
function initScrollProgress() {
    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 3px;
        background: var(--color-primary);
        z-index: 9999;
        transition: width 0.1s ease;
    `;
    document.body.appendChild(progressBar);

    // Update on scroll
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;

        progressBar.style.width = scrolled + '%';
    });
}

/**
 * Add navbar background on scroll
 */
function initNavbarScroll() {
    const navbar = document.querySelector('.nav-bar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(0, 0, 0, 0.95)';
            navbar.style.boxShadow = '0 2px 8px rgba(53, 94, 59, 0.2)';
        } else {
            navbar.style.background = 'rgba(0, 0, 0, 0.85)';
            navbar.style.boxShadow = 'none';
        }
    });
}

/**
 * Initialize keyboard navigation
 */
function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // Arrow keys to navigate sections
        if (e.key === 'ArrowDown' && e.ctrlKey) {
            e.preventDefault();
            scrollToNextSection();
        } else if (e.key === 'ArrowUp' && e.ctrlKey) {
            e.preventDefault();
            scrollToPreviousSection();
        }
    });
}

/**
 * Scroll to next section
 */
function scrollToNextSection() {
    const sections = Array.from(document.querySelectorAll('.section'));
    const currentScroll = window.scrollY;

    const nextSection = sections.find(section => {
        return section.offsetTop > currentScroll + 100;
    });

    if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Scroll to previous section
 */
function scrollToPreviousSection() {
    const sections = Array.from(document.querySelectorAll('.section'));
    const currentScroll = window.scrollY;

    const previousSection = sections.reverse().find(section => {
        return section.offsetTop < currentScroll - 100;
    });

    if (previousSection) {
        previousSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Add Easter egg (Konami code or similar)
 */
function initEasterEgg() {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    document.addEventListener('keydown', (e) => {
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                activateEasterEgg();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    });
}

/**
 * Activate Easter egg
 */
function activateEasterEgg() {
    // Add fun animation or message
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 2rem;
        background: var(--color-primary);
        color: var(--color-white);
        font-size: 2rem;
        font-weight: bold;
        border-radius: 8px;
        z-index: 10000;
        animation: fadeInUp 0.5s ease-out;
    `;
    message.textContent = '🌿 You found the mycelial network! 🌿';
    document.body.appendChild(message);

    setTimeout(() => {
        message.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => message.remove(), 500);
    }, 3000);
}

/**
 * Track page analytics (optional)
 */
function initAnalytics() {
    // Track page view
    console.log('Page view tracked');

    // Track button clicks
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', () => {
            const buttonText = button.textContent.trim();
            console.log('Button clicked:', buttonText);
        });
    });
}

/**
 * Initialize performance monitoring
 */
function initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
        // Monitor largest contentful paint
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.log('LCP:', entry.startTime);
            }
        });

        observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }

    // Log page load time
    window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log('Page load time:', loadTime, 'ms');
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initLandingPage();
        initNavbarScroll();
        initKeyboardNavigation();
        // Optional enhancements (uncomment to enable):
        // initParallax();
        // initScrollProgress();
        // initEasterEgg();
        // initAnalytics();
        // initPerformanceMonitoring();
    });
} else {
    initLandingPage();
    initNavbarScroll();
    initKeyboardNavigation();
}
