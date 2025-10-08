# Creator Dashboard Tabs - Purpose & Logic Guide

## Overview
The Creator Dashboard uses an **EnhancedContentGallery** component with 6 main tabs that allow creators to manage and monetize their content. Each tab serves a specific purpose in the creator's content and revenue ecosystem.

---

## Tab Breakdown

### 1. 📸 **Photos Tab**
**Purpose:** Manage and monetize photo content

**What Creators Can Do:**
- Upload photos (JPG, PNG)
- Set photos as **Premium/PPV** (Pay-Per-View)
- Price individual photos with tokens
- View photo analytics (views, likes, earnings)
- Edit photo details (title, description, price)
- Delete photos
- Track which fans have purchased each photo

**Business Logic:**
- Photos can be **FREE** (visible to all followers)
- Photos can be **PREMIUM** (locked behind a token payment)
- Creators earn tokens when fans unlock premium photos
- Photos appear blurred for fans who haven't purchased them
- Analytics show earnings per photo

**Use Case Example:**
> A fitness creator uploads exclusive workout photos. Free photos show exercises in regular gym attire, while premium photos ($5-10 tokens) show detailed form breakdowns or behind-the-scenes content.

---

### 2. 🎥 **Videos Tab**
**Purpose:** Upload and sell video content

**What Creators Can Do:**
- Upload videos (MP4, MOV)
- Set video pricing (PPV model)
- Add thumbnails
- Set video duration
- Track video views and purchases
- Edit/delete videos
- See earnings per video

**Business Logic:**
- Videos can be free previews or full premium content
- Locked videos show thumbnail with play button + lock icon
- Fans pay tokens to unlock full video access
- Once purchased, fans own permanent access
- Videos show duration and viewer count

**Use Case Example:**
> A chef creator posts free 30-second recipe teasers, but full 10-minute cooking tutorials cost 20 tokens. Fans who purchase get lifetime access.

---

### 3. 📡 **Streams Tab**
**Purpose:** Manage live streams and VOD (Video on Demand)

**What Creators Can Do:**
- View past live stream recordings
- Set pricing for stream recordings (VOD)
- Schedule upcoming streams
- Track stream analytics (viewers, duration, earnings)
- Delete old streams
- Manage ticketed shows

**Business Logic:**
- **Live Streams:** Real-time broadcasts (managed separately in "Go Live")
- **Stream Recordings:** After going live, streams are saved here
- Recordings can be monetized as VOD content
- Shows "LIVE" badge for active streams
- Shows viewer count and earnings
- Can set stream recordings as free or premium

**Use Case Example:**
> A gaming creator streams live gameplay. After the stream ends, the recording is automatically saved to this tab. They set it as premium (15 tokens) so fans who missed it can watch later.

---

### 4. 🎁 **Offers Tab**
**Purpose:** Create custom service offerings

**What Creators Can Do:**
- Create custom offers/services
- Set offer details:
  - Title (e.g., "Personalized Video Message")
  - Description
  - Category (General, Coaching, etc.)
  - Price in tokens
  - Delivery time (1 hour - 1 week)
  - Max quantity (limited slots)
- Edit/delete offers
- Track offer bookings and earnings

**Business Logic:**
- Offers are **SERVICES**, not physical/digital products
- Examples: personalized shoutouts, coaching calls, custom content requests
- Fans purchase slots, creators deliver within promised timeframe
- Max quantity creates scarcity (e.g., "Only 5 slots available")
- Active/inactive status control

**Use Case Example:**
> A musician offers "Custom Song Request" for 100 tokens. Description says they'll create a 30-second personalized jingle. Delivery time is 3 days. Limited to 10 requests per month.

---

### 5. 💎 **Digitals Tab**
**Purpose:** Sell downloadable digital products

**What Creators Can Do:**
- Upload digital files (PDFs, eBooks, presets, templates, audio files)
- Set pricing for digital downloads
- Add preview images
- Track downloads and sales
- Edit/delete digital products
- See earnings per product

**Business Logic:**
- **Digitals** are downloadable files fans can keep
- Different from photos/videos (which are viewable in-app)
- Examples: Lightroom presets, workout PDFs, music stems, design templates
- Fans pay once, download unlimited times
- Shows download count

**Use Case Example:**
> A photographer sells "Wedding Photography Preset Pack" (20 Lightroom presets) for 50 tokens. Buyers download a ZIP file they can use in their own photo editing.

---

### 6. 🛍️ **Shop Tab**
**Purpose:** Sell physical or digital products

**What Creators Can Do:**
- Add shop products with:
  - Product name
  - Description
  - Price (in tokens)
  - Category
  - Stock quantity
  - Product images (multiple)
  - Digital/physical flag
- Manage inventory
- Track sales and orders
- Edit/delete products
- View shop statistics

