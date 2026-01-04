/**
 * MYCELIAL DEMO - INTERACTIVE DEMO MODULE
 * Interactive signal flow demonstration
 */

class MycelialDemo {
    constructor(svgId) {
        this.svg = document.getElementById(svgId);
        if (!this.svg) return;

        this.isAnimating = false;
        this.animationStep = 0;

        this.init();
    }

    /**
     * Initialize the demo
     */
    init() {
        this.createDiagram();
        this.setupControls();
    }

    /**
     * Create the network diagram
     */
    createDiagram() {
        const width = 800;
        const height = 400;

        // Clear existing content
        this.svg.innerHTML = '';

        // Define positions
        const positions = {
            input: { x: 100, y: 200 },
            greeter: { x: 400, y: 200 },
            output: { x: 700, y: 200 }
        };

        // Create connections
        this.createConnection(positions.input, positions.greeter, 'conn-input-greeter');
        this.createConnection(positions.greeter, positions.output, 'conn-greeter-output');

        // Create nodes
        this.createNode(positions.input, 'input', 'Input\n(fruiting_body)');
        this.createNode(positions.greeter, 'greeter', 'Greeter\n(hyphal)');
        this.createNode(positions.output, 'output', 'Output\n(fruiting_body)');

        // Create signal paths (initially hidden)
        this.createSignalPath(positions.input, positions.greeter, 'signal-1');
        this.createSignalPath(positions.greeter, positions.output, 'signal-2');

        // Store positions for animation
        this.positions = positions;
    }

