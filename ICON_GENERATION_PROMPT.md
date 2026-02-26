# LinkedIn PWA Icon Generation Prompt for Gemini

Copy and paste this prompt into Gemini to generate the PWA icon images.

---

## Main Icon Generation Prompt

I need you to generate PWA (Progressive Web App) icon images for a LinkedIn post automation tool. Please create 4 PNG images with these exact specifications:

### Icon Specifications:

**1. Standard Icon (192×192 & 512×512)**
- Create a LinkedIn automation app icon
- Design: Modern LinkedIn blue (#0A66C2) with white/light accents
- Center element: Either the official LinkedIn logo OR a stylized "LA" (LinkedIn Automation) monogram
- Style: Clean, minimalist, professional
- Should look good at small sizes (as small as 48px)

**2. Maskable Icon (192×192 & 512×512)**
- Same design as standard icon
- IMPORTANT: Keep all critical elements (logo/text) within the center 70% of the canvas
- The outer 30% can extend to edges but should be non-critical visual elements
- Safe zone: All important content must fit in a circle at center 70% radius
- This allows proper display on: circles, squircles, teardrop shapes (Android adaptive icons)

### Colors to Use:
- **Primary:** LinkedIn Blue #0A66C2
- **Secondary:** White #FFFFFF
- **Accent:** Optional light gray #E8E8E8 or darker blue #004B87
- **Background:** Transparent (PNG with alpha channel)

### Technical Requirements:
- **Format:** PNG with transparency
- **Dimensions needed:**
  1. 192x192 pixels (standard)
  2. 192x192 pixels (maskable variant)
  3. 512x512 pixels (standard)
  4. 512x512 pixels (maskable variant)
- **File naming:** Include dimension and variant in description so I can rename them
- **Quality:** High quality, crisp edges, suitable for both web and mobile home screens

### Design Style:
- Modern and professional (for a B2B automation tool)
- Should convey: automation, LinkedIn, scheduling, posting
- Consider incorporating: gears, calendar elements, posting symbols, or LinkedIn's "in" logo
- Flat design or subtle depth - no heavy gradients
- Must be recognizable even at 48×48px when scaled down

### Output Format:
Please generate all 4 images and provide them as PNG files. Label them clearly so I can identify:
- Which is 192x192 standard
- Which is 192x192 maskable
- Which is 512x512 standard
- Which is 512x512 maskable

---

## What I'll Do With These:
These icons will be used in a PWA manifest.json for:
- Home screen shortcuts on iOS and Android
- App drawer icons on Android  
- Browser tab icons
- Install prompts (PWA installation)

The maskable variants ensure the icon looks perfect when the OS crops it into different shapes.

---

## If You Need Guidance:

**Option A: LinkedIn Logo Based**
- Use the LinkedIn "in" circle logo
- Place a subtle automation symbol (gear, schedule, or AI star) in corner
- Solid LinkedIn blue background with white logo

**Option B: Monogram Based**
- Create a stylized "LA" monogram (L + A intertwined or combined)
- Solid LinkedIn blue background
- White letters
- Modern, geometric font

**Option C: Hybrid**
- LinkedIn blue background
- LinkedIn "in" logo with a small post/upload symbol
- Conveys both social media and automation aspects

**I recommend Option A or C for maximum brand recognition while showing automation focus.**

---

Once you generate these, I'll save them to: `/public/icons/`
- `linkedin-192x192.png`
- `linkedin-192x192-maskable.png`
- `linkedin-512x512.png`
- `linkedin-512x512-maskable.png`
