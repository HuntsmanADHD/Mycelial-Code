# Sonnet: Landing Page Redesign - Interactive & Educational

## Mission

Redesign the Mycelial landing page to be **visually stunning** (Spotify-inspired) and **educational** for non-technical audiences.

**Goal**: When someone visits mycelial.dev, they understand what Mycelial is and why they should care - even if they've never written code.

---

## Design Direction: Spotify Premium

Reference: https://www.spotify.com/us/premium/

**Key Elements to Emulate**:
- Hero section with dramatic imagery + text overlay
- Smooth scrolling sections, each with clear narrative
- High-quality photos integrated throughout
- CTA buttons that pop (stand out)
- Clean, minimal layout
- Typography hierarchy (big headlines, readable body text)
- Dark theme with accent colors

---

## Color Palette

- **Primary**: Huntsman Green (#355E3B)
- **Accent**: Deep Matte Grey (#2A2A2A, #1F1F1F)
- **Background**: True Black (#000000)
- **Text**: Off-white (#F5F5F5, #E8E8E8)
- **Highlights**: Bright green accents for interactive elements

---

## Content & Layout

### Section 1: Hero
**Headline**: "Agents That Think Like Nature"
**Subheadline**: "Build distributed systems the way biology builds networks"

**Visual**:
- Image #1 (mycelium network) as full-width background with dark overlay
- Text overlay in top-left or center
- CTA button: "Try the Compiler" (green accent)

**Navigation** (top-right):
- Logo (Image #1 - small version)
- Links: "About" | "Docs" | "Examples" | "GitHub" | "Download"

---

### Section 2: What Is Mycelial? (Educational)

**For Non-Technical People:**

```
HEADLINE: "What Is Mycelial?"

CONTENT (with icons/images):

🧬 "Like a Fungal Network"
Mycelial is inspired by how mushroom networks communicate underground.
Instead of one program doing everything, you have many "agents"
that talk to each other through "signals."

🔄 "Agents That Work Together"
Think of agents like specialized workers:
- One worker listens to input
- One processes data
- One sends results

They pass messages (signals) between them.
No central boss - just collaboration.

⚡ "Blazing Fast"
Agents communicate at 12 MILLION messages per second.
That's 123x faster than traditional approaches.

🏗️ "Compiles to Real Code"
Write in Mycelial → Compiler turns it into machine code
→ Runs on your computer as a real program
→ No interpreter needed, no overhead
```

**Visual Strategy**:
- Use mycelium photos to illustrate concepts
- Animated diagrams showing agents passing signals
- Simple, colorful icons for each concept

---

### Section 3: See It In Action (Interactive Demo)

**Title**: "Watch Agents Collaborate"

**Interactive Demo Area**:
- 3-agent network visible on screen
- Agent 1 sends a signal
- Agent 2 receives and processes
- Agent 3 outputs result
- Animation loops with performance metrics:
  - "12.3M signals/sec" displayed
  - Real-time counter showing signals flowing

**Code Sample** (below):
```mycelial
hyphal processor {
    on signal(data, d) {
        emit result { value: d.count * 2 }
    }
}
```

"This Mycelial code compiles to x86-64 assembly and runs at native speed."

---

### Section 4: Use Cases / Examples

**Title**: "Built For Parallel Problems"

Three cards with images + descriptions:

1. **Data Pipelines**
   - Image: streaming data flowing
   - "Chain agents to process data in parallel"
   - Link: "View Example"

2. **Distributed Computing**
   - Image: network topology
   - "Scale across multiple machines"
   - Link: "View Example"

3. **Real-Time Systems**
   - Image: fast-moving signals/network
   - "React to events instantly (12M msg/sec)"
   - Link: "View Example"

---

### Section 5: The Compiler

**Title**: "Direct to Machine Code"

**Content**:
- Your Mycelial code → Compiler generates x86-64 assembly → Real binary
- No Java VM, no Python interpreter, no dependencies
- Download compiled binary, run anywhere

**Visualization**:
- Flow diagram: Code → Compiler → Binary → Performance graph

---

### Section 6: Getting Started

**Title**: "Try It Now"

Two options:

1. **Online Playground**
   - "Write Mycelial in your browser"
   - "See compiled assembly instantly"
   - Button: "Open Playground"

2. **Read Docs**
   - "Learn the language"
   - "See full examples"
   - Button: "View Docs"

---

### Section 7: Footer

- Links: Docs | GitHub | Twitter

---

## Technical Requirements

### Images to Use (from `/home/lewey/Desktop/Photos for landing page`)

1. **Image #1 /home/lewey/Desktop/Photos for landing page/IMG_8095.JPG**: Logo / Hero image (mycelium network)
2. **Section 2**: Educational illustrations (agents, networks)
3. **Section 4**: Data flow, network topology, speed visualization
4. **Section 5**: Compiler diagram

**Specifications**:
- Original: 4096x4096 pixels
- Display: 2000x2000 (or responsive scaling)
- Formula for original coords: `original = display * 2.05`

### Technologies

- **Framework**: React or vanilla HTML/CSS (your choice, keep it simple)
- **Animations**: Smooth scrolling, section reveals on scroll
- **Responsiveness**: Mobile-first, works on all screen sizes
- **Performance**: Fast load times, optimized images

### Interactive Elements

1. **Signal flow animation** (Section 3)
   - 3 agents, signals flowing between them
   - Pulsing/glowing effect for signals
   - Performance counter (12.3M sig/sec)

2. **Code playground embed** (Section 6)
   - OR link to external playground
   - Show code + live assembly output

3. **Hover effects** on buttons, cards
   - Green accent on hover
   - Subtle scale/shadow effects

---

## Copy & Messaging Guidelines

**Key Messages**:
- "Biology-inspired computing"
- "Fast, distributed, emergent"
- "Compiles to native code"
- "No dependencies, no overhead"
- "For builders who think differently"

**Tone**:
- Inspiring, not preachy
- Technical but accessible
- Emphasize beauty & elegance
- Show, don't tell (use visuals)

---

## Deliverables

1. **Redesigned HTML/CSS/JS** (updated landing page)
2. **Responsive design** (mobile, tablet, desktop)
3. **Interactive elements**:
   - Signal flow animation
   - Image carousels/lightboxes
   - Smooth scroll sections
4. **Performance optimized**:
   - Lazy-load images
   - Minified CSS/JS
   - Fast page load
5. **Accessibility**:
   - Alt text on images
   - Semantic HTML
   - Keyboard navigation

---

## Color Usage Examples

```css
/* Hero Section */
background: linear-gradient(135deg, #000000 0%, #1F1F1F 100%);
color: #F5F5F5;

/* Accent Button */
background: #355E3B;
color: #F5F5F5;
&:hover { background: #2d4d32; }

/* Card Backgrounds */
background: #2A2A2A;
border: 1px solid #355E3B;

/* Highlights */
accent: #355E3B;
```

---

## Structure to Keep

- Logo in top-right (linked to home)
- Navigation menu (top-right)
- Hero section takes full viewport
- Smooth section transitions
- Footer with links

---

## Reference

- **Spotify Premium**: https://www.spotify.com/us/premium/ (design inspiration)
- **Photos**: `/home/lewey/Desktop/Photos for landing page/`
- **Color Guide**: Huntsman Green (#355E3B), Blacks, Deep Greys, Whites
- **Audience**: Non-technical people learning what Mycelial is for the first time

---

## Success Criteria

- [ ] Page loads fast (< 3 seconds)
- [ ] Beautiful on mobile, tablet, desktop
- [ ] Non-technical person understands what Mycelial is after reading
- [ ] Interactive demo is engaging and clear
- [ ] Colors are cohesive (green, black, grey, white only)
- [ ] Images are high-quality and properly scaled
- [ ] Navigation is intuitive (top-right is clear)
- [ ] CTAs stand out and are compelling
- [ ] Animations are smooth and not distracting
- [ ] Professional, beautiful, ready to show the world

---

**You've built something beautiful. Now show the world.** 🌿✨