**Business Logic:**
- **Physical Products:** Require shipping (merch, signed items)
- **Digital Products:** Instant delivery (similar to Digitals tab, but with more shop-like features)
- Stock management (products can sell out)
- Multiple images per product
- Active/inactive status
- Can set categories for organization

**Use Case Example:**
> A fitness creator sells:
> - Physical: Branded workout T-shirts (50 tokens, 20 in stock)
> - Digital: 12-Week Workout Program PDF (30 tokens, unlimited stock)

---

## Key Differences Between Similar Tabs

### **Digitals vs Shop**
| Feature | Digitals Tab | Shop Tab |
|---------|-------------|----------|
| **Purpose** | Simple digital downloads | Full e-commerce store |
| **Products** | Only downloadable files | Physical OR digital |
| **Inventory** | N/A (unlimited) | Stock tracking |
| **Images** | Single preview | Multiple product images |
| **Use Case** | Presets, templates, PDFs | Merchandise, courses, bundles |

### **Offers vs Shop**
| Feature | Offers Tab | Shop Tab |
|---------|-----------|----------|
| **Type** | Services & custom requests | Products (tangible items) |
| **Delivery** | Time-based (1 hour - 1 week) | Physical shipping or instant download |
| **Example** | "1-on-1 Coaching Call" | "Signed Poster" |

### **Videos vs Streams**
| Feature | Videos Tab | Streams Tab |
|---------|-----------|-------------|
| **Content** | Pre-recorded videos | Live stream recordings (VOD) |
| **Upload Method** | Manual upload | Auto-saved after live stream |
| **Live Status** | Never live | Can show "LIVE" badge |

---

## Content Monetization Matrix

| Content Type | Free Option | Premium/PPV | Use Case |
|--------------|-------------|-------------|----------|
| **Photos** | ✅ Yes | ✅ Yes | Exclusive photoshoots, BTS content |
| **Videos** | ✅ Yes | ✅ Yes | Tutorials, courses, exclusive footage |
| **Streams** | ✅ Yes (public streams) | ✅ Yes (ticketed/VOD) | Live Q&As, performances |
| **Offers** | ❌ No | ✅ Yes (all paid) | Custom services, 1-on-1 time |
| **Digitals** | ❌ No | ✅ Yes (all paid) | Downloadable resources |
| **Shop** | ❌ No | ✅ Yes (all paid) | Physical/digital products |

---

## Upload Flow for Each Tab

### Photos/Videos Upload:
1. Creator clicks **"+ Upload"** card
2. Selects file(s)
3. Fills out form:
   - Title
   - Description
   - Category
   - Premium toggle (yes/no)
   - If premium: set token price
4. Click "Upload"
5. Content appears in grid with analytics overlay

### Streams:
1. Auto-created after live streaming session ends
2. Creator can edit stream details retroactively
3. Can set VOD pricing for replay access

### Offers:
1. Click **"+ Create Offer"** card
2. Fill form:
   - Offer title
   - Description
   - Category
   - Token price
   - Delivery timeframe
   - Max quantity (optional)
3. Click "Create"
4. Offer appears as card with booking option

### Digitals:
1. Click **"+ Upload Digital"** card
2. Select file (PDF, ZIP, etc.)
3. Add preview image
4. Set price
5. Add description
6. Upload
7. Shows as downloadable item

### Shop:
1. Click **"+ Add Product"** card
2. Fill detailed form:
   - Product name
   - Multiple images
   - Description
   - Price
   - Stock quantity
   - Category
   - Digital/Physical toggle
3. Click "Add to Shop"
4. Product appears in shop grid

---

## Analytics & Insights Per Tab

Each tab shows:
- **Views** (how many people saw the content)
- **Likes** (engagement metric)
- **Earnings** (total tokens earned)
- **Purchases** (number of unlocks/sales)

Hover over any content item to see these metrics in real-time.

---

## Creator Best Practices

1. **Photos:** Use for quick, engaging content. Mix free and premium.
2. **Videos:** Perfect for tutorials, courses, longer-form content.
3. **Streams:** Great for real-time interaction. Monetize VODs for passive income.
4. **Offers:** Create recurring revenue with services (coaching, shoutouts).
5. **Digitals:** Sell your expertise as downloadable resources.
6. **Shop:** Build a brand with merchandise and exclusive products.

---

## Summary

The 6 tabs work together to create a **complete monetization ecosystem**:

- **Content Tabs** (Photos, Videos, Streams): Showcase your creative work
- **Service Tab** (Offers): Sell your time and expertise
- **Product Tabs** (Digitals, Shop): Sell tangible value

This structure allows creators to diversify income streams beyond just live streaming and subscriptions.

---

**Last Updated:** 2025-10-08