    /**
     * Create a connection line between nodes
     */
    createConnection(from, to, id) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('stroke', '#355E3B');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-opacity', '0.3');
        line.setAttribute('id', id);
        this.svg.appendChild(line);
    }

    /**
     * Create a node (agent or fruiting body)
     */
    createNode(pos, id, label) {
        // Node group
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('id', id);

        // Circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '30');
        circle.setAttribute('fill', '#0F0F0F');
        circle.setAttribute('stroke', '#355E3B');
        circle.setAttribute('stroke-width', '3');
        group.appendChild(circle);

        // Label
        const lines = label.split('\n');
        lines.forEach((line, index) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x);
            text.setAttribute('y', pos.y + (index - lines.length / 2 + 0.5) * 16);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#FFFFFF');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('font-weight', index === 0 ? '600' : '400');
            text.textContent = line;
            group.appendChild(text);
        });

        this.svg.appendChild(group);
    }

    /**
     * Create a signal path (animated circle)
     */
    createSignalPath(from, to, id) {
        const signal = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        signal.setAttribute('r', '6');
        signal.setAttribute('fill', '#4A7C59');
        signal.setAttribute('opacity', '0');
        signal.setAttribute('id', id);

        // Calculate path
        signal.setAttribute('cx', from.x);
        signal.setAttribute('cy', from.y);

        this.svg.appendChild(signal);
    }

    /**
     * Setup demo controls
     */
    setupControls() {
        const playButton = document.getElementById('demo-play');
        const resetButton = document.getElementById('demo-reset');

        if (playButton) {
            playButton.addEventListener('click', () => this.play());
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => this.reset());
        }
    }

    /**
     * Play the demo animation
     */
    async play() {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.animationStep = 0;

        const playButton = document.getElementById('demo-play');
        if (playButton) {
            playButton.disabled = true;
            playButton.textContent = 'Playing...';
        }

        await this.animateSequence();

        if (playButton) {
            playButton.disabled = false;
            playButton.textContent = '▶ Send Signal';
        }

        this.isAnimating = false;
    }

    /**
     * Animate the signal flow sequence
     */
    async animateSequence() {
        const steps = document.querySelectorAll('#demo-steps li');

        // Step 1: Signal arrives at input
        this.highlightStep(steps, 0);
        this.highlightNode('input');
        await this.wait(1000);

        // Step 2: Signal travels to greeter
        this.highlightStep(steps, 1);
        await this.animateSignal('signal-1', this.positions.input, this.positions.greeter);
        this.unhighlightNode('input');
        this.highlightNode('greeter');
        await this.wait(500);

        // Step 3: Agent processes
        this.highlightStep(steps, 2);
        await this.pulseNode('greeter', 3);
        await this.wait(500);

        // Step 4: Agent emits response
        this.highlightStep(steps, 3);
        await this.wait(500);

        // Step 5: Response travels to output
        this.highlightStep(steps, 4);
        await this.animateSignal('signal-2', this.positions.greeter, this.positions.output);
        this.unhighlightNode('greeter');
        this.highlightNode('output');
        await this.wait(1000);

        // Clean up
        this.unhighlightNode('output');
        this.unhighlightStep(steps);
    }

    /**
     * Highlight a step in the explanation
     */
    highlightStep(steps, index) {
        steps.forEach((step, i) => {
            if (i === index) {
                step.style.color = '#4A7C59';
                step.style.fontWeight = '600';
            } else if (i < index) {
                step.style.color = '#888888';
                step.style.fontWeight = '400';
            } else {
                step.style.color = '#FFFFFF';
                step.style.fontWeight = '400';
            }
        });
    }

    /**
     * Unhighlight all steps
     */
    unhighlightStep(steps) {
        steps.forEach(step => {
            step.style.color = '#FFFFFF';
            step.style.fontWeight = '400';
        });
    }

    /**
     * Highlight a node
     */
    highlightNode(id) {
        const node = document.getElementById(id);
        if (!node) return;

        const circle = node.querySelector('circle');
        if (circle) {
            circle.setAttribute('stroke', '#4A7C59');
            circle.setAttribute('stroke-width', '4');
            circle.setAttribute('fill', '#1A1A1A');
        }
    }

    /**
     * Unhighlight a node
     */
    unhighlightNode(id) {
        const node = document.getElementById(id);
        if (!node) return;

        const circle = node.querySelector('circle');
        if (circle) {
            circle.setAttribute('stroke', '#355E3B');
            circle.setAttribute('stroke-width', '3');
            circle.setAttribute('fill', '#0F0F0F');
        }
    }

    /**
     * Pulse a node (processing animation)
     */
    async pulseNode(id, count = 3) {
        const node = document.getElementById(id);
        if (!node) return;

        const circle = node.querySelector('circle');
        if (!circle) return;

        for (let i = 0; i < count; i++) {
            circle.setAttribute('r', '35');
            await this.wait(150);
            circle.setAttribute('r', '30');
            await this.wait(150);
        }
    }

    /**
     * Animate a signal traveling along a path
     */
    animateSignal(signalId, from, to, duration = 1000) {
        return new Promise(resolve => {
            const signal = document.getElementById(signalId);
            if (!signal) {
                resolve();
                return;
            }

            // Show signal
            signal.setAttribute('opacity', '1');
            signal.setAttribute('cx', from.x);
            signal.setAttribute('cy', from.y);

            // Animate to destination
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const x = from.x + (to.x - from.x) * progress;
                const y = from.y + (to.y - from.y) * progress;

                signal.setAttribute('cx', x);
                signal.setAttribute('cy', y);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    signal.setAttribute('opacity', '0');
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * Wait for a specified duration
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset the demo
     */
    reset() {
        // Hide signals
        const signals = this.svg.querySelectorAll('[id^="signal-"]');
        signals.forEach(signal => {
            signal.setAttribute('opacity', '0');
        });

        // Reset all nodes
        ['input', 'greeter', 'output'].forEach(id => {
            this.unhighlightNode(id);
        });

        // Reset steps
        const steps = document.querySelectorAll('#demo-steps li');
        this.unhighlightStep(steps);

        // Reset animation state
        this.isAnimating = false;
        this.animationStep = 0;
    }
}

// Initialize demo when DOM is ready
let mycelialDemo = null;

function initDemo() {
    const svg = document.getElementById('demo-svg');
    if (svg) {
        mycelialDemo = new MycelialDemo('demo-svg');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDemo);
} else {
    initDemo();
}

// Export for external use
if (typeof window !== 'undefined') {
    window.MycelialDemo = MycelialDemo;
    window.mycelialDemo = mycelialDemo;
}
