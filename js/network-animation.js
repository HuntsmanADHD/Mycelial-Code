/**
 * MYCELIAL NETWORK ANIMATION
 * Animated network visualization for hero section background
 */

class NetworkAnimation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.connections = [];
        this.signals = [];
        this.mousePos = { x: 0, y: 0 };
        this.isRunning = false;

        // Configuration
        this.config = {
            nodeCount: 50,
            maxDistance: 150,
            nodeRadius: 3,
            nodeColor: '#355E3B',
            connectionColor: 'rgba(53, 94, 59, 0.2)',
            signalColor: '#4A7C59',
            signalSpeed: 2,
            signalFrequency: 0.02,
            mouseInfluence: 100
        };

        this.init();
    }

    /**
     * Initialize the animation
     */
    init() {
        this.resize();
        this.createNodes();
        this.start();

        // Handle window resize
        window.addEventListener('resize', () => this.resize());

        // Track mouse position
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = e.clientX - rect.left;
            this.mousePos.y = e.clientY - rect.top;
        });

        // Mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            this.mousePos.x = -1000;
            this.mousePos.y = -1000;
        });
    }

    /**
     * Resize canvas to match window
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Create network nodes
     */
    createNodes() {
        this.nodes = [];

        for (let i = 0; i < this.config.nodeCount; i++) {
            this.nodes.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: this.config.nodeRadius,
                originalRadius: this.config.nodeRadius
            });
        }
    }

    /**
     * Update animation state
     */
    update() {
        // Update nodes
        this.nodes.forEach(node => {
            // Move node
            node.x += node.vx;
            node.y += node.vy;

            // Bounce off edges
            if (node.x < 0 || node.x > this.width) node.vx *= -1;
            if (node.y < 0 || node.y > this.height) node.vy *= -1;

            // Keep within bounds
            node.x = Math.max(0, Math.min(this.width, node.x));
            node.y = Math.max(0, Math.min(this.height, node.y));

            // Mouse interaction
            const dx = this.mousePos.x - node.x;
            const dy = this.mousePos.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.config.mouseInfluence) {
                const force = (this.config.mouseInfluence - dist) / this.config.mouseInfluence;
                node.radius = this.config.nodeRadius + force * 3;
            } else {
                node.radius = this.config.nodeRadius;
            }
        });

        // Find connections
        this.connections = [];
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const dx = this.nodes[i].x - this.nodes[j].x;
                const dy = this.nodes[i].y - this.nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.config.maxDistance) {
                    this.connections.push({
                        from: this.nodes[i],
                        to: this.nodes[j],
                        opacity: 1 - (dist / this.config.maxDistance)
                    });
                }
            }
        }

        // Create random signals
        if (Math.random() < this.config.signalFrequency && this.connections.length > 0) {
            const connection = this.connections[Math.floor(Math.random() * this.connections.length)];
            this.signals.push({
                from: connection.from,
                to: connection.to,
                progress: 0,
                life: 1
            });
        }

        // Update signals
        this.signals = this.signals.filter(signal => {
            signal.progress += this.config.signalSpeed / 100;
            signal.life -= 0.01;
            return signal.life > 0 && signal.progress < 1;
        });
    }

    /**
     * Draw the network
     */
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw connections
        this.connections.forEach(conn => {
            this.ctx.beginPath();
            this.ctx.moveTo(conn.from.x, conn.from.y);
            this.ctx.lineTo(conn.to.x, conn.to.y);
            this.ctx.strokeStyle = `rgba(53, 94, 59, ${conn.opacity * 0.3})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        });

        // Draw signals
        this.signals.forEach(signal => {
            const x = signal.from.x + (signal.to.x - signal.from.x) * signal.progress;
            const y = signal.from.y + (signal.to.y - signal.from.y) * signal.progress;

            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(74, 124, 89, ${signal.life})`;
            this.ctx.fill();

            // Glow effect
            this.ctx.beginPath();
            this.ctx.arc(x, y, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(74, 124, 89, ${signal.life * 0.3})`;
            this.ctx.fill();
        });

        // Draw nodes
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = this.config.nodeColor;
            this.ctx.fill();

            // Glow effect for active nodes
            if (node.radius > this.config.nodeRadius) {
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, node.radius + 2, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(53, 94, 59, 0.2)`;
                this.ctx.fill();
            }
        });
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        requestAnimationFrame(() => this.animate());
    }

    /**
     * Start animation
     */
    start() {
        this.isRunning = true;
        this.animate();
    }

    /**
     * Stop animation
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Destroy animation
     */
    destroy() {
        this.stop();
        window.removeEventListener('resize', this.resize);
    }
}

// Initialize network animation when DOM is ready
let networkAnimation = null;

function initNetworkAnimation() {
    const canvas = document.getElementById('network-canvas');
    if (canvas) {
        networkAnimation = new NetworkAnimation('network-canvas');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNetworkAnimation);
} else {
    initNetworkAnimation();
}

// Export for external use
if (typeof window !== 'undefined') {
    window.NetworkAnimation = NetworkAnimation;
    window.networkAnimation = networkAnimation;
}
