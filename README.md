# Halo — information site

A one-page, mobile-first site explaining the Halo idea, plus a working QR code
for the presentation slide.

Plain HTML, CSS and a little JavaScript. No build step, no npm install, no
frameworks — open the file and it works.

```
Halo/
├── index.html          all the page content — edit the words here
├── styles.css          all the styling — colours and spacing live at the top
├── script.js           scroll fades + keeps the QR caption honest
├── site.config.js      ← the one place the site URL is written down
├── assets/
│   ├── logo.svg        the gradient halo mark
│   └── qr.svg          generated — don't edit by hand
└── tools/make-qr.mjs   regenerates assets/qr.svg
```

---

## Getting started — three steps

### 1. Look at it

Double-click `index.html`. That's it, it opens in your browser.

To check the **mobile layout**, which is the one that matters, either:

- drag the browser window narrow — below about 720px wide the page switches to
  the phone layout. Simplest option, no shortcuts to remember; or
- right-click the page → **Inspect** (or `Ctrl` + `Shift` + `I`), then
  `Ctrl` + `Shift` + `M` for a proper phone-sized preview.

*(Guides often say "press F12" for that second one. On most laptops the top row
is media keys, so F12 opens something else entirely unless you hold `Fn` — use
right-click → Inspect instead.)*

Best of all, once the site is online (step 2), just open the link on your phone.

### 2. Put it online

The QR code needs a real address to point at. **GitHub Pages** is free and takes
about five minutes:

1. Create a free account at github.com, then **New repository** → name it `halo`
   → **Public** → Create.
2. On the repo page click **uploading an existing file**, drag in *everything*
   inside this folder (keep the `assets` folder together), then **Commit**.
3. **Settings** → **Pages** → under *Branch* pick `main` / `root` → **Save**.
4. Wait a minute and refresh. Your address appears at the top —
   `https://<your-username>.github.io/halo/`

Alternatives if you'd rather not use GitHub: drag the folder onto
[netlify.com/drop](https://app.netlify.com/drop) for an instant free link, or
use Vercel.

### 3. Point the QR code at it

One command, in this folder (needs Node.js, which is already on your machine):

```bash
node tools/make-qr.mjs "https://your-username.github.io/halo/"
```

That regenerates `assets/qr.svg` *and* updates `site.config.js`, so the code and
the caption underneath it can never drift apart.

Then re-upload those two files, scan the code with your own phone to be sure,
and drop `assets/qr.svg` straight onto your presentation slide — it's vector, so
it stays sharp at any size.

> While you're testing locally, a yellow warning appears under the QR code if
> it's still pointing at the placeholder URL. It never shows on the real site.

---

## Editing the content

Everything you'd want to reword is in `index.html`, in labelled sections:
`HERO`, `PROBLEM`, `HOW`, `FEATURES`, `HUBS`, `CERTIFIED`, `GET / QR`.

**To add a feature card**, copy one `<article class="card">` block and change the
three lines inside it. The grid re-flows on its own — 1 column on a phone, 2 on
a tablet, 3 on a laptop.

**To change the colours**, edit the top of `styles.css` only:

```css
--blue:#2547D6;   /* the brand sweep runs blue → violet → coral → gold  */
--violet:#7B3FC9;
--coral:#C0453F;
--gold:#B87D0F;

--bg:#EFE9DF;     /* the warm paper background      */
--bg-alt:#E8E1D3; /* alternating bands              */
--dark:#1C1813;   /* app screens and the QR panel   */
```

**Gradients appear in exactly two places** and it's worth keeping it that way:
the logo mark, and the italic accent inside display headings. Everything else —
buttons, icons, badges, the map route — is a flat colour. Gradients on every
surface are the fastest way to make a page look generated rather than designed.
(The sweep itself runs *through* violet and coral rather than straight from blue
to gold, because those two mixed directly give a grey-olive middle.)

**Corners are small on purpose** — `--r-sm: 8px` for buttons, `14px` for panels.
Fully rounded pill buttons were the other thing making it look stock.

**One rule worth keeping:** the page is light, and anything that represents the
app itself is dark — the phone in the hero, the hub card, the QR panel. That's
what makes the mock-ups read as screens rather than as page furniture. If you
add another mock-up, give it `background:var(--dark)` and light text.

The logo is `assets/logo.svg` — a circle with a gradient stroke, deliberately
simple to swap out. The same gradient is repeated inline at the top of
`index.html` (`<linearGradient id="halo-g">`), which is what the nav mark and
the feature icons use, so change both if you re-colour it.

---

## Notes for the write-up

A few deliberate choices, in case you're asked:

- **Mobile-first.** The CSS is written for a phone and *adds* layout at wider
  screens, not the other way round. Someone walking home is on a phone.
- **Nothing is loaded from the internet.** No web fonts, no icon libraries, no
  analytics. The page loads instantly on a bad connection and works offline.
- **No invented statistics or fake testimonials.** The one quote is presented as
  a statement of principle, not attributed to a real customer. If you find real
  research on street lighting and safety, cite it properly and add it.
- **Accessibility:** skip link, visible focus rings, alt text, and all animation
  turns itself off for anyone who has "reduce motion" enabled.
- The QR generator in `tools/` was written from the QR spec rather than pulled
  from a library, and was checked module-for-module against a reference
  implementation across 213 URL lengths.

## Ideas for the next round

Not built yet, deliberately — the page is short on purpose:

- A short FAQ ("does it track me all the time?" is the question you'll be asked)
- A privacy section — you're proposing location tracking, so say plainly what is
  stored and for how long
- A sign-up form for businesses wanting to become a Halo Certified hub
- Real screenshots of the app once the design exists, replacing the phone mock-up
