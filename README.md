# Dynamic Background (third-party extension)

Dynamic Background automatically suggests and switches the chat background based on scene context and available background names. It uses simple name-matching for trigginer, then an LLM scoring step to pick the most relevant background.

## Installation

1. In SillyTavern, open Extensions tab
2. Click on Install extensions
3. Enter the URL of this repo (https://github.com/sakuragi-10-ai/dynamic-bg)
4. Install
5. Confirm the Exensions tab have a sub tab called "Dynamic Background"

## How it works

- The extension watches user and character messages.
- If a background title (from the Backgrounds menu) appears in recent messages, it can instantly pick that background as a fallback.
- If no direct name match is found, the extension detects movement/location keywords and (when enabled) asks the model to score how well each available background matches the scene. It then applies the top match if it passes the configured threshold.
- Trigger presets: The extension uses built-in word-set presets for location and movement triggering. There are four preset levels — `Strict`, `Common`, `Uncommon`, and `Rare` — compiled into regex-based trigger lists. Users cannot add or remove entries; instead, choose a preset level from the dropdown to control detection sensitivity.
- Background tags: 
   - Add "\[tags\]" in front of background names to pick and choose which backgrounds to use for dynamic switching. Supports multiple tags, for example, "\[city\]\[night\] cafe"
   - Desired tags can be set in Settings.  Also, character tags prefixed with `BG:` will also be considered.  For example, a character with tag `BG:Hogwarts` will include `[hogwarts]library` background in the list.

## Usage

- Upload background images to your SillyTavern backgrounds location (via the UI or by placing image files in your backgrounds folder).
- Name each background with a clear title — that title is what this extension uses when matching.  Optionally, add any number of "\[tags\]" to easily switch between sets of backgrounds.
- During chats, if the extension finds a suitable match it will automatically click the background to change it. If fading is enabled, the switch will be animated.

## Settings

- **Enabled**: Toggle the extension on/off.
- **Match Threshold**: Minimum score (0–100) required for the model-based match to be accepted. Increase to be stricter, lower to be more permissive.
- **Fading**: Enable/disable fade animation when changing backgrounds.
- **Trigger Words**: Pick a preset level: `Strict`, `Common`, `Uncommon`, or `Rare`. Each level switches the internal regex trigger set; these presets are built-in and not editable from the UI.
- **Background Tags**: Set a comma-separated list of tags to choose backgrounds from.  For exapmle, if this field is set to "hogwarts,city", any backgrounds prefixed with "\[hogwarts\]" or "\[city\]" will be analyzed for suitablility to swap in.  Note that character tags can also be used for the same purpose (see above for details)

You can find and change these options in the extension's settings panel (Extensions → Dynamic Background).

## Best practices and naming rules

To get reliable matches and avoid parsing issues, follow these naming guidelines for background titles:

- IMPORTANT: Avoid punctuation that can interfere with parsing or CSV-like outputs: do NOT include commas (`,`) or colons (`:`) in background names, otherwise the feature will not function properly!
- Use short, descriptive names: e.g. `Wine Cellar`, `Riverside Park`, `Hospital Ward`.
- Avoid newlines and excessive special characters (such as `|`, `;`, `/`, `\\`).
- Prefer human-readable words and simple separators like spaces, hyphens (`-`) or underscores (`_`).
- Keep names unique — duplicates make matching ambiguous.

Examples of good names:
- `Wine Cellar`
- `Abandoned Warehouse`
- `Seaside Boardwalk`

Examples to avoid:
- `Warehouse, Level 1` (contains a comma)
- `Kitchen:Main` (contains a colon)

Why these rules matter
- The extension reads the visible background titles from the UI and may parse model outputs with comma-separated lists. Commas and colons can break the expected name:score parsing or create mismatches.

