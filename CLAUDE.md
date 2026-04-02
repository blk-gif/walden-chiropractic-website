# Walden Bailey Chiropractic — Claude Code Rules

## Project
Static HTML/CSS/JS website for Walden Bailey Chiropractic, Buffalo NY.
Deployed via Netlify from GitHub repo: blk-gif/walden-chiropractic-website

## Tech Stack
- Plain HTML, CSS, JavaScript only — NO frameworks, NO build tools, NO npm
- Single-file: all CSS and JS are inline in index.html (no separate style.css)
- Cloudinary for office photo gallery (tag: walden-office)
- Twilio endpoint for contact form (wired to onrender.com backend)

## Critical Rules
- NEVER use scroll animations (opacity:0 fade-up on new sections) — breaks on Netlify CDN
- NEVER add framework dependencies — plain HTML/CSS/JS only
- ALWAYS verify script tags close cleanly before finishing
- Do NOT break existing sections — only add to them

## Section Order (index.html)
Transport → About → Team → Gallery → Services → Hours → Insurance → FAQ → Contact → HIPAA → Footer

## Nav Link Order
Transport · Team · Office · Services · Hours · Insurance · FAQ · Contact · Privacy

## Files
- index.html — main site (all CSS/JS inline)
- admin.html — password-protected Cloudinary photo upload tool (NOT indexed by search engines)
- robots.txt — blocks admin.html from crawlers

## Placeholders That Need Real Values
- index.html line ~1546: CLOUDINARY_CLOUD_NAME_PLACEHOLDER
- admin.html: CLOUDINARY_CLOUD_NAME_PLACEHOLDER, CLOUDINARY_UPLOAD_PRESET_PLACEHOLDER, ADMIN_PASSWORD_PLACEHOLDER

## Contact Info
- Phone/SMS: (716) 893-9200
- Email: drward@waldenchiropractic.com
- Address: 1086 Walden Ave Suite 1, Buffalo, NY 14211
